/**
 * Frappe rejects writes without the session's CSRF token once the session has one, which
 * happens as soon as Desk is opened with the same cookie. Desk embeds the token in its page;
 * this app asks for it. Installed over fetch so every caller is covered: the API client,
 * uploads, and frappe.call from ERPNext's own form scripts.
 */
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const TOKEN_METHOD = '/api/method/modern_erp_ui.api.desk.get_csrf_token';
let token: string | null = null;
let pending: Promise<string | null> | null = null;

export function installCsrfFetch() {
  const nativeFetch = window.fetch.bind(window);

  function refresh() {
    pending ??= nativeFetch(TOKEN_METHOD, { credentials: 'include', headers: { Accept: 'application/json' } })
      .then(async (response) => { token = response.ok ? (await response.json()).message ?? null : null; return token; })
      .catch(() => null)
      .finally(() => { pending = null; });
    return pending;
  }

  const send = (input: RequestInfo | URL, init: RequestInit | undefined, method: string) => {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (token) headers.set('X-Frappe-CSRF-Token', token);
    return nativeFetch(input instanceof Request ? input.clone() : input, { ...init, method, headers });
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    // The login call runs before there is a session to ask for a token.
    if (!UNSAFE.has(method) || !url.includes('/api/') || url.includes('/api/method/login')) return nativeFetch(input, init);
    if (!token) await refresh();
    const response = await send(input, init, method);
    if (response.status !== 400) return response;
    // A new login gives the session a new token: fetch it and try once more.
    const body = await response.clone().text();
    if (!body.includes('CSRFTokenError')) return response;
    await refresh();
    return send(input, init, method);
  };
}
