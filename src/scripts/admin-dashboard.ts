import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL as string,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'byas_admin',
    },
  }
);

const loginForm = document.getElementById('loginForm') as HTMLFormElement | null;
const authStatus = document.getElementById('authStatus') as HTMLElement | null;
const signOutBtn = document.getElementById('signOutBtn') as HTMLButtonElement | null;
const uploadSection = document.getElementById('upload') as HTMLElement | null;
const analyticsSection = document.getElementById('analytics') as HTMLElement | null;
const daysInput = document.getElementById('daysInput') as HTMLInputElement | null;
const daysLabel = document.getElementById('daysLabel') as HTMLElement | null;
const reloadAnalytics = document.getElementById('reloadAnalytics') as HTMLButtonElement | null;
const analyticsContainer = document.getElementById('analyticsContainer') as HTMLElement | null;
const productForm = document.getElementById('productForm') as HTMLFormElement | null;
const imagePreview = document.getElementById('imagePreview') as HTMLElement | null;

let accessToken: string | null = null;

function setSignedInUI(sessionEmail?: string | null) {
  if (authStatus) authStatus.textContent = sessionEmail ? `Signed in${sessionEmail ? ` as ${sessionEmail}` : ''}` : 'Not signed in';
  if (sessionEmail) {
    uploadSection?.classList.remove('hidden');
    analyticsSection?.classList.remove('hidden');
    // Optionally hide login form once signed in
    (loginForm as any)?.classList.add('hidden');
    signOutBtn?.classList.remove('hidden');
  } else {
    uploadSection?.classList.add('hidden');
    analyticsSection?.classList.add('hidden');
    (loginForm as any)?.classList.remove('hidden');
    signOutBtn?.classList.add('hidden');
  }
}

// Restore session on load
(async () => {
  const { data } = await supabase.auth.getSession();
  const session = data?.session || null;
  accessToken = session?.access_token || null;
  setSignedInUI(session?.user?.email || null);
  if (session) {
    // Preload analytics if already signed in
    await loadAnalytics();
  }
})();

// React to token refresh / sign-in / sign-out
supabase.auth.onAuthStateChange((_event, session) => {
  accessToken = session?.access_token || null;
  setSignedInUI(session?.user?.email || null);
});

// Sign out
signOutBtn?.addEventListener('click', async () => {
  try {
    await supabase.auth.signOut();
    accessToken = null;
    setSignedInUI(null);
  } catch (e) {
    if (authStatus) authStatus.textContent = 'Failed to sign out';
  }
});

if (loginForm && authStatus) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(loginForm);
    const email = fd.get('email') as string;
    const password = fd.get('password') as string;
    authStatus.textContent = 'Signing in...';
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { authStatus.textContent = error.message; return; }
    accessToken = data.session?.access_token || null;
    setSignedInUI(data.session?.user?.email || null);
    loadAnalytics();
  });
}

// Handle image preview and validation
const imageInput = document.querySelector('input[name="image_uploads"]') as HTMLInputElement | null;
if (imageInput) {
  imageInput.addEventListener('change', (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (!files || !imagePreview) return;
    
    // Validate file count (2-5 images)
    if (files.length < 2 || files.length > 5) {
      const el = document.getElementById('formStatus');
      if (el) el.textContent = `Please select 2-5 images (selected: ${files.length})`;
      imagePreview.classList.add('hidden');
      imagePreview.classList.remove('grid');
      imagePreview.innerHTML = '';
      return;
    }
    
    // Clear previous status
    const el = document.getElementById('formStatus');
    if (el) el.textContent = '';
    
    // Show preview
    imagePreview.innerHTML = '';
    imagePreview.classList.remove('hidden');
    imagePreview.classList.add('grid');
    
    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target?.result as string;
        img.className = 'w-full h-24 object-cover rounded border border-[var(--color-border)]';
        img.alt = `Preview ${index + 1}`;
        
        const container = document.createElement('div');
        container.className = 'relative';
        container.appendChild(img);
        
        if (index === 0) {
          const badge = document.createElement('span');
          badge.textContent = 'Primary';
          badge.className = 'absolute top-1 left-1 bg-blue-600 text-white text-xs px-2 py-1 rounded';
          container.appendChild(badge);
        }
        
        imagePreview.appendChild(container);
      };
      reader.readAsDataURL(file);
    });
  });
}

if (productForm) {
  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(productForm);
    // Normalize category to allowed lowercase enum (fallback to 'fashion')
    {
      const rawCat = String(fd.get('category') || '').trim().toLowerCase();
      const cat = ['fashion', 'beauty', 'footwear'].includes(rawCat) ? rawCat : 'fashion';
      fd.set('category', cat);
    }
    
    // Validate image count
    const files = (imageInput?.files);
    if (!files || files.length < 2 || files.length > 5) {
      const el = document.getElementById('formStatus');
      if (el) el.textContent = 'Please select 2-5 images';
      return;
    }
    
    // Normalize WhatsApp number to India (digits only, prefixed with 91)
    {
      const raw = String(fd.get('whatsapp_number') || '').trim();
      const digits = raw.replace(/\D/g, '');
      const normalized = digits ? (digits.startsWith('91') ? digits : '91' + digits) : '';
      if (normalized && !/^91\d{10}$/.test(normalized)) {
        const el = document.getElementById('formStatus');
        if (el) el.textContent = 'Invalid WhatsApp: must be Indian 10-digit (+91)';
        return;
      }
      fd.set('whatsapp_number', normalized);
    }
    if (!accessToken) {
      const el = document.getElementById('formStatus');
      if (el) el.textContent = 'Please sign in again';
      return;
    }
    
    const el = document.getElementById('formStatus');
    if (el) el.textContent = 'Uploading...';
    
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: fd,
    });
    const json = await res.json().catch(() => ({}));
    if (el) el.textContent = res.ok ? `Uploaded! (#${json.id})` : (json.error || 'Failed');
    
    // Clear form and preview on success
    if (res.ok) {
      productForm.reset();
      if (imagePreview) {
        imagePreview.classList.add('hidden');
        imagePreview.innerHTML = '';
      }
    }
  });
}

reloadAnalytics?.addEventListener('click', () => loadAnalytics());
daysInput?.addEventListener('input', () => { if (daysLabel && daysInput) daysLabel.textContent = String(daysInput.value || 14); });

async function loadAnalytics() {
  const days = Math.max(1, Math.min(365, Number(daysInput?.value || 14)));
  try {
    const res = await fetch(`/api/analytics-summary?days=${days}`);
    const json = await res.json();
    renderAnalytics(json.products || {}, days);
  } catch (e) {
    if (analyticsContainer) analyticsContainer.innerHTML = `<p class="text-sm text-red-600">Failed to load analytics</p>`;
  }
}

function renderAnalytics(productsMap: Record<string, any[]>, days: number) {
  if (!analyticsContainer) return;
  analyticsContainer.innerHTML = '';
  const today = new Date();
  const daysArr = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });

  const productIds = Object.keys(productsMap);
  if (productIds.length === 0) {
    analyticsContainer.innerHTML = `<p class="text-sm text-gray-600">No click data yet.</p>`;
    return;
  }

  productIds.forEach((pid) => {
    const rows = productsMap[pid] || [];
    const perDay: Record<string, { likely: number; unlikely: number; unknown: number }> = Object.create(null);
    rows.forEach((r) => {
      const day = r.day;
      const guess = r.app_opened_guess || 'unknown';
      const clicks = Number(r.clicks || 0);
      if (!perDay[day]) perDay[day] = { likely: 0, unlikely: 0, unknown: 0 };
      if (guess === 'likely') perDay[day].likely += clicks;
      else if (guess === 'unlikely') perDay[day].unlikely += clicks;
      else perDay[day].unknown += clicks;
    });

    const totals = daysArr.map((d) => {
      const v = perDay[d] || { likely: 0, unlikely: 0, unknown: 0 };
      return { day: d, ...v, total: v.likely + v.unlikely + v.unknown };
    });
    const max = Math.max(1, ...totals.map((t) => t.total));

    const card = document.createElement('div');
    card.className = 'border rounded p-3';
    card.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <div class="font-medium">Product #${pid}</div>
        <div class="text-xs text-gray-600">max/day: ${max}</div>
      </div>
      <div class="flex items-end gap-1 h-24">
        ${totals
          .map((t) => {
            const h = Math.round((t.total / max) * 96);
            const likelyH = t.total ? Math.round((t.likely / t.total) * h) : 0;
            const unlikelyH = t.total ? Math.round((t.unlikely / t.total) * h) : 0;
            const unknownH = h - likelyH - unlikelyH;
            const label = new Date(t.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return `
              <div class="w-4 sm:w-5 flex flex-col items-center" title="${label}: ${t.total}">
                <div class="w-full bg-green-600" style="height:${likelyH}px"></div>
                <div class="w-full bg-amber-500" style="height:${unlikelyH}px"></div>
                <div class="w-full bg-gray-300" style="height:${unknownH}px"></div>
                <div class="mt-1 text-[10px] text-gray-600 rotate-45">${label.split(' ').join('\n')}</div>
              </div>
            `;
          })
          .join('')}
      </div>
      <div class="mt-2 text-xs text-gray-600 flex items-center gap-3">
        <span class="inline-flex items-center gap-1"><span class="h-2 w-2 bg-green-600 inline-block"></span>app likely</span>
        <span class="inline-flex items-center gap-1"><span class="h-2 w-2 bg-amber-500 inline-block"></span>app unlikely</span>
        <span class="inline-flex items-center gap-1"><span class="h-2 w-2 bg-gray-300 inline-block"></span>unknown</span>
      </div>
    `;
    analyticsContainer.appendChild(card);
  });
}