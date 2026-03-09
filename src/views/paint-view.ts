import { PALETTE_HEX, PALETTE_RGB, EMPTY, PaintCanvas, PaintTool } from "../components/paint-canvas";
import { publishTag, publishWallPost } from "../services/profile";
import { catBytes } from "../services/ipfs";

type Mode = "tag" | "wall";

const ICONS: Record<string, string> = {
  undo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>
  </svg>`,
  redo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>
  </svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
  </svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>`,
  upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>`,
  pencil: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    <path d="m15 5 4 4"/>
  </svg>`,
  eraser: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/>
    <path d="M22 21H7"/><path d="m5 11 9 9"/>
  </svg>`,
  fill: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m19 11-8-8-8.5 8.5a5.5 5.5 0 0 0 7.78 7.78L19 11Z"/>
    <path d="m19 11 2-2"/><circle cx="21.5" cy="21.5" r="2.5"/>
  </svg>`,
  eyedropper: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/>
    <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>
  </svg>`,
  spray: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="6" y="9" width="7" height="12" rx="1.5"/>
    <path d="M9 9V6"/><rect x="8" y="4" width="3" height="3" rx="0.5"/>
    <circle cx="17" cy="8" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="19" cy="11.5" r="1" fill="currentColor" stroke="none"/>
    <circle cx="17" cy="14.5" r="0.8" fill="currentColor" stroke="none"/>
    <circle cx="19.5" cy="6" r="0.7" fill="currentColor" stroke="none"/>
  </svg>`,
  line: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <line x1="5" y1="19" x2="19" y2="5"/>
  </svg>`,
  rect: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="7" width="18" height="10"/>
  </svg>`,
  ellipse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <ellipse cx="12" cy="12" rx="10" ry="6"/>
  </svg>`,
  arc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <path d="M4 20 Q12 2 20 20"/>
  </svg>`,
  mirror: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="12" y1="3" x2="12" y2="21"/>
    <polyline points="7 8 4 12 7 16"/>
    <polyline points="17 8 20 12 17 16"/>
  </svg>`,
};

// Keyboard shortcut hint per tool
const TOOL_KEYS: Partial<Record<PaintTool, string>> = {
  pencil: "P", eraser: "E", fill: "F", eyedropper: "I",
  spray: "S", line: "L", rect: "R", ellipse: "O", arc: "A",
};

const FREEHAND_TOOLS: PaintTool[] = ["pencil", "eraser", "fill", "eyedropper", "spray"];
const SHAPE_TOOLS: PaintTool[]    = ["line", "rect", "ellipse", "arc"];
const ALL_TOOL_IDS: PaintTool[]   = [...FREEHAND_TOOLS, ...SHAPE_TOOLS];

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

  :host {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    background: #0a0a12;
    color: var(--px-text);
    font-family: var(--font-pixel);
    font-size: 8px;
    box-sizing: border-box;
    /* Bevel system */
    --bl: #3d3d5c;
    --bd: #06060e;
    --bg-up: #1a1a2e;
    --bg-dn: #0d0d1a;
    /* Semantic paint-zone tokens */
    --px-text:    #c0bfd6;
    --px-muted:   #4a4a7a;
    --px-active:  #ffec27;
    --px-mirror:  #29adff;
    --px-danger:  #ff004d;
    --px-success: #00e436;
  }

  .view {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    padding-bottom: 5.5rem;
  }

  /* ── Mode row ───────────────────────────────── */
  .mode-row { display: flex; align-items: stretch; gap: 6px; }
  .mode-tabs { display: flex; flex: 1; }

  .tab {
    flex: 1; padding: 10px 0;
    font-family: inherit; font-size: 7px; letter-spacing: 1.5px;
    cursor: pointer;
    background: var(--bg-up); color: var(--px-muted);
    border: 2px solid;
    border-color: var(--bl) var(--bd) var(--bd) var(--bl);
  }
  .tab.active {
    background: var(--bg-dn); color: var(--px-active);
    border-color: var(--bd) var(--bl) var(--bl) var(--bd);
  }

  .dims-badge {
    display: flex; align-items: center;
    padding: 0 8px; color: var(--px-muted);
    font-size: 6px; white-space: nowrap; letter-spacing: 1px;
  }

  /* ── Toolbar ────────────────────────────────── */
  .toolbar {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .toolbar-row {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .row-label {
    font-size: 5px; letter-spacing: 1.5px;
    color: var(--px-muted);
    flex-shrink: 0;
    width: 28px; text-align: right;
    padding-right: 4px;
  }

  .tool-group { display: flex; gap: 4px; flex-shrink: 0; }

  .tool-btn {
    width: 36px; height: 36px;
    display: grid; place-items: center;
    cursor: pointer;
    background: var(--bg-up); color: var(--px-text);
    border: 2px solid;
    border-color: var(--bl) var(--bd) var(--bd) var(--bl);
    flex-shrink: 0; padding: 0;
  }
  .tool-btn.active {
    background: var(--bg-dn); color: var(--px-active);
    border-color: var(--bd) var(--bl) var(--bl) var(--bd);
  }
  .tool-btn svg { width: 17px; height: 17px; pointer-events: none; }

  .toolbar-divider {
    width: 1px; height: 36px;
    background: var(--bl);
    margin: 0 2px; flex-shrink: 0;
  }

  /* ── Shape fill/outline toggle ──────────────── */
  .shape-mode-btn {
    height: 36px; padding: 0 7px;
    display: flex; align-items: center;
    cursor: pointer;
    background: var(--bg-up); color: var(--px-muted);
    border: 2px solid;
    border-color: var(--bl) var(--bd) var(--bd) var(--bl);
    font-family: inherit; font-size: 6px; letter-spacing: 1px;
    flex-shrink: 0;
  }
  .shape-mode-btn.active {
    background: var(--bg-dn); color: var(--px-active);
    border-color: var(--bd) var(--bl) var(--bl) var(--bd);
  }

  /* ── Brush sizes ────────────────────────────── */
  .sizes { display: flex; gap: 3px; flex-shrink: 0; }
  .size-btn {
    width: 28px; height: 36px;
    display: grid; place-items: center;
    cursor: pointer;
    background: var(--bg-up); color: var(--px-muted);
    border: 2px solid;
    border-color: var(--bl) var(--bd) var(--bd) var(--bl);
    font-family: inherit; font-size: 7px;
    padding: 0; flex-shrink: 0;
  }
  .size-btn.active {
    background: var(--bg-dn); color: var(--px-active);
    border-color: var(--bd) var(--bl) var(--bl) var(--bd);
  }

  /* ── Mirror ─────────────────────────────────── */
  .mirror-btn {
    width: 36px; height: 36px;
    display: grid; place-items: center;
    cursor: pointer;
    background: var(--bg-up); color: var(--px-muted);
    border: 2px solid;
    border-color: var(--bl) var(--bd) var(--bd) var(--bl);
    flex-shrink: 0; padding: 0;
  }
  .mirror-btn.active {
    background: var(--bg-dn); color: var(--px-mirror);
    border-color: var(--bd) var(--bl) var(--bl) var(--bd);
  }
  .mirror-btn svg { width: 17px; height: 17px; pointer-events: none; }

  /* ── Palette panel ──────────────────────────── */
  .palette-panel {
    display: flex; flex-direction: column; gap: 4px;
    border: 2px solid var(--bl);
    padding: 6px;
    background: var(--bg-dn);
  }
  .palette-panel-header { display: flex; align-items: center; gap: 6px; }
  .palette-label { color: var(--px-muted); font-size: 6px; letter-spacing: 1.5px; flex-shrink: 0; }
  .palette-groups {
    display: flex; gap: 3px; flex: 1;
    overflow-x: auto; scrollbar-width: none;
  }
  .palette-groups::-webkit-scrollbar { display: none; }
  .palette-group-btn {
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; cursor: pointer; padding: 0;
    background: var(--bg-up);
    border: 2px solid; border-color: var(--bl) var(--bd) var(--bd) var(--bl);
  }
  .palette-group-btn.active {
    background: var(--bg-dn);
    border-color: var(--bd) var(--bl) var(--bl) var(--bd);
  }
  .palette-group-dot {
    width: 12px; height: 12px; display: block; flex-shrink: 0;
    image-rendering: pixelated;
  }
  .palette-group-btn.active .palette-group-dot {
    outline: 1px solid rgba(255,255,255,0.7); outline-offset: 1px;
  }
  .palette-shades { display: flex; gap: 3px; }
  .palette-shades .swatch {
    width: 28px; height: 28px; flex-shrink: 0;
    border: 2px solid transparent; cursor: pointer; padding: 0; box-sizing: border-box;
  }
  .palette-shades .swatch.active { border-color: #fff; box-shadow: inset 0 0 0 1px #000; }

  /* ── Sign panel (avatar stamp) ─────────────── */
  .sign-panel {
    display: flex; align-items: center; gap: 6px;
    border: 2px solid var(--bl);
    padding: 6px;
    background: var(--bg-dn);
  }
  .sign-panel.hidden { display: none; }
  .sign-label { color: var(--px-muted); font-size: 6px; letter-spacing: 1.5px; flex-shrink: 0; }
  .sign-btn {
    width: 48px; height: 48px;
    cursor: pointer;
    background: var(--bg-up);
    border: 2px solid;
    border-color: var(--bl) var(--bd) var(--bd) var(--bl);
    padding: 2px; box-sizing: border-box;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .sign-btn.active {
    border-color: var(--px-active); background: var(--bg-dn);
  }
  .sign-btn:disabled { opacity: 0.35; cursor: default; }
  .sign-btn canvas { image-rendering: pixelated; display: block; }
  .sign-hint {
    color: var(--px-muted); font-size: 6px; letter-spacing: 1px;
  }

  /* ── Canvas ─────────────────────────────────── */
  .canvas-wrapper {
    position: relative; overflow: auto;
    border: 2px solid;
    border-color: var(--bd) var(--bl) var(--bl) var(--bd);
    background: #000; max-height: 55dvh;
    scrollbar-width: thin;
    scrollbar-color: var(--bl) var(--bg-dn);
  }
  .canvas-wrapper::after {
    content: ''; position: absolute; inset: 0;
    background: repeating-linear-gradient(
      to bottom, transparent 0px, transparent 3px,
      rgba(0,0,0,0.13) 3px, rgba(0,0,0,0.13) 4px
    );
    pointer-events: none; z-index: 1;
  }

  /* ── Tool-btn colour variants ────────────────────────── */
  .tool-btn.danger { color: var(--px-danger); }

  /* ── Text action button (36px tall, matches tool-btn) ── */
  .action-btn {
    height: 36px; padding: 0 8px;
    display: flex; align-items: center;
    cursor: pointer;
    background: var(--bg-up); color: var(--px-text);
    border: 2px solid;
    border-color: var(--bl) var(--bd) var(--bd) var(--bl);
    font-family: inherit; font-size: 6px; letter-spacing: 1px;
    flex-shrink: 0; white-space: nowrap;
  }
  .action-btn:active:not(:disabled) {
    border-color: var(--bd) var(--bl) var(--bl) var(--bd);
    background: var(--bg-dn);
  }
  .action-btn:disabled { opacity: 0.35; cursor: default; }
  .action-btn.publish  { color: var(--px-mirror); }

  .publish-status {
    margin: 0;
    text-align: center;
    font-family: inherit;
    font-size: 6px;
    letter-spacing: 1.5px;
    min-height: 14px;
    color: transparent;
  }
  .publish-status[data-state="loading"] { color: var(--px-active); }
  .publish-status[data-state="success"] { color: var(--px-success); }
  .publish-status[data-state="error"]   { color: var(--px-danger); }
`;

class PaintView extends HTMLElement {
  private _shadow!: ShadowRoot;
  private _canvas!: PaintCanvas;
  private _mode: Mode = "tag";
  private _tool: PaintTool = "pencil";
  private _colorIndex = 72;
  private _colorGroup = 4;
  private _brushSize = 1;
  private _mirrorX = false;
  private _shapeMode: "outline" | "fill" = "outline";
  private _signActive = false;
  private _tagState: Uint8Array | null = null;
  private _wallState: Uint8Array | null = null;
  // Tag-someone's-wall mode (set from URL params)
  private _wallRef: { cid: string; bounds: { x: number; y: number; w: number; h: number } } | null = null;

  private _keyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) this._canvas.redo();
      else this._canvas.undo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

    switch (e.key.toLowerCase()) {
      case "p": this._selectTool("pencil");    break;
      case "e": this._selectTool("eraser");    break;
      case "f": this._selectTool("fill");      break;
      case "i": this._selectTool("eyedropper"); break;
      case "s": this._selectTool("spray");     break;
      case "l": this._selectTool("line");      break;
      case "r": this._selectTool("rect");      break;
      case "o": this._selectTool("ellipse");   break;
      case "a": this._selectTool("arc");       break;
      case "m": this._toggleMirror();          break;
      case "t": this._toggleShapeMode();       break;
      case "[": this._selectBrushSize(Math.max(1, this._brushSize - 1)); break;
      case "]": this._selectBrushSize(Math.min(4, this._brushSize + 1)); break;
    }
  };

  connectedCallback() {
    if (this.shadowRoot) return;
    try {
      // Parse wallRef from URL for "tag someone's wall" mode
      const params = new URLSearchParams(window.location.search);
      const wallRefCid = params.get("wallRef");
      if (wallRefCid) {
        const wx = parseInt(params.get("wx") ?? "0");
        const wy = parseInt(params.get("wy") ?? "0");
        const ww = parseInt(params.get("ww") ?? "320");
        const wh = parseInt(params.get("wh") ?? "180");
        this._wallRef = { cid: wallRefCid, bounds: { x: wx, y: wy, w: ww, h: wh } };
        this._mode = "wall"; // force wall mode
      } else if (params.get("mode") === "wall") {
        this._mode = "wall";
      }

      this._shadow = this.attachShadow({ mode: "open" });
      this._buildShell();
      this._mountCanvas();
      this._bindEvents();

      // Load wall background for tag mode
      if (this._wallRef) {
        this._loadWallBackground();
      }
    } catch (err) {
      console.error("[paint-view] connectedCallback failed:", err);
    }
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this._keyDown);
  }

  private _buildShell() {
    const freehandBtns = FREEHAND_TOOLS.map((id) =>
      `<button class="tool-btn${id === "pencil" ? " active" : ""}" data-tool="${id}"
        title="${id} (${TOOL_KEYS[id] ?? id[0].toUpperCase()})">${ICONS[id]}</button>`
    ).join("");

    const shapeBtns = SHAPE_TOOLS.map((id) =>
      `<button class="tool-btn" data-tool="${id}"
        title="${id} (${TOOL_KEYS[id] ?? id[0].toUpperCase()})">${ICONS[id]}</button>`
    ).join("");

    this._shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="view">
        <div class="mode-row"${this._wallRef ? ' style="display:none"' : ''}>
          <div class="mode-tabs">
            <button class="tab${this._mode === 'tag' ? ' active' : ''}" data-mode="tag">MY TAG</button>
            <button class="tab${this._mode === 'wall' ? ' active' : ''}" data-mode="wall">THE WALL</button>
          </div>
          <span class="dims-badge" id="dims">${this._wallRef ? '320×180' : '64×64'}</span>
        </div>

        <div class="toolbar">
          <div class="toolbar-row">
            <span class="row-label">DRAW</span>
            <div class="tool-group">${freehandBtns}</div>
            <div class="toolbar-divider"></div>
            <div class="sizes">
              <button class="size-btn active" data-size="1" title="Brush 1px ([)">1</button>
              <button class="size-btn" data-size="2">2</button>
              <button class="size-btn" data-size="3">3</button>
              <button class="size-btn" data-size="4" title="Brush 4px (])">4</button>
            </div>
            <div class="toolbar-divider"></div>
            <button class="mirror-btn" data-action="mirror" title="Mirror X (M)">${ICONS.mirror}</button>
          </div>
          <div class="toolbar-row">
            <span class="row-label">SHAPE</span>
            <div class="tool-group">${shapeBtns}</div>
            <div class="toolbar-divider"></div>
            <button class="shape-mode-btn" id="shape-mode-btn" data-action="shape-mode"
              title="Toggle outline / fill (T)">OUT</button>
          </div>
          <div class="toolbar-row">
            <span class="row-label"></span>
            <button class="tool-btn" id="undo-btn" data-action="undo" disabled title="Undo (Ctrl+Z)">${ICONS.undo}</button>
            <button class="tool-btn" id="redo-btn" data-action="redo" disabled title="Redo (Ctrl+Shift+Z)">${ICONS.redo}</button>
            <div class="toolbar-divider"></div>
            <button class="tool-btn danger" data-action="clear" title="Clear canvas">${ICONS.trash}</button>
            <div class="toolbar-divider"></div>
            <button class="tool-btn" data-action="import" title="Import PNG">${ICONS.upload}</button>
            <button class="tool-btn" data-action="download" title="Export PNG">${ICONS.download}</button>
            <div class="toolbar-divider"></div>
            <button class="action-btn publish" id="publish-btn" data-action="publish">${this._wallRef ? 'TAG THIS WALL' : this._mode === 'tag' ? 'PUBLISH TAG' : 'POST TO WALL'}</button>
          </div>
        </div>

        <div class="palette-panel">
          <div class="palette-panel-header">
            <span class="palette-label">COLOR</span>
            <div class="palette-groups" id="palette-groups"></div>
          </div>
          <div class="palette-shades" id="palette-shades"></div>
        </div>

        <div class="sign-panel hidden" id="sign-panel">
          <span class="sign-label">SIGN</span>
          <button class="sign-btn" id="sign-btn" data-action="sign" title="Stamp your tag as signature">
            <canvas id="sign-preview" width="44" height="44"></canvas>
          </button>
          <span class="sign-hint" id="sign-hint"></span>
        </div>

        <div class="canvas-wrapper" id="canvas-wrap"></div>

        <p id="publish-status" class="publish-status"></p>
        <input type="file" id="import-input" accept="image/png" style="display:none">
      </div>
    `;

    this._buildPalette();
    this._updateSignPanel();
  }

  private _buildPalette() {
    const groupsEl = this._shadow.querySelector<HTMLElement>("#palette-groups")!;
    for (let g = 0; g < 16; g++) {
      const btn = document.createElement("button");
      btn.className = "palette-group-btn" + (g === this._colorGroup ? " active" : "");
      btn.dataset.group = String(g);
      const dot = document.createElement("span");
      dot.className = "palette-group-dot";
      dot.style.background = PALETTE_HEX[g * 16 + 8];
      btn.appendChild(dot);
      groupsEl.appendChild(btn);
    }
    this._buildShadeRow(this._colorGroup);
  }

  private _buildShadeRow(group: number) {
    const shadesEl = this._shadow.querySelector<HTMLElement>("#palette-shades")!;
    shadesEl.innerHTML = "";
    for (let s = 0; s < 16; s++) {
      const i = group * 16 + s;
      if (i >= PALETTE_HEX.length) break;
      const sw = document.createElement("button");
      sw.className = "swatch" + (i === this._colorIndex ? " active" : "");
      sw.style.background = PALETTE_HEX[i];
      sw.dataset.color = String(i);
      sw.title = PALETTE_HEX[i];
      shadesEl.appendChild(sw);
    }
  }

  /** Show or hide the sign panel based on mode, and render the tag preview. */
  private _updateSignPanel() {
    const panel = this._shadow.querySelector<HTMLElement>("#sign-panel");
    if (!panel) return;

    // Only show sign panel in wall mode
    if (this._mode !== "wall") {
      panel.classList.add("hidden");
      return;
    }
    panel.classList.remove("hidden");

    const btn = this._shadow.querySelector<HTMLButtonElement>("#sign-btn");
    const hint = this._shadow.querySelector<HTMLElement>("#sign-hint");
    const preview = this._shadow.querySelector<HTMLCanvasElement>("#sign-preview");
    const tagPixels = this._loadTagPixels();

    if (!tagPixels) {
      if (btn) btn.disabled = true;
      if (hint) hint.textContent = "DRAW A TAG FIRST";
      if (preview) {
        const ctx = preview.getContext("2d")!;
        ctx.clearRect(0, 0, preview.width, preview.height);
      }
      return;
    }

    if (btn) btn.disabled = false;
    if (hint) hint.textContent = "";
    if (preview) this._renderTagPreview(preview, tagPixels);
  }

  /** Load tag pixel data (palette indices) from localStorage. */
  private _loadTagPixels(): Uint8Array | null {
    try {
      const str = localStorage.getItem("graffiti:tag-pixels");
      if (!str) return null;
      const binary = atob(str);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      if (bytes.length !== 64 * 64) return null;
      // Check it's not completely empty
      if (bytes.every((b) => b === EMPTY)) return null;
      return bytes;
    } catch { return null; }
  }

  /** Render a 64×64 tag into a small preview canvas. */
  private _renderTagPreview(canvas: HTMLCanvasElement, pixels: Uint8Array) {
    const size = canvas.width; // 44
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(size, size);
    const d = img.data;
    const scale = size / 64;

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const srcX = Math.floor(px / scale);
        const srcY = Math.floor(py / scale);
        const idx = pixels[srcY * 64 + srcX];
        const di = (py * size + px) * 4;
        if (idx === EMPTY) {
          d[di] = 13; d[di + 1] = 13; d[di + 2] = 26; d[di + 3] = 255;
        } else {
          const [r, g, b] = PALETTE_RGB[idx];
          d[di] = r; d[di + 1] = g; d[di + 2] = b; d[di + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /** Activate the avatar stamp tool using the saved tag. */
  private _activateSign() {
    const tagPixels = this._loadTagPixels();
    if (!tagPixels) return;

    this._signActive = true;
    this._tool = "stamp";
    this._canvas.setStamp(tagPixels, 64, 64);
    this._canvas.setTool("stamp");
    this._updateToolUI();
    this._updateSignBtnUI();
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

    this._canvas.setTool(this._tool);
    this._canvas.setColor(this._colorIndex);
    this._canvas.setBrushSize(this._brushSize);
    this._canvas.setMirrorX(this._mirrorX);
    this._canvas.setShapeMode(this._shapeMode);

    const undoBtn = this._shadow.querySelector<HTMLButtonElement>("#undo-btn");
    const redoBtn = this._shadow.querySelector<HTMLButtonElement>("#redo-btn");
    if (undoBtn) undoBtn.disabled = true;
    if (redoBtn) redoBtn.disabled = true;

    this._canvas.addEventListener("color-pick", (e: Event) => {
      this._colorIndex = (e as CustomEvent<{ colorIndex: number }>).detail.colorIndex;
      this._updateColorUI();
    });
    this._canvas.addEventListener("tool-change", (e: Event) => {
      this._tool = (e as CustomEvent<{ tool: PaintTool }>).detail.tool;
      this._updateToolUI();
    });
    this._canvas.addEventListener("history-change", (e: Event) => {
      const { canUndo, canRedo } = (e as CustomEvent<{ canUndo: boolean; canRedo: boolean }>).detail;
      const ub = this._shadow.querySelector<HTMLButtonElement>("#undo-btn");
      const rb = this._shadow.querySelector<HTMLButtonElement>("#redo-btn");
      if (ub) ub.disabled = !canUndo;
      if (rb) rb.disabled = !canRedo;
    });
    this._canvas.addEventListener("canvas-change", () => {
      this._saveToStorage();
    });

    // In tag mode, start with blank canvas (delta only). Otherwise load saved state.
    if (!this._wallRef) {
      const inMemory = this._mode === "tag" ? this._tagState : this._wallState;
      if (inMemory) {
        this._canvas.setPixels(inMemory);
      } else {
        const fromStorage = this._loadFromStorage(this._mode);
        if (fromStorage) this._canvas.setPixels(fromStorage);
      }
    }

    const dimsEl = this._shadow.querySelector<HTMLElement>("#dims");
    if (dimsEl) dimsEl.textContent = `${logW}×${logH}`;
  }

  private _bindEvents() {
    document.addEventListener("keydown", this._keyDown);

    this._shadow.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;

      if (t.dataset.mode) { this._switchMode(t.dataset.mode as Mode); return; }
      if (t.dataset.tool) { this._selectTool(t.dataset.tool as PaintTool); return; }
      if (t.dataset.size !== undefined) { this._selectBrushSize(parseInt(t.dataset.size)); return; }

      // Palette group — click may land on the inner <span> dot
      const groupBtn = t.dataset.group !== undefined
        ? t
        : t.closest<HTMLElement>(".palette-group-btn");
      if (groupBtn?.dataset.group !== undefined) {
        const g = parseInt(groupBtn.dataset.group);
        if (g !== this._colorGroup) {
          this._colorGroup = g;
          this._buildShadeRow(g);
          this._updateGroupUI();
        }
        // Auto-select the same shade offset within the new group
        const shade = this._colorIndex % 16;
        const next = g * 16 + shade;
        if (next < PALETTE_HEX.length && next !== this._colorIndex) {
          this._colorIndex = next;
          this._canvas.setColor(this._colorIndex);
          this._updateColorUI();
        }
        return;
      }

      if (t.dataset.color !== undefined) {
        this._colorIndex = parseInt(t.dataset.color);
        this._canvas.setColor(this._colorIndex);
        this._updateColorUI();
        return;
      }

      if (t.dataset.action === "shape-mode") { this._toggleShapeMode(); return; }
      if (t.dataset.action === "mirror") { this._toggleMirror(); return; }
      if (t.dataset.action === "undo")   { this._canvas.undo(); return; }
      if (t.dataset.action === "redo")   { this._canvas.redo(); return; }
      if (t.dataset.action === "clear")  { this._canvas.clear(); return; }

      if (t.dataset.action === "download") {
        const a = document.createElement("a");
        a.href = this._canvas.toDataURL();
        a.download = `graffiti-${this._mode}-${Date.now()}.png`;
        a.click();
        return;
      }

      if (t.dataset.action === "import") {
        this._shadow.querySelector<HTMLInputElement>("#import-input")!.click();
        return;
      }

      if (t.dataset.action === "publish") {
        this._publishCanvas();
        return;
      }

      // Sign button — click may land on the inner <canvas>
      const signBtn = t.closest<HTMLElement>("#sign-btn");
      if (signBtn || t.dataset.action === "sign") {
        this._activateSign();
        return;
      }
    });

    this._shadow.querySelector<HTMLInputElement>("#import-input")!
      .addEventListener("change", (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) this._importPng(file);
        (e.target as HTMLInputElement).value = "";
      });
  }

  private _switchMode(next: Mode) {
    if (next === this._mode || this._wallRef) return;
    if (this._mode === "tag") this._tagState = this._canvas.getPixels();
    else this._wallState = this._canvas.getPixels();
    this._mode = next;
    this._shadow.querySelectorAll<HTMLElement>(".tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.mode === this._mode);
    });
    const publishBtn = this._shadow.querySelector<HTMLButtonElement>("#publish-btn");
    if (publishBtn) publishBtn.textContent = next === "tag" ? "PUBLISH TAG" : "POST TO WALL";
    this._signActive = false;
    this._updateSignPanel();
    this._mountCanvas();
  }

  private _selectTool(tool: PaintTool) {
    this._tool = tool;
    this._canvas.setTool(tool);
    this._updateToolUI();
    if (tool !== "stamp") {
      this._signActive = false;
      this._updateSignBtnUI();
    }
  }

  private _selectBrushSize(size: number) {
    this._brushSize = size;
    this._canvas.setBrushSize(size);
    this._updateSizeUI();
  }

  private _toggleMirror() {
    this._mirrorX = !this._mirrorX;
    this._canvas.setMirrorX(this._mirrorX);
    this._updateMirrorUI();
  }

  private _toggleShapeMode() {
    this._shapeMode = this._shapeMode === "outline" ? "fill" : "outline";
    this._canvas.setShapeMode(this._shapeMode);
    this._updateShapeModeUI();
  }

  private _updateToolUI() {
    this._shadow.querySelectorAll<HTMLElement>(".tool-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tool === this._tool);
    });
  }

  private _updateColorUI() {
    const newGroup = Math.floor(this._colorIndex / 16);
    if (newGroup !== this._colorGroup) {
      this._colorGroup = newGroup;
      this._buildShadeRow(newGroup);
      this._updateGroupUI();
    }
    this._shadow.querySelectorAll<HTMLElement>(".palette-shades .swatch").forEach((sw) => {
      sw.classList.toggle("active", parseInt(sw.dataset.color!) === this._colorIndex);
    });
  }

  private _updateGroupUI() {
    this._shadow.querySelectorAll<HTMLElement>(".palette-group-btn").forEach((btn) => {
      btn.classList.toggle("active", parseInt(btn.dataset.group!) === this._colorGroup);
    });
  }

  private _updateSizeUI() {
    this._shadow.querySelectorAll<HTMLElement>(".size-btn").forEach((btn) => {
      btn.classList.toggle("active", parseInt(btn.dataset.size!) === this._brushSize);
    });
  }

  private _updateMirrorUI() {
    this._shadow.querySelector<HTMLElement>(".mirror-btn")
      ?.classList.toggle("active", this._mirrorX);
  }

  private _updateShapeModeUI() {
    const btn = this._shadow.querySelector<HTMLButtonElement>("#shape-mode-btn");
    if (!btn) return;
    btn.textContent = this._shapeMode === "fill" ? "FILL" : "OUT";
    btn.classList.toggle("active", this._shapeMode === "fill");
  }

  private _updateSignBtnUI() {
    const btn = this._shadow.querySelector<HTMLElement>("#sign-btn");
    if (btn) btn.classList.toggle("active", this._signActive);
  }

  // ── Wall background for tag mode ─────────────────────

  /** Fetch the original wall PNG and set it as the canvas background. */
  private async _loadWallBackground() {
    if (!this._wallRef) return;
    const statusEl = this._shadow.querySelector<HTMLElement>("#publish-status");
    if (statusEl) { statusEl.textContent = "LOADING WALL…"; statusEl.dataset.state = "loading"; }

    try {
      const pngBytes = await catBytes(this._wallRef.cid);
      // Decode PNG into ImageData, place at bounds on a 320×180 canvas
      const blob = new Blob([pngBytes.buffer as ArrayBuffer], { type: "image/png" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to decode wall image"));
        img.src = url;
      });

      const oc = document.createElement("canvas");
      oc.width = 320; oc.height = 180;
      const ctx = oc.getContext("2d")!;
      const { x, y, w, h } = this._wallRef.bounds;
      ctx.drawImage(img, x, y, w, h);
      URL.revokeObjectURL(url);

      const imageData = ctx.getImageData(0, 0, 320, 180);
      this._canvas.setBackgroundImage(new Uint8Array(imageData.data.buffer));

      if (statusEl) { statusEl.textContent = ""; statusEl.dataset.state = ""; }
    } catch (err) {
      console.error("[paint-view] Failed to load wall background:", err);
      if (statusEl) { statusEl.textContent = "WALL LOAD FAILED"; statusEl.dataset.state = "error"; }
    }
  }

  // ── LocalStorage ──────────────────────────────────────

  private _saveToStorage() {
    // Don't persist wall drafts in tag mode — it's a one-off session
    if (this._wallRef) return;
    const key = this._mode === "tag" ? "graffiti:tag-pixels" : "graffiti:wall-pixels";
    try {
      const pixels = this._canvas.getPixels();
      let binary = "";
      for (let i = 0; i < pixels.length; i++) binary += String.fromCharCode(pixels[i]);
      localStorage.setItem(key, btoa(binary));
    } catch { /* unavailable */ }
  }

  private _loadFromStorage(mode: Mode): Uint8Array | null {
    const key = mode === "tag" ? "graffiti:tag-pixels" : "graffiti:wall-pixels";
    try {
      const str = localStorage.getItem(key);
      if (!str) return null;
      const binary = atob(str);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const expected = mode === "tag" ? 64 * 64 : 320 * 180;
      if (bytes.length !== expected) return null;
      return bytes;
    } catch { return null; }
  }

  // ── Import PNG ─────────────────────────────────────────────────────────────

  private _importPng(file: File) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const isWall = this._mode === "wall";
      const w = isWall ? 320 : 64;
      const h = isWall ? 180 : 64;
      const ec = document.createElement("canvas");
      ec.width = w; ec.height = h;
      const ctx = ec.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      const indices = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const a = data[i * 4 + 3];
        indices[i] = a < 128
          ? 255 // EMPTY
          : this._nearestPaletteIndex(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
      }
      this._canvas.setPixels(indices);
      this._saveToStorage();
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  /** Find the closest palette entry to an RGB value using squared Euclidean distance. */
  private _nearestPaletteIndex(r: number, g: number, b: number): number {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < PALETTE_HEX.length; i++) {
      const h = PALETTE_HEX[i];
      const pr = parseInt(h.slice(1, 3), 16);
      const pg = parseInt(h.slice(3, 5), 16);
      const pb = parseInt(h.slice(5, 7), 16);
      const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  // ── Publish to IPFS ────────────────────────────────────────────────────────

  /**
   * Compute the bounding box of non-empty pixels.
   * Returns null if the canvas is completely empty.
   */
  private _getBounds(pixels: Uint8Array, w: number, h: number, pad: number):
    { x: number; y: number; w: number; h: number } | null {
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (pixels[y * w + x] !== EMPTY) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null; // completely empty
    // Apply padding, clamped to canvas bounds
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  /** Export a cropped region of the palette-index pixel array as a PNG Uint8Array. */
  private _cropToPng(
    pixels: Uint8Array, canvasW: number,
    bounds: { x: number; y: number; w: number; h: number },
  ): Uint8Array {
    const { x: bx, y: by, w: bw, h: bh } = bounds;
    const ec = document.createElement("canvas");
    ec.width = bw; ec.height = bh;
    const ctx = ec.getContext("2d")!;
    const img = ctx.createImageData(bw, bh);
    const d = img.data;
    for (let row = 0; row < bh; row++) {
      for (let col = 0; col < bw; col++) {
        const idx = pixels[(by + row) * canvasW + (bx + col)];
        const di = (row * bw + col) * 4;
        if (idx === EMPTY) {
          d[di + 3] = 0;
        } else {
          const [r, g, b] = PALETTE_RGB[idx];
          d[di] = r; d[di + 1] = g; d[di + 2] = b; d[di + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    const dataUrl = ec.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1];
    const binary = atob(base64);
    const png = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) png[i] = binary.charCodeAt(i);
    return png;
  }

  private async _publishCanvas() {
    const publishBtn = this._shadow.querySelector<HTMLButtonElement>("#publish-btn");
    const statusEl   = this._shadow.querySelector<HTMLElement>("#publish-status");
    if (!publishBtn || publishBtn.disabled) return;

    // For wall mode, check for empty canvas before publishing
    if (this._mode === "wall") {
      const pixels = this._canvas.getPixels();
      const bounds = this._getBounds(pixels, 320, 180, 4);
      if (!bounds) {
        if (statusEl) { statusEl.textContent = "NOTHING TO POST"; statusEl.dataset.state = "error"; }
        setTimeout(() => {
          if (statusEl) { statusEl.textContent = ""; statusEl.dataset.state = ""; }
        }, 3000);
        return;
      }
    }

    publishBtn.disabled = true;
    if (statusEl) { statusEl.textContent = "PUBLISHING..."; statusEl.dataset.state = "loading"; }

    try {
      if (this._mode === "tag") {
        // Tag: export full 64×64 PNG as before
        const dataUrl = this._canvas.toDataURL();
        const base64  = dataUrl.split(",")[1];
        const binary  = atob(base64);
        const png     = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) png[i] = binary.charCodeAt(i);
        await publishTag(png);
      } else {
        // Wall: crop to content bounding box
        const pixels = this._canvas.getPixels();
        const bounds = this._getBounds(pixels, 320, 180, 4)!;
        const png = this._cropToPng(pixels, 320, bounds);
        await publishWallPost(png, "", bounds, this._wallRef ?? undefined);
      }

      if (statusEl) { statusEl.textContent = "PUBLISHED"; statusEl.dataset.state = "success"; }
      setTimeout(() => {
        if (statusEl) { statusEl.textContent = ""; statusEl.dataset.state = ""; }
      }, 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[paint-view] publish failed:", msg);
      if (statusEl) {
        statusEl.textContent = msg.slice(0, 60);
        statusEl.dataset.state = "error";
      }
      setTimeout(() => {
        if (statusEl) { statusEl.textContent = ""; statusEl.dataset.state = ""; }
      }, 8000);
    } finally {
      publishBtn.disabled = false;
    }
  }
}

export function definePaintView() {
  if (!customElements.get("view-paint")) {
    customElements.define("view-paint", PaintView);
  }
}
