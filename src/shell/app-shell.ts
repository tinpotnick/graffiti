type ViewTag = "view-home" | "view-create";

const template = document.createElement("template");
template.innerHTML = `
  <main class="container"></main>
  <top-nav></top-nav>
  <style>
    .container {
      max-width: 720px;
      margin: 0 auto;
      padding: 1rem;
      padding-bottom: 6.5rem;
    }
  </style>
`;

class AppShell extends HTMLElement {
  private container: HTMLElement | null = null;
  private readonly onPopState: () => void;
  private readonly onClick: EventListener;

  constructor() {
    super();

    this.onPopState = () => {
      this.renderRoute(window.location.pathname);
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
    this.renderRoute(window.location.pathname);
  }

  disconnectedCallback() {
    window.removeEventListener("popstate", this.onPopState);
    this.removeEventListener("click", this.onClick);
  }

  private navigate(pathname: string) {
    if (pathname === window.location.pathname) {
      return;
    }
    window.history.pushState({}, "", pathname);
    this.renderRoute(pathname);
  }

  private renderRoute(pathname: string) {
    const routeTag = this.resolveRoute(pathname);
    this.container!.replaceChildren(document.createElement(routeTag));
  }

  private resolveRoute(pathname: string): ViewTag {
    switch (pathname) {
      case "/":
        return "view-home";
      case "/create":
        return "view-create";
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
