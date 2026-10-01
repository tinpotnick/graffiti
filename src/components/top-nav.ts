import { currentPath } from "../shell/paths";

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
    <a class="nav-button" href="/saved" aria-label="Saved">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </a>
    <a class="nav-button" href="/account" aria-label="Account">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke-linecap="round"/>
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
      background: linear-gradient(180deg, var(--nav-bg-from), var(--nav-bg-to));
      border-top: 1px solid var(--nav-border-top);
      backdrop-filter: blur(18px);
      box-shadow: var(--shadow-nav);
      z-index: 10;
    }
    .nav-button {
      text-decoration: none;
      display: grid;
      place-items: center;
      width: 3rem;
      height: 3rem;
      border-radius: var(--radius-pill);
      color: var(--text);
      background: var(--surface-raised);
      border: 1px solid var(--nav-btn-border);
      box-shadow: var(--shadow-btn);
      transition: transform 150ms ease, box-shadow 150ms ease, filter 150ms ease;
    }
    .nav-button:hover {
      transform: translateY(-1px);
      box-shadow: var(--shadow-btn-hover);
    }
    .nav-button:active {
      transform: translateY(0);
      filter: brightness(0.97);
    }
    .nav-button.active {
      background: var(--accent);
      color: var(--text-inverse);
      border-color: var(--nav-active-border);
      box-shadow: var(--shadow-btn-active);
    }
    .nav-button.create.active {
      background: var(--accent);
      color: var(--text-inverse);
      border: 1px solid var(--nav-active-border);
      box-shadow: var(--shadow-btn-active);
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
    this._updateActive(currentPath());
  };

  constructor() {
    super();
    this._root = this.attachShadow({ mode: "open" });
    this._root.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    window.addEventListener("route-change", this._onRouteChange);
    window.addEventListener("popstate", this._onPopState);
    this._updateActive(currentPath());
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
