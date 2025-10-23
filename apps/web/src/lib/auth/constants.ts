/**
 * Shared frontend auth constants
 *
 * Why we store these client-side:
 * - Access token is delivered as an httpOnly cookie, so JS cannot read it.
 *   We instead persist the server-provided access token expiry time to
 *   proactively schedule a refresh before it expires (fewer 401s).
 *
 * - Refresh token must be sent in the body to /auth/refresh. We keep it in
 *   localStorage and clear it on logout or refresh failure.

*/

// Key for the refresh token string stored in localStorage, used by:
// - AuthProvider (login/refresh/logout/init)
// - Interceptor (to decide if a 401 should attempt refresh)
export const REFRESH_TOKEN_KEY = "auth:refresh_token";

// Key for the access token expiry (epoch ms) stored in localStorage, used by:
// - AuthProvider to schedule early refresh and decide if it should refresh on init
export const ACCESS_EXP_KEY = "auth:access_exp";
