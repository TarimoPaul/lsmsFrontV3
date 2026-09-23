/**
 * Runtime config. `apiBaseUrl` is empty: the app always calls relative `/api/...`
 * paths — proxied to the Spring backend (:8086) by `ng serve` (proxy.conf.json)
 * and served same-origin by nginx in production, exactly like the Flutter web build.
 */
export const environment = {
  production: false,
  apiBaseUrl: '',
  appVersion: '3.0.0',
  /** Minutes of inactivity before automatic logout (Flutter SessionManager). */
  inactivityTimeoutMinutes: 30,
};
