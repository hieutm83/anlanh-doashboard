const COOKIE_NAME = 'report_alf_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function html(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

function loginPage(error = '') {
  return html(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Đăng nhập | Report ALF</title><link rel="icon" href="/FAVICON.png"><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f7fb;color:#10213a;font-family:Inter,Arial,sans-serif}.login{width:min(390px,calc(100% - 32px));padding:32px;border:1px solid #d8e2ee;border-radius:14px;background:#fff;box-shadow:0 20px 55px rgba(28,48,78,.12)}.brand{display:flex;align-items:center;gap:10px;margin-bottom:28px}.mark{width:8px;height:30px;border-radius:4px;background:#1689e8}.brand strong{font-size:16px}.brand small{display:block;color:#71829a;font-size:8px;letter-spacing:.18em}.login h1{margin:0;font-size:25px}.login p{margin:8px 0 22px;color:#71829a;font-size:12px}.field{display:grid;gap:7px}.field span{font-size:11px;font-weight:700}.field input{width:100%;padding:12px;border:1px solid #ccd8e6;border-radius:8px;font-size:14px;outline:0}.field input:focus{border-color:#2563eb}.error{margin:0 0 14px!important;padding:10px;border-radius:7px;background:#fff1f2!important;color:#dc2626!important}.button{width:100%;margin-top:14px;padding:12px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-weight:700}</style></head><body><form class="login" method="post" action="/auth/login"><div class="brand"><span class="mark"></span><span><strong>REPORT</strong><small>ANLANHFARM</small></span></div><h1>Đăng nhập báo cáo</h1><p>Nhập mật khẩu để tiếp tục.</p>${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}<input type="hidden" name="next" value="/"><label class="field"><span>Mật khẩu</span><input name="password" type="password" autocomplete="current-password" autofocus required></label><button class="button" type="submit">Đăng nhập</button></form></body></html>`);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[ch]));
}

function getCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  return raw.split(';').map(item => item.trim()).find(item => item.startsWith(name + '='))?.slice(name.length + 1) || '';
}

async function sessionToken(env) {
  const secret = env.REPORT_SESSION_SECRET || env.REPORT_PASSWORD || '';
  if (!secret) return '';
  const data = new TextEncoder().encode('report-alf:' + secret);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function isAuthenticated(request, env) {
  const token = await sessionToken(env);
  return !!token && getCookie(request, COOKIE_NAME) === token;
}

function redirect(location, headers = {}) {
  return new Response(null, { status: 303, headers: { location, 'cache-control': 'no-store', ...headers } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/auth/login' && request.method === 'POST') {
      const form = await request.formData();
      const password = String(form.get('password') || '');
      if (!env.REPORT_PASSWORD) return html('REPORT_PASSWORD is not configured.', 500);
      if (password !== env.REPORT_PASSWORD) return loginPage('Mật khẩu không đúng.');
      const token = await sessionToken(env);
      return redirect('/', {
        'set-cookie': `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`,
      });
    }

    if (url.pathname === '/auth/logout') {
      return redirect('/', {
        'set-cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
      });
    }

    if (!(await isAuthenticated(request, env))) return loginPage();

    return env.ASSETS.fetch(request);
  },
};
