import { initHelia } from "../services/ipfs";
import { currentPath, toUrl } from "./paths";

type ViewTag = "view-home" | "view-create" | "view-paint" | "view-account" | "view-post" | "view-saved";

const template = document.createElement("template");
template.innerHTML = `
  <main class="container"></main>
  <top-nav></top-nav>
  <style>
    .container {
      max-width: 720px;
      margin: 0 auto;
      padding: 1rem;
      padding-top: calc(1rem + env(safe-area-inset-top, 0px));
      padding-bottom: 6.5rem;
    }
    .container[data-route="paint"] {
      max-width: none;
      padding: 0;
      padding-top: env(safe-area-inset-top, 0px);
    }
  </style>
`;

class AppShell extends HTMLElement {
  private container: HTMLElement | null = null;
  private readonly viewCache = new Map<string, HTMLElement>();
  private activeView: HTMLElement | null = null;
  private readonly onPopState: () => void;
  private readonly onClick: EventListener;

  constructor() {
    super();

    this.onPopState = () => {
      this.renderRoute(currentPath());
    };

    this.onClick = (event: Event) => {
      if (!(event instanceof MouseEvent)) {
        return;
      }

      const anchor = event
        .composedPath()
        .find((node) => node instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined;

      if (!anchor) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/")) {
        return;
      }

      event.preventDefault();
      this.navigate(href);
    };
  }

  connectedCallback() {
    if (!this.container) {
      this.appendChild(template.content.cloneNode(true));
      this.container = this.querySelector(".container") as HTMLElement;
    }
    window.addEventListener("popstate", this.onPopState);
    this.addEventListener("click", this.onClick);
    this._boot();
  }

  private async _boot() {
    await initHelia();
    this.renderRoute(currentPath());
  }

  disconnectedCallback() {
    window.removeEventListener("popstate", this.onPopState);
    this.removeEventListener("click", this.onClick);
  }

  private navigate(href: string) {
    if (toUrl(href) === window.location.pathname + window.location.search) {
      return;
    }
    window.history.pushState({}, "", toUrl(href));
    this.renderRoute(currentPath());
  }

  private renderRoute(pathname: string) {
    const routeTag = this.resolveRoute(pathname);
    const cacheable = routeTag !== "view-post" && routeTag !== "view-paint";

    // Hide current view
    if (this.activeView) {
      this.activeView.style.display = "none";
    }

    if (cacheable && this.viewCache.has(routeTag)) {
      // Reuse cached view
      const view = this.viewCache.get(routeTag)!;
      view.style.display = "";
      this.activeView = view;
    } else {
      // Destroy any previous uncacheable view (e.g. old view-post)
      if (!cacheable) {
        const old = this.viewCache.get(routeTag);
        if (old) {
          old.remove();
          this.viewCache.delete(routeTag);
        }
      }

      const view = document.createElement(routeTag);
      this.container!.appendChild(view);
      this.viewCache.set(routeTag, view);
      this.activeView = view;
    }

    this.container!.dataset.route = pathname.replace(/^\//, "") || "home";
    window.dispatchEvent(new CustomEvent("route-change", { detail: { pathname } }));
  }

  private resolveRoute(pathname: string): ViewTag {
    switch (pathname) {
      case "/":
        return "view-home";
      case "/create":
        return "view-create";
      case "/paint":
        return "view-paint";
      case "/account":
        return "view-account";
      case "/post":
        return "view-post";
      case "/saved":
        return "view-saved";
      default:
        return "view-home";
    }
  }
}

export function defineAppShell() {
  if (!customElements.get("app-shell")) {
    customElements.define("app-shell", AppShell);
  }
}
