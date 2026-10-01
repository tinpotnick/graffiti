/**
 * Route paths ↔ real URLs.
 *
 * The app routes on paths like "/paint". When it's deployed under a
 * sub-path (e.g. GitHub Pages at /graffiti/), Vite's BASE_URL prefixes the
 * real URL. In dev and in Tauri the base is "/", so these are no-ops.
 */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/** The current route path, without the deploy base. */
export function currentPath(): string {
  const path = window.location.pathname;
  const route = BASE && path.startsWith(BASE) ? path.slice(BASE.length) : path;
  return route || "/";
}

/** Turn a route ("/paint?mode=wall") into a URL for the history API. */
export function toUrl(route: string): string {
  return BASE + route;
}

/** Navigate to a route and let the shell render it. */
export function navigate(route: string): void {
  window.history.pushState({}, "", toUrl(route));
  window.dispatchEvent(new PopStateEvent("popstate"));
}
