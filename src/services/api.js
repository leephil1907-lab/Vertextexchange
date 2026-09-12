/* API client for the Vertex backend (auth, KYC, support, settings). */
const TOKEN_KEY = "vt_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function call(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = "Bearer " + t;
  }
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  health: () => call("/api/health", { auth: false }),
  signup: (name, email, password, currency) => call("/api/auth/signup", { method: "POST", auth: false, body: { name, email, password, currency } }),
  login: (email, password) => call("/api/auth/login", { method: "POST", auth: false, body: { email, password } }),
  login2FA: (challenge, code) => call("/api/auth/2fa/login", { method: "POST", auth: false, body: { challenge, code } }),
  logout: () => call("/api/auth/logout", { method: "POST" }),
  me: () => call("/api/me"),
  updateMe: (patch) => call("/api/me", { method: "PATCH", body: patch }),
  changePassword: (current, next) => call("/api/auth/password", { method: "POST", body: { current, next } }),
  twoFASetup: () => call("/api/auth/2fa/setup", { method: "POST" }),
  twoFAVerify: (code) => call("/api/auth/2fa/verify", { method: "POST", body: { code } }),
  twoFADisable: (code) => call("/api/auth/2fa/disable", { method: "POST", body: { code } }),
  forgot: (email) => call("/api/auth/forgot", { method: "POST", auth: false, body: { email } }),
  reset: (token, password) => call("/api/auth/reset", { method: "POST", auth: false, body: { token, password } }),
  exportData: () => call("/api/me/export"),
  deleteAccount: (password) => call("/api/me", { method: "DELETE", body: { password } }),
  getKyc: () => call("/api/kyc"),
  submitKyc: (form) => call("/api/kyc", { method: "POST", body: form }),
  notifications: () => call("/api/notifications"),
  config: () => call("/api/config", { auth: false }),
  saveNotifSettings: (email) => call("/api/notifications/settings", { method: "PATCH", body: { email } }),
  markNotifRead: (id) => call("/api/notifications/read", { method: "POST", body: { id } }),
  notifyEvent: (kind, title, body) => call("/api/notifications/event", { method: "POST", body: { kind, title, body } }),
  testEmail: () => call("/api/notifications/test", { method: "POST" }),
  replyTicket: (id, text) => call(`/api/support/${id}/reply`, { method: "POST", body: { text } }),
  adminStats: () => call("/api/admin/stats"),
  adminUsers: () => call("/api/admin/users"),
  adminSendEmail: (payload) => call("/api/admin/email", { method: "POST", body: payload }),
  adminTickets: () => call("/api/admin/tickets"),
  adminReplyTicket: (id, text) => call(`/api/admin/tickets/${id}/reply`, { method: "POST", body: { text } }),
  adminTicketStatus: (id, status) => call(`/api/admin/tickets/${id}/status`, { method: "POST", body: { status } }),
  adminOutbox: () => call("/api/admin/outbox"),
  adminResendEmail: (id) => call(`/api/admin/outbox/${id}/resend`, { method: "POST" }),
  adminSetRole: (id, role) => call(`/api/admin/users/${id}/role`, { method: "POST", body: { role } }),
  adminSuspend: (id, suspended) => call(`/api/admin/users/${id}/suspend`, { method: "POST", body: { suspended } }),
  adminConfig: (announcement) => call("/api/admin/config", { method: "PATCH", body: { announcement } }),
  support: (payload) => call("/api/support", { method: "POST", body: payload }),
  myTickets: () => call("/api/support/mine"),
  subscribe: (email) => call("/api/subscribe", { method: "POST", auth: false, body: { email } }),
};
