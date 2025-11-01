// Help the Node/TS workspace understand Deno/JSR modules and globals for Edge Functions
// Map jsr module to npm types for local typechecking only
declare module "jsr:@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}

declare module "jsr:@supabase/functions-js/edge-runtime.d.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};