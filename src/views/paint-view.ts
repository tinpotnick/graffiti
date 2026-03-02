import { PALETTE_HEX, PaintCanvas, PaintTool } from "../components/paint-canvas";
import { STAMP_CATEGORIES, StampDef } from "../data/stamps";

type Mode = "tag" | "wall";

const ICONS: Record<string, string> = {
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

  /* ── Stamp panel ────────────────────────────── */
  .stamp-panel {
    display: flex; flex-direction: column; gap: 4px;
    border: 2px solid var(--bl);
    padding: 6px;
    background: var(--bg-dn);
  }
  .stamp-panel-header { display: flex; align-items: center; gap: 6px; }
  .stamp-label { color: var(--px-muted); font-size: 6px; letter-spacing: 1.5px; flex-shrink: 0; }
  .stamp-cats { display: flex; gap: 3px; flex-wrap: wrap; }
  .stamp-cat-btn {
    padding: 4px 7px;
    font-family: inherit; font-size: 6px; letter-spacing: 1px;
    cursor: pointer;
    background: var(--bg-up); color: var(--px-muted);
    border: 2px solid;
    border-color: var(--bl) var(--bd) var(--bd) var(--bl);
  }
  .stamp-cat-btn.active {
    background: var(--bg-dn); color: var(--px-active);
    border-color: var(--bd) var(--bl) var(--bl) var(--bd);
  }
  .stamp-grid {
    display: flex; gap: 4px;
    overflow-x: auto; scrollbar-width: none;
  }
  .stamp-grid::-webkit-scrollbar { display: none; }
  .stamp-thumb {
    width: 36px; height: 36px;
    cursor: pointer;
    background: var(--bg-up);
    border: 2px solid;
    border-color: var(--bl) var(--bd) var(--bd) var(--bl);
    flex-shrink: 0; padding: 2px;
    box-sizing: border-box;
    display: flex; align-items: center; justify-content: center;
  }
  .stamp-thumb.active { border-color: var(--px-active); background: var(--bg-dn); }
  .stamp-thumb canvas { image-rendering: pixelated; display: block; }

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

  /* ── Actions ─────────────────────────────────── */
  .actions { display: flex; gap: 6px; }
  .btn {
    flex: 1; padding: 10px 6px;
    font-family: inherit; font-size: 7px; letter-spacing: 1px;
    cursor: pointer;
    background: var(--bg-up); color: var(--px-text);
    border: 2px solid;
    border-color: var(--bl) var(--bd) var(--bd) var(--bl);
    text-align: center;
  }
  .btn:active:not(:disabled) {
    border-color: var(--bd) var(--bl) var(--bl) var(--bd);
    background: var(--bg-dn);
  }
  .btn:disabled { opacity: 0.35; cursor: default; }
  .btn.danger  { color: var(--px-danger); }
  .btn.primary { color: var(--px-success); }
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
  private _selectedStamp: StampDef | null = null;
  private _selectedCat = STAMP_CATEGORIES[0].id;
  private _tagState: Uint8Array | null = null;
  private _wallState: Uint8Array | null = null;

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
      this._shadow = this.attachShadow({ mode: "open" });
      this._buildShell();
      this._mountCanvas();
      this._bindEvents();
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
        <div class="mode-row">
          <div class="mode-tabs">
            <button class="tab active" data-mode="tag">MY TAG</button>
            <button class="tab" data-mode="wall">THE WALL</button>
          </div>
          <span class="dims-badge" id="dims">64×64</span>
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
        </div>

        <div class="palette-panel">
          <div class="palette-panel-header">
            <span class="palette-label">COLOR</span>
            <div class="palette-groups" id="palette-groups"></div>
          </div>
          <div class="palette-shades" id="palette-shades"></div>
        </div>

        <div class="stamp-panel">
          <div class="stamp-panel-header">
            <span class="stamp-label">STAMPS</span>
            <div class="stamp-cats" id="stamp-cats"></div>
          </div>
          <div class="stamp-grid" id="stamp-grid"></div>
        </div>

        <div class="canvas-wrapper" id="canvas-wrap"></div>

        <div class="actions">
          <button class="btn" id="undo-btn" data-action="undo" disabled>UNDO</button>
          <button class="btn" id="redo-btn" data-action="redo" disabled>REDO</button>
          <button class="btn danger"  data-action="clear">CLEAR</button>
          <button class="btn primary" data-action="download">SAVE PNG</button>
        </div>
      </div>
    `;

    this._buildPalette();

    // Stamp category buttons
    const catsEl = this._shadow.querySelector<HTMLElement>("#stamp-cats")!;
    STAMP_CATEGORIES.forEach((cat, i) => {
      const btn = document.createElement("button");
      btn.className = "stamp-cat-btn" + (i === 0 ? " active" : "");
      btn.dataset.cat = cat.id;
      btn.textContent = cat.label;
      catsEl.appendChild(btn);
    });

    this._buildStampGrid(this._selectedCat);
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

  private _buildStampGrid(catId: string) {
    const grid = this._shadow.querySelector<HTMLElement>("#stamp-grid");
    if (!grid) return;
    grid.innerHTML = "";
    const cat = STAMP_CATEGORIES.find((c) => c.id === catId);
    if (!cat) return;
    cat.stamps.forEach((stamp) => {
      const btn = document.createElement("button");
      btn.className = "stamp-thumb" + (this._selectedStamp?.id === stamp.id ? " active" : "");
      btn.dataset.stampId = stamp.id;
      btn.dataset.catId = catId;
      btn.title = stamp.label;
      btn.appendChild(this._renderStampThumb(stamp));
      grid.appendChild(btn);
    });
  }

  private _renderStampThumb(stamp: { data: Uint8Array; width: number; height: number }): HTMLCanvasElement {
    const scale = 2;
    const c = document.createElement("canvas");
    c.width = stamp.width * scale;
    c.height = stamp.height * scale;
    c.style.width = "32px";
    c.style.height = "32px";
    const ctx = c.getContext("2d")!;
    const THUMB_BG  = "#0d0d1a";
    const THUMB_FG1 = "#c0bfd6";
    const THUMB_FG2 = "#ffffff";  // pure white — matches palette index 31
    ctx.fillStyle = THUMB_BG;
    ctx.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < stamp.height; y++) {
      for (let x = 0; x < stamp.width; x++) {
        const v = stamp.data[y * stamp.width + x];
        if (!v) continue;
        ctx.fillStyle = v === 1 ? THUMB_FG1 : THUMB_FG2;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return c;
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
    if (this._selectedStamp) {
      this._canvas.setStamp(
        this._selectedStamp.data,
        this._selectedStamp.width,
        this._selectedStamp.height
      );
    }

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

    const inMemory = this._mode === "tag" ? this._tagState : this._wallState;
    if (inMemory) {
      this._canvas.setPixels(inMemory);
    } else {
      const fromStorage = this._loadFromStorage(this._mode);
      if (fromStorage) this._canvas.setPixels(fromStorage);
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

      if (t.dataset.group !== undefined) {
        const g = parseInt(t.dataset.group);
        if (g !== this._colorGroup) {
          this._colorGroup = g;
          this._buildShadeRow(g);
          this._updateGroupUI();
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

      if (t.dataset.cat !== undefined) {
        this._selectedCat = t.dataset.cat;
        this._shadow.querySelectorAll<HTMLElement>(".stamp-cat-btn").forEach((b) => {
          b.classList.toggle("active", b.dataset.cat === this._selectedCat);
        });
        this._buildStampGrid(this._selectedCat);
        return;
      }

      // Stamp thumb — click may land on the inner <canvas>
      const thumbBtn = t.classList.contains("stamp-thumb")
        ? t
        : t.closest<HTMLElement>(".stamp-thumb");
      if (thumbBtn?.dataset.stampId) {
        const cat = STAMP_CATEGORIES.find((c) => c.id === thumbBtn.dataset.catId);
        const stamp = cat?.stamps.find((s) => s.id === thumbBtn.dataset.stampId);
        if (stamp) this._selectStamp(stamp);
        return;
      }
    });
  }

  private _switchMode(next: Mode) {
    if (next === this._mode) return;
    if (this._mode === "tag") this._tagState = this._canvas.getPixels();
    else this._wallState = this._canvas.getPixels();
    this._mode = next;
    this._shadow.querySelectorAll<HTMLElement>(".tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.mode === this._mode);
    });
    this._mountCanvas();
  }

  private _selectTool(tool: PaintTool) {
    this._tool = tool;
    this._canvas.setTool(tool);
    this._updateToolUI();
    if (tool !== "stamp") {
      this._selectedStamp = null;
      this._updateStampUI();
    }
  }

  private _selectStamp(stamp: StampDef) {
    this._selectedStamp = stamp;
    this._tool = "stamp";
    this._canvas.setStamp(stamp.data, stamp.width, stamp.height);
    this._canvas.setTool("stamp");
    this._updateToolUI();
    this._updateStampUI();
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

  private _updateStampUI() {
    this._shadow.querySelectorAll<HTMLElement>(".stamp-thumb").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.stampId === this._selectedStamp?.id);
    });
  }

  // ── LocalStorage ──────────────────────────────────────

  private _saveToStorage() {
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
}

export function definePaintView() {
  if (!customElements.get("view-paint")) {
    customElements.define("view-paint", PaintView);
  }
}
