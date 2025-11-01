// Import Edge Runtime types (optional but useful)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Payload = { op: "insert" | "update" | "delete"; product_id?: number };

// Local type hint for editors; real runtime is Deno on Supabase Edge Functions
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE");
const VERCEL_DEPLOY_HOOK = Deno.env.get("VERCEL_DEPLOY_HOOK");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !VERCEL_DEPLOY_HOOK) {
  // Fail fast if secrets are missing
  throw new Error("Missing required function secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE, VERCEL_DEPLOY_HOOK");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  try {
    // Require service role JWT to call this function
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }
    // Strict token check: must match service role exactly
    const token = auth.replace("Bearer ", "").trim();
    if (token !== SUPABASE_SERVICE_ROLE) {
      return json(403, { error: "Forbidden" });
    }

    // Parse body
    const payload = (await req.json().catch(() => ({}))) as Partial<Payload>;
    const op = payload.op ?? "update";
    const product_id = payload.product_id ?? null;

    // Call Vercel deploy hook
    const deployRes = await fetch(VERCEL_DEPLOY_HOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "supabase-edge", op, product_id }),
    });

    const ok = deployRes.ok;
    const text = await deployRes.text();

    // Log metrics in DB
    await supabase.from("deploy_logs").insert({
      op,
      product_id,
      status: ok ? "ok" : `error:${deployRes.status}`,
      details: { vercel: text.slice(0, 1000) },
    });

    if (!ok) {
      return json(502, { error: "vercel hook failed", status: deployRes.status, body: text });
    }

    return json(200, { ok: true });
  } catch (e) {
    await supabase.from("deploy_logs").insert({
      op: "error",
      product_id: null,
      status: "exception",
      details: { message: String(e) },
    });
    return json(500, { error: String(e) });
  }
});