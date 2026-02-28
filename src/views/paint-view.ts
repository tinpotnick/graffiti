import { PALETTE_HEX, PaintCanvas, PaintTool } from "../components/paint-canvas";

type Mode = "tag" | "wall";

// Lucide-style 24x24 stroke icons
const ICONS: Record<string, string> = {
  pencil: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    <path d="m15 5 4 4"/>
  </svg>`,
  eraser: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/>
    <path d="M22 21H7"/>
    <path d="m5 11 9 9"/>
  </svg>`,
  fill: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m19 11-8-8-8.5 8.5a5.5 5.5 0 0 0 7.78 7.78L19 11Z"/>
    <path d="m19 11 2-2"/>
    <circle cx="21.5" cy="21.5" r="2.5"/>
  </svg>`,
  eyedropper: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m2 22 1-1h3l9-9"/>
    <path d="M3 21v-3l9-9"/>
    <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>
  </svg>`,
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

  :host {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    background: #0a0a12;
    color: #c0bfd6;
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    box-sizing: border-box;
    --bl: #3d3d5c;
    --bd: #06060e;
    --bg-up: #1a1a2e;
    --bg-dn: #0d0d1a;
  }

  .view {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    padding-bottom: 5.5rem;
  }

  /* ── Mode tabs ──────────────────────────────── */
  .mode-tabs { display: flex; }

  .tab {
    flex: 1;
    padding: 10px 0;
    font-family: inherit;
    font-size: 7px;
    letter-spacing: 1.5px;
    cursor: pointer;
    background: var(--bg-up);
    color: #4a4a7a;
    border: 2px solid;
    border-color: var(--bl) var(--bd) var(--bd) var(--bl);
  }

  .tab.active {
    background: var(--bg-dn);
    color: #ffec27;
    border-color: var(--bd) var(--bl) var(--bl) var(--bd);
  }

  /* ── Toolbar ────────────────────────────────── */
  .toolbar {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .tools {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .tool-btn {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    cursor: pointer;
    background: var(--bg-up);
    color: #c0bfd6;
    border: 2px solid;
    border-color: var(--bl) var(--bd) var(--bd) var(--bl);
    flex-shrink: 0;
    padding: 0;
  }

  .tool-btn.active {
    background: var(--bg-dn);
    color: #ffec27;
    border-color: var(--bd) var(--bl) var(--bl) var(--bd);
  }

  .tool-btn svg {
    width: 17px;
    height: 17px;
    pointer-events: none;
  }

  .toolbar-divider {
    width: 1px;
    height: 36px;
    background: var(--bl);
    margin: 0 6px;
    flex-shrink: 0;
  }

  .palette-strip {
    display: flex;
    gap: 3px;
    flex: 1;
    overflow-x: auto;
    align-items: center;
    scrollbar-width: none;
  }

  .palette-strip::-webkit-scrollbar { display: none; }

  .swatch {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
    box-sizing: border-box;
  }

  /* ── Canvas ─────────────────────────────────── */
  .canvas-wrapper {
    position: relative;
    overflow: auto;
    border: 2px solid;
    border-color: var(--bd) var(--bl) var(--bl) var(--bd);
    background: #000;
    max-height: 55dvh;
    scrollbar-width: thin;
    scrollbar-color: var(--bl) var(--bg-dn);
  }

  /* CRT scanline overlay */
  .canvas-wrapper::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0px,
      transparent 3px,
      rgba(0,0,0,0.13) 3px,
      rgba(0,0,0,0.13) 4px
    );
    pointer-events: none;
    z-index: 1;
  }

  .swatch.active {
    border-color: #fff;
    box-shadow: inset 0 0 0 1px #000;
  }

  /* ── Actions ─────────────────────────────────── */
  .actions {
    display: flex;
    gap: 6px;
  }

  .btn {
    flex: 1;
    padding: 10px 6px;
    font-family: inherit;
    font-size: 7px;
    letter-spacing: 1px;
    cursor: pointer;
    background: var(--bg-up);
    color: #c0bfd6;
    border: 2px solid;
    border-color: var(--bl) var(--bd) var(--bd) var(--bl);
    text-align: center;
  }

  .btn:active {
    border-color: var(--bd) var(--bl) var(--bl) var(--bd);
    background: var(--bg-dn);
  }

  .btn.danger  { color: #ff004d; }
  .btn.primary { color: #00e436; }
`;

class PaintView extends HTMLElement {
  private _shadow!: ShadowRoot;
  private _canvas!: PaintCanvas;
  private _mode: Mode = "tag";
  private _tool: PaintTool = "pencil";
  private _colorIndex = 8; // red
  private _tagState: Uint8Array | null = null;
  private _wallState: Uint8Array | null = null;

  connectedCallback() {
    if (this.shadowRoot) return;
    try {
      this._shadow = this.attachShadow({ mode: "open" });
      this._buildShell();
      this._mountCanvas();
      this._bindEvents();
    } catch (err) {
      console.error("[paint-view] connectedCallback failed:", err);
    }
  }

  private _buildShell() {
    const toolButtons = Object.entries(ICONS)
      .map(
        ([id, icon]) =>
          `<button class="tool-btn${id === "pencil" ? " active" : ""}" data-tool="${id}" title="${id}">
            ${icon}
          </button>`
      )
      .join("");

    this._shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="view">
        <div class="mode-tabs">
          <button class="tab active" data-mode="tag">MY TAG</button>
          <button class="tab" data-mode="wall">THE WALL</button>
        </div>

        <div class="toolbar">
          <div class="tools">${toolButtons}</div>
          <div class="toolbar-divider"></div>
          <div class="palette-strip" id="palette"></div>
        </div>

        <div class="canvas-wrapper" id="canvas-wrap"></div>

        <div class="actions">
          <button class="btn danger"  data-action="clear">CLEAR</button>
          <button class="btn primary" data-action="download">SAVE PNG</button>
        </div>
      </div>
    `;

    // Build palette swatches
    const paletteEl = this._shadow.querySelector<HTMLElement>("#palette")!;
    PALETTE_HEX.forEach((hex, i) => {
      const sw = document.createElement("button");
      sw.className = "swatch" + (i === this._colorIndex ? " active" : "");
      sw.style.background = hex;
      sw.dataset.color = String(i);
      sw.title = hex;
      paletteEl.appendChild(sw);
    });
  }

  private _mountCanvas() {
    const wrap = this._shadow.querySelector<HTMLElement>("#canvas-wrap")!;
    const isWall = this._mode === "wall";
    const logW = isWall ? 320 : 64;
    const logH = isWall ? 180 : 64;
    const scale = isWall ? 3 : 8;

    const pc = document.createElement("paint-canvas") as PaintCanvas;
    pc.setAttribute("log-width", String(logW));
    pc.setAttribute("log-height", String(logH));
    pc.setAttribute("scale", String(scale));
    wrap.replaceChildren(pc);
    this._canvas = pc;

    // connectedCallback has run synchronously — safe to call methods now
    this._canvas.setTool(this._tool);
    this._canvas.setColor(this._colorIndex);

    this._canvas.addEventListener("color-pick", (e: Event) => {
      this._colorIndex = (e as CustomEvent<{ colorIndex: number }>).detail.colorIndex;
      this._updateColorUI();
    });

    this._canvas.addEventListener("tool-change", (e: Event) => {
      this._tool = (e as CustomEvent<{ tool: PaintTool }>).detail.tool;
      this._updateToolUI();
    });
  }

  private _bindEvents() {
    this._shadow.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;

      if (t.dataset.mode) {
        this._switchMode(t.dataset.mode as Mode);
        return;
      }

      if (t.dataset.tool) {
        this._tool = t.dataset.tool as PaintTool;
        this._canvas.setTool(this._tool);
        this._updateToolUI();
        return;
      }

      if (t.dataset.color !== undefined) {
        this._colorIndex = parseInt(t.dataset.color);
        this._canvas.setColor(this._colorIndex);
        this._updateColorUI();
        return;
      }

      if (t.dataset.action === "clear") {
        this._canvas.clear();
        return;
      }

      if (t.dataset.action === "download") {
        const a = document.createElement("a");
        a.href = this._canvas.toDataURL();
        a.download = `graffiti-${this._mode}-${Date.now()}.png`;
        a.click();
        return;
      }
    });
  }

  private _switchMode(next: Mode) {
    if (next === this._mode) return;

    // Save current canvas pixels
    if (this._mode === "tag") this._tagState = this._canvas.getPixels();
    else this._wallState = this._canvas.getPixels();

    this._mode = next;

    // Update tab appearance
    this._shadow.querySelectorAll<HTMLElement>(".tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.mode === this._mode);
    });

    // Swap canvas
    this._mountCanvas();

    // Restore saved work for this mode
    const saved = this._mode === "tag" ? this._tagState : this._wallState;
    if (saved) this._canvas.setPixels(saved);
  }

  private _updateToolUI() {
    this._shadow.querySelectorAll<HTMLElement>(".tool-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tool === this._tool);
    });
  }

  private _updateColorUI() {
    this._shadow.querySelectorAll<HTMLElement>(".swatch").forEach((sw) => {
      sw.classList.toggle("active", parseInt(sw.dataset.color!) === this._colorIndex);
    });
    const cc = this._shadow.querySelector<HTMLElement>("#current-color");
    if (cc) cc.style.background = PALETTE_HEX[this._colorIndex];
  }
}

export function definePaintView() {
  if (!customElements.get("paint-view")) {
    customElements.define("view-paint", PaintView);
  }
}
