const template = document.createElement("template");
template.innerHTML = `
  <nav class="bottom-nav" aria-label="Primary">
    <a class="nav-button" href="/" aria-label="The Wall">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="4" y="6" width="7" height="6" rx="1.2" />
        <rect x="13" y="6" width="7" height="6" rx="1.2" />
        <rect x="4" y="14" width="7" height="6" rx="1.2" />
        <rect x="13" y="14" width="7" height="6" rx="1.2" />
      </svg>
    </a>
    <a class="nav-button" href="/paint" aria-label="Paint">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <!-- spray can body -->
        <rect style="fill:none" x="7" y="9" width="6" height="12" rx="1.5"/>
        <!-- nozzle -->
        <rect style="fill:none" x="9" y="5" width="2" height="5" rx="0.5"/>
        <!-- spray dots -->
        <circle style="stroke:none" cx="16.5" cy="8"  r="1.4"/>
        <circle style="stroke:none" cx="18.5" cy="11" r="1.1"/>
        <circle style="stroke:none" cx="16"   cy="13" r="0.9"/>
      </svg>
    </a>
    <a class="nav-button create" href="/create" aria-label="Create">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 5.25v13.5M5.25 12h13.5" />
      </svg>
    </a>
  </nav>
  <style>
    .bottom-nav {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      gap: 0.7rem;
      justify-content: center;
      align-items: center;
      padding: 0.75rem 1rem calc(0.85rem + env(safe-area-inset-bottom));
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.98));
      border-top: 1px solid rgba(0, 0, 0, 0.06);
      backdrop-filter: blur(18px);
      box-shadow: 0 -14px 30px rgba(0, 0, 0, 0.08);
      z-index: 10;
    }
    .nav-button {
      text-decoration: none;
      display: grid;
      place-items: center;
      width: 3rem;
      height: 3rem;
      border-radius: 999px;
      color: #0b0b0b;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.08);
      box-shadow: 0 12px 22px rgba(0, 0, 0, 0.14);
      transition: transform 150ms ease, box-shadow 150ms ease, filter 150ms ease;
    }
    .nav-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 14px 24px rgba(0, 0, 0, 0.18);
    }
    .nav-button:active {
      transform: translateY(0);
      filter: brightness(0.97);
    }
    .nav-button.active:not(.create) {
      background: #0d0d0d;
      color: #f6f6f6;
      border-color: rgba(255, 255, 255, 0.08);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
    }
    .nav-button.create {
      background: #0d0d0d;
      color: #f6f6f6;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
    }
    .nav-button svg {
      width: 1.25rem;
      height: 1.25rem;
      fill: currentColor;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  </style>
`;

class TopNav extends HTMLElement {
  private _root: ShadowRoot;

  private _onRouteChange = (e: Event) => {
    const { pathname } = (e as CustomEvent<{ pathname: string }>).detail;
    this._updateActive(pathname);
  };

  private _onPopState = () => {
    this._updateActive(window.location.pathname);
  };

  constructor() {
    super();
    this._root = this.attachShadow({ mode: "open" });
    this._root.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    window.addEventListener("route-change", this._onRouteChange);
    window.addEventListener("popstate", this._onPopState);
    this._updateActive(window.location.pathname);
  }

  disconnectedCallback() {
    window.removeEventListener("route-change", this._onRouteChange);
    window.removeEventListener("popstate", this._onPopState);
  }

  private _updateActive(pathname: string) {
    this._root.querySelectorAll<HTMLAnchorElement>(".nav-button").forEach((btn) => {
      const href = btn.getAttribute("href") ?? "/";
      const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
      btn.classList.toggle("active", active);
    });
  }
}

export function defineTopNav() {
  if (!customElements.get("top-nav")) {
    customElements.define("top-nav", TopNav);
  }
}
