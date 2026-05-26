export const BACKEND_URL =
  process.env.MY_AGENTS_BACKEND_URL ?? "http://127.0.0.1:8000";
export const FRONTEND_ORIGIN = process.env.MY_AGENTS_FRONTEND_ORIGIN;
export const SESSION_COOKIE_NAME =
  process.env.MY_AGENTS_SESSION_COOKIE_NAME ?? "my_agents_session";
export const CSRF_COOKIE_NAME =
  process.env.MY_AGENTS_CSRF_COOKIE_NAME ?? "my_agents_csrf";
export const CSRF_HEADER_NAME =
  process.env.MY_AGENTS_CSRF_HEADER_NAME ?? "X-CSRF-Token";
export const COOKIE_SECURE = process.env.MY_AGENTS_COOKIE_SECURE
  ? process.env.MY_AGENTS_COOKIE_SECURE === "true"
  : process.env.NODE_ENV === "production";
