export const PALETTE_HEX: string[] = [
  // ── G0: Blacks & dark grays ── 0-15
  "#050505","#0e0e0e","#181818","#222222","#2e2e2e","#3a3a3a","#484848","#565656",
  "#666666","#787878","#8a8a8a","#9c9c9c","#aeaeae","#c0c0c0","#d8d8d8","#ededed",
  // ── G1: Cool grays & whites ── 16-31
  "#1a1a22","#252530","#32323e","#3e3e4c","#4e4e5e","#5e5e70","#6e6e82","#808094",
  "#9494a8","#a8a8bc","#bcbcd0","#d0d0e0","#e0e0ec","#ececf4","#f6f6fa","#ffffff",
  // ── G2: Warm neutrals — concrete, sand, cream ── 32-47
  "#1a1510","#261e16","#342a1e","#443822","#564828","#6a5a34","#7e6e44","#948054",
  "#aa9464","#bea87a","#cebc8e","#dcd0a4","#e8e0b8","#f0eacc","#f6f2de","#faf8ee",
  // ── G3: Metallics — dark bronze → burnished gold → chrome ── 48-63
  "#1c1200","#2e1e00","#402a00","#563800","#704800","#8a5c0a","#a8700e","#c48418",
  "#d89828","#e8ac38","#f0c050","#f8d468","#fce090","#feeab8","#fff0d0","#fff8e8",
  // ── G4: Reds — dark maroon → signal red → coral ── 64-79
  "#1a0000","#2e0000","#440000","#5e0408","#780a10","#920e18","#ac1820","#c82028",
  "#e03030","#f04040","#f85858","#ff6e6e","#ff8c8c","#ffa8a8","#ffc4c4","#ffe0e0",
  // ── G5: Oranges — dark amber → fire orange → peach ── 80-95
  "#1e0c00","#301400","#481e00","#602c00","#783c00","#944c00","#b06000","#cc7800",
  "#e08c10","#f0a020","#f8b438","#ffc454","#ffd47a","#ffe09c","#ffecba","#fff4d8",
  // ── G6: Yellows — deep gold → chrome yellow → pale lemon ── 96-111
  "#141000","#201800","#302400","#463400","#5e4800","#7a6000","#9e7c00","#c09800",
  "#d8b000","#f0cc00","#f8dc18","#ffe835","#ffee60","#fff280","#fff6a8","#fffbd0",
  // ── G7: Limes & acid greens — olive → neon lime ── 112-127
  "#0c1200","#141e00","#1e2c00","#2c3c00","#3e5000","#546600","#6c8000","#8ea000",
  "#aac000","#c2d800","#d8ec10","#e8f428","#f0f84c","#f6fc74","#fafeaa","#fdffd8",
  // ── G8: Greens — forest → grass → mint ── 128-143
  "#001400","#002000","#003000","#004400","#0a5c0a","#147814","#1e9020","#28a828",
  "#38c038","#4ed84e","#68e868","#88f488","#a8f8a8","#c4fcc4","#deffde","#f0fff0",
  // ── G9: Teals & cyans — dark teal → aqua → pale cyan ── 144-159
  "#001414","#002020","#003030","#004444","#005858","#007070","#008c8c","#00a8a8",
  "#00c0c0","#10d4d4","#28e4e4","#50eef0","#80f4f8","#a8f8fc","#ccfcff","#eeffff",
  // ── G10: Blues — deep navy → electric blue → sky ── 160-175
  "#000018","#000828","#000e40","#001460","#001e80","#0030a0","#0048c0","#0060d8",
  "#1478ee","#2c90ff","#50aaff","#74c0ff","#96d4ff","#b8e4ff","#d4f0ff","#eef8ff",
  // ── G11: Purples — deep indigo → vivid purple → lavender ── 176-191
  "#0c0018","#140028","#1e0040","#2c0060","#3c0080","#5000a0","#6610c0","#8020d8",
  "#9830ec","#b048f8","#c468ff","#d484ff","#e0a0ff","#ecc0ff","#f6dcff","#fdf0ff",
  // ── G12: Pinks & magentas — dark rose → shock pink → pale blush ── 192-207
  "#180010","#280018","#3c0028","#560038","#700048","#900060","#b00878","#cc1090",
  "#e020a8","#f038bc","#f858cc","#ff76da","#ff98e4","#ffb8ee","#ffd4f6","#fff0fc",
  // ── G13: Browns & earths — dark brown → burnt sienna → tan ── 208-223
  "#100600","#1e0e00","#2e1400","#401c00","#582800","#703600","#884400","#a05400",
  "#b86418","#cc7830","#dc8c48","#e8a064","#f0b47e","#f6c89a","#fcdcb8","#feeedd",
  // ── G14: Skin tones — deepest to lightest ── 224-239
  "#1a0a04","#2c1208","#401c0c","#5a2812","#743420","#8c4430","#a45640","#bc6a52",
  "#cc7e64","#dc9476","#e8a888","#f0bc9e","#f6ceb4","#fadec8","#fdeedc","#fff4ee",
  // ── G15: Fluorescents — 15 distinct neon day-glo hues ── 240-254
  // (index 255 is reserved as EMPTY sentinel — only 15 swatches show for this group)
  "#ff0040","#ff2000","#ff5500","#ff8800","#ffcc00","#e8ff00","#a0ff00","#44ff00",
  "#00ff44","#00ffaa","#00ffee","#00aaff","#0055ff","#6600ff","#cc00ff",
];

export const PALETTE_RGB: [number, number, number][] = PALETTE_HEX.map((h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
});

export type PaintTool =
  | "pencil" | "eraser" | "fill" | "eyedropper" | "spray" | "stamp"
  | "line" | "rect" | "ellipse" | "arc";

export const EMPTY = 255;
const MAX_HISTORY = 50;

const SHAPE_TOOLS = new Set<PaintTool>(["line", "rect", "ellipse"]);

export class PaintCanvas extends HTMLElement {
  private _canvas!: HTMLCanvasElement;
  private _ctx!: CanvasRenderingContext2D;
  private _pixels!: Uint8Array;
  private _drawing = false;
  private _lastX = -1;
  private _lastY = -1;
  private _undoStack: Uint8Array[] = [];
  private _redoStack: Uint8Array[] = [];
  private _sprayTimer: number | null = null;
  // Rubber-band state for shape tools
  private _snapPixels: Uint8Array | null = null;
  private _shapeStartX = -1;
  private _shapeStartY = -1;
  // Arc tool: 2-phase (chord then bow)
  private _arcPhase: 0 | 1 = 0;
  private _arcP0 = { x: 0, y: 0 };
  private _arcP2 = { x: 0, y: 0 };

  logWidth = 64;
  logHeight = 64;
  scale = 8;
  tool: PaintTool = "pencil";
  colorIndex = 72;
  brushSize = 1;
  mirrorX = false;
  shapeMode: "outline" | "fill" = "outline";
  stampData: Uint8Array | null = null;
  stampWidth = 16;
  stampHeight = 16;

  connectedCallback() {
    if (this.shadowRoot) return;
    try {
      this.logWidth = parseInt(this.getAttribute("log-width") ?? "64");
      this.logHeight = parseInt(this.getAttribute("log-height") ?? "64");
      this.scale = parseInt(this.getAttribute("scale") ?? "8");

      this._pixels = new Uint8Array(this.logWidth * this.logHeight).fill(EMPTY);

      const shadow = this.attachShadow({ mode: "open" });
      this._canvas = document.createElement("canvas");
      this._canvas.width = this.logWidth * this.scale;
      this._canvas.height = this.logHeight * this.scale;
      this._canvas.style.cssText =
        "display:block;cursor:crosshair;image-rendering:pixelated;touch-action:none;";
      this._ctx = this._canvas.getContext("2d")!;
      shadow.appendChild(this._canvas);

      this._canvas.addEventListener("mousedown", this._onMouseDown);
      this._canvas.addEventListener("mousemove", this._onMouseMove);
      document.addEventListener("mouseup", this._onMouseUp);
      this._canvas.addEventListener("touchstart", this._onTouchStart, { passive: false });
      this._canvas.addEventListener("touchmove", this._onTouchMove, { passive: false });
      document.addEventListener("touchend", this._onMouseUp);
      this._canvas.addEventListener("contextmenu", (e) => e.preventDefault());

      this._render();
    } catch (err) {
      console.error("[paint-canvas] connectedCallback failed:", err);
    }
  }

  disconnectedCallback() {
    document.removeEventListener("mouseup", this._onMouseUp);
    document.removeEventListener("touchend", this._onMouseUp);
    this._stopSpray();
  }

  private _pos(clientX: number, clientY: number): [number, number] {
    const rect = this._canvas.getBoundingClientRect();
    return [
      Math.max(0, Math.min(this.logWidth - 1, Math.floor((clientX - rect.left) / this.scale))),
      Math.max(0, Math.min(this.logHeight - 1, Math.floor((clientY - rect.top) / this.scale))),
    ];
  }

  // ── Mouse/touch handlers ──────────────────────────────

  private _onMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    // Arc phase 1: second gesture — no new history entry, arc not yet committed
    if (this.tool === "arc" && this._arcPhase === 1) {
      this._drawing = true;
      const [x, y] = this._pos(e.clientX, e.clientY);
      this._lastX = x; this._lastY = y;
      this._startStroke(x, y);
      return;
    }
    this._pushHistory();
    this._drawing = true;
    const [x, y] = this._pos(e.clientX, e.clientY);
    this._lastX = x;
    this._lastY = y;
    this._startStroke(x, y);
  };

  private _onMouseMove = (e: MouseEvent) => {
    if (!this._drawing) return;
    const [x, y] = this._pos(e.clientX, e.clientY);
    this._continueStroke(x, y);
  };

  private _onMouseUp = () => {
    if (!this._drawing) return;
    this._drawing = false;
    this._stopSpray();
    // Arc phase 0 complete: chord defined, now wait for bow gesture
    if (this.tool === "arc" && this._arcPhase === 0) {
      this._arcP2 = { x: this._lastX, y: this._lastY };
      this._arcPhase = 1;
      // Restore clean pixels — chord preview was temporary
      if (this._snapPixels) { this._pixels.set(this._snapPixels); this._render(); }
      this._lastX = -1; this._lastY = -1;
      return; // keep _snapPixels alive for phase 1
    }
    // Arc phase 1 complete (or any other tool)
    if (this.tool === "arc") this._arcPhase = 0;
    this._snapPixels = null;
    this._lastX = -1;
    this._lastY = -1;
    this.dispatchEvent(
      new CustomEvent("canvas-change", { detail: { dataUrl: this.toDataURL() }, bubbles: true })
    );
  };

  private _onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    // Arc phase 1: second gesture — no new history entry
    if (this.tool === "arc" && this._arcPhase === 1) {
      this._drawing = true;
      const [x, y] = this._pos(t.clientX, t.clientY);
      this._lastX = x; this._lastY = y;
      this._startStroke(x, y);
      return;
    }
    this._pushHistory();
    this._drawing = true;
    const [x, y] = this._pos(t.clientX, t.clientY);
    this._lastX = x;
    this._lastY = y;
    this._startStroke(x, y);
  };

  private _onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (!this._drawing) return;
    const t = e.touches[0];
    const [x, y] = this._pos(t.clientX, t.clientY);
    this._continueStroke(x, y);
  };

  // Unified stroke start (mouse + touch)
  private _startStroke(x: number, y: number) {
    if (this.tool === "spray") {
      this._startSpray();
    } else if (this.tool === "stamp") {
      this._placeStamp(x, y);
      this._render();
    } else if (this.tool === "arc") {
      if (this._arcPhase === 0) {
        this._snapPixels = new Uint8Array(this._pixels);
        this._arcP0 = { x, y };
      } else {
        // Phase 1: restore clean canvas, draw bezier with current pos as initial control
        this._pixels.set(this._snapPixels!);
        this._drawQuadBezier(this._arcP0, { x, y }, this._arcP2);
        this._render();
      }
    } else if (SHAPE_TOOLS.has(this.tool)) {
      this._snapPixels = new Uint8Array(this._pixels);
      this._shapeStartX = x;
      this._shapeStartY = y;
      // Don't draw until drag begins
    } else {
      this._apply(x, y);
    }
  }

  // Unified stroke continue (mouse + touch)
  private _continueStroke(x: number, y: number) {
    if (this.tool === "spray") {
      this._lastX = x;
      this._lastY = y;
    } else if (this.tool === "stamp") {
      // stamps only place on click
    } else if (this.tool === "arc" && this._snapPixels) {
      this._pixels.set(this._snapPixels);
      if (this._arcPhase === 0) {
        // Preview chord
        this._linePrim(this._arcP0.x, this._arcP0.y, x, y, this.colorIndex);
      } else {
        // Preview arc with control point at cursor
        this._drawQuadBezier(this._arcP0, { x, y }, this._arcP2);
      }
      this._render();
      this._lastX = x;
      this._lastY = y;
    } else if (SHAPE_TOOLS.has(this.tool) && this._snapPixels) {
      // Rubber-band: rewind and redraw every frame
      this._pixels.set(this._snapPixels);
      this._drawShape(this._shapeStartX, this._shapeStartY, x, y);
      this._render();
      this._lastX = x;
      this._lastY = y;
    } else if (x !== this._lastX || y !== this._lastY) {
      this._line(this._lastX, this._lastY, x, y);
      this._lastX = x;
      this._lastY = y;
    }
  }

  // ── Spray ────────────────────────────────────────────

  private _startSpray() {
    const tick = () => {
      if (!this._drawing) return;
      this._doSpray(this._lastX, this._lastY);
      this._render();
      this._sprayTimer = requestAnimationFrame(tick);
    };
    this._sprayTimer = requestAnimationFrame(tick);
  }

  private _stopSpray() {
    if (this._sprayTimer !== null) {
      cancelAnimationFrame(this._sprayTimer);
      this._sprayTimer = null;
    }
  }

  private _doSpray(cx: number, cy: number) {
    const radius = 4 + this.brushSize * 2;
    const density = 6 + this.brushSize * 3;
    for (let i = 0; i < density; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      const x = Math.round(cx + Math.cos(angle) * r);
      const y = Math.round(cy + Math.sin(angle) * r);
      this._setPixel(x, y, this.colorIndex);
    }
  }

  // ── Stamp ────────────────────────────────────────────

  private _placeStamp(cx: number, cy: number) {
    if (!this.stampData) return;
    const sw = this.stampWidth, sh = this.stampHeight;
    const offX = Math.floor(sw / 2);
    const offY = Math.floor(sh / 2);
    for (let dy = 0; dy < sh; dy++) {
      for (let dx = 0; dx < sw; dx++) {
        const val = this.stampData[dy * sw + dx];
        if (!val) continue;
        const colorIdx = val === 1 ? this.colorIndex : 31; // 31 = pure white
        this._setPixel(cx - offX + dx, cy - offY + dy, colorIdx);
      }
    }
  }

  // ── Shape primitives ─────────────────────────────────

  private _drawShape(x0: number, y0: number, x1: number, y1: number) {
    const c = this.colorIndex;
    switch (this.tool) {
      case "line":
        this._linePrim(x0, y0, x1, y1, c);
        break;
      case "rect":
        if (this.shapeMode === "fill") this._fillRect(x0, y0, x1, y1, c);
        else this._outlineRect(x0, y0, x1, y1, c);
        break;
      case "ellipse":
        if (this.shapeMode === "fill") this._fillEllipse(x0, y0, x1, y1, c);
        else this._outlineEllipse(x0, y0, x1, y1, c);
        break;
    }
  }

  // Quadratic bezier: P0→(control P1)→P2, brush-size + mirror aware
  private _drawQuadBezier(
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ) {
    const maxExtent = Math.max(
      Math.abs(p2.x - p0.x) + Math.abs(p2.y - p0.y),
      Math.abs(p1.x - p0.x) + Math.abs(p1.y - p0.y),
      1
    );
    const steps = maxExtent * 2;
    const c = this.colorIndex;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const x = Math.round(mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x);
      const y = Math.round(mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y);
      this._writePixel(x, y, c);
    }
  }

  // Bresenham line using _writePixel (brush size + mirror aware)
  private _linePrim(x0: number, y0: number, x1: number, y1: number, c: number) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      this._writePixel(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx)  { err += dx; y0 += sy; }
    }
  }

  private _outlineRect(x0: number, y0: number, x1: number, y1: number, c: number) {
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    for (let x = minX; x <= maxX; x++) {
      this._setPixel(x, minY, c);
      this._setPixel(x, maxY, c);
    }
    for (let y = minY + 1; y < maxY; y++) {
      this._setPixel(minX, y, c);
      this._setPixel(maxX, y, c);
    }
  }

  private _fillRect(x0: number, y0: number, x1: number, y1: number, c: number) {
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        this._setPixel(x, y, c);
      }
    }
  }

  private _outlineEllipse(x0: number, y0: number, x1: number, y1: number, c: number) {
    const cx = Math.round((x0 + x1) / 2);
    const cy = Math.round((y0 + y1) / 2);
    const rx = Math.abs(x1 - x0) >> 1;
    const ry = Math.abs(y1 - y0) >> 1;
    this._ellipseAlgo(cx, cy, rx, ry, false, c);
  }

  private _fillEllipse(x0: number, y0: number, x1: number, y1: number, c: number) {
    const cx = Math.round((x0 + x1) / 2);
    const cy = Math.round((y0 + y1) / 2);
    const rx = Math.abs(x1 - x0) >> 1;
    const ry = Math.abs(y1 - y0) >> 1;
    this._ellipseAlgo(cx, cy, rx, ry, true, c);
  }

  // Midpoint ellipse algorithm. fill=false → outline only, fill=true → scanline fill
  private _ellipseAlgo(cx: number, cy: number, rx: number, ry: number, fill: boolean, c: number) {
    // Degenerate cases
    if (rx === 0 && ry === 0) { this._setPixel(cx, cy, c); return; }
    if (rx === 0) {
      for (let y = cy - ry; y <= cy + ry; y++) this._setPixel(cx, y, c);
      return;
    }
    if (ry === 0) {
      for (let x = cx - rx; x <= cx + rx; x++) this._setPixel(x, cy, c);
      return;
    }

    if (fill) {
      // Scanline fill: for each row, compute half-width from ellipse equation
      for (let dy = -ry; dy <= ry; dy++) {
        const xspan = Math.round(rx * Math.sqrt(1 - (dy / ry) ** 2));
        for (let dx = -xspan; dx <= xspan; dx++) {
          this._setPixel(cx + dx, cy + dy, c);
        }
      }
    } else {
      // Midpoint Bresenham ellipse outline
      const rx2 = rx * rx, ry2 = ry * ry;
      const plot4 = (px: number, py: number) => {
        this._setPixel(cx + px, cy + py, c);
        this._setPixel(cx - px, cy + py, c);
        this._setPixel(cx + px, cy - py, c);
        this._setPixel(cx - px, cy - py, c);
      };

      // Region 1
      let x = 0, y = ry;
      let d1 = ry2 - rx2 * ry + 0.25 * rx2;
      let dx = 2 * ry2 * x;
      let dy = 2 * rx2 * y;
      while (dx < dy) {
        plot4(x, y);
        if (d1 < 0) {
          x++;
          dx += 2 * ry2;
          d1 += dx + ry2;
        } else {
          x++; y--;
          dx += 2 * ry2;
          dy -= 2 * rx2;
          d1 += dx - dy + ry2;
        }
      }

      // Region 2
      let d2 = ry2 * (x + 0.5) ** 2 + rx2 * (y - 1) ** 2 - rx2 * ry2;
      while (y >= 0) {
        plot4(x, y);
        if (d2 > 0) {
          y--;
          dy -= 2 * rx2;
          d2 += rx2 - dy;
        } else {
          x++; y--;
          dx += 2 * ry2;
          dy -= 2 * rx2;
          d2 += dx - dy + rx2;
        }
      }
    }
  }

  // ── Freehand line (pencil/eraser) ────────────────────

  // Renders once at end — used by pencil/eraser on mousemove
  private _line(x0: number, y0: number, x1: number, y1: number) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      this._apply(x0, y0, false);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx)  { err += dx; y0 += sy; }
    }
    this._render();
  }

  // ── Pixel writers ─────────────────────────────────────

  // Single pixel with mirror support
  private _setPixel(x: number, y: number, colorIdx: number) {
    const w = this.logWidth, h = this.logHeight;
    if (x >= 0 && x < w && y >= 0 && y < h) {
      this._pixels[y * w + x] = colorIdx;
    }
    if (this.mirrorX) {
      const mx = w - 1 - x;
      if (mx !== x && mx >= 0 && mx < w && y >= 0 && y < h) {
        this._pixels[y * w + mx] = colorIdx;
      }
    }
  }

  // Brush-size block with mirror support
  private _writePixel(x: number, y: number, colorIdx: number) {
    const half = Math.floor(this.brushSize / 2);
    for (let dy = 0; dy < this.brushSize; dy++) {
      for (let dx = 0; dx < this.brushSize; dx++) {
        this._setPixel(x - half + dx, y - half + dy, colorIdx);
      }
    }
  }

  // Tool-aware apply (used by pencil/eraser/fill/eyedropper freehand)
  private _apply(x: number, y: number, render = true) {
    switch (this.tool) {
      case "pencil":
        this._writePixel(x, y, this.colorIndex);
        break;
      case "eraser":
        this._writePixel(x, y, EMPTY);
        break;
      case "fill":
        this._fill(x, y, this.colorIndex);
        break;
      case "eyedropper": {
        const idx = this._pixels[y * this.logWidth + x];
        if (idx !== EMPTY) {
          this.colorIndex = idx;
          this.dispatchEvent(
            new CustomEvent("color-pick", { detail: { colorIndex: idx }, bubbles: true })
          );
        }
        this.tool = "pencil";
        this.dispatchEvent(
          new CustomEvent("tool-change", { detail: { tool: "pencil" }, bubbles: true })
        );
        break;
      }
    }
    if (render) this._render();
  }

  private _fill(sx: number, sy: number, color: number) {
    const target = this._pixels[sy * this.logWidth + sx];
    if (target === color) return;
    const stack: [number, number][] = [[sx, sy]];
    const w = this.logWidth, h = this.logHeight;
    while (stack.length) {
      const [x, y] = stack.pop()!;
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      if (this._pixels[y * w + x] !== target) continue;
      this._pixels[y * w + x] = color;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }

  // ── Render ───────────────────────────────────────────

  private _render() {
    const { logWidth: w, logHeight: h, scale, _ctx: ctx } = this;
    const dw = w * scale, dh = h * scale;
    const img = ctx.createImageData(dw, dh);
    const d = img.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = this._pixels[y * w + x];
        let r: number, g: number, b: number;
        if (idx === EMPTY) {
          r = g = b = (x + y) % 2 === 0 ? 28 : 18;
        } else {
          [r, g, b] = PALETTE_RGB[idx];
        }
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const i = ((y * scale + dy) * dw + (x * scale + dx)) * 4;
            d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);

    if (scale >= 4) {
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= w; x++) {
        ctx.moveTo(x * scale + 0.5, 0);
        ctx.lineTo(x * scale + 0.5, dh);
      }
      for (let y = 0; y <= h; y++) {
        ctx.moveTo(0, y * scale + 0.5);
        ctx.lineTo(dw, y * scale + 0.5);
      }
      ctx.stroke();
    }
  }

  // ── History ──────────────────────────────────────────

  private _pushHistory() {
    this._undoStack.push(new Uint8Array(this._pixels));
    if (this._undoStack.length > MAX_HISTORY) this._undoStack.shift();
    this._redoStack = [];
    this._emitHistoryChange();
  }

  private _emitHistoryChange() {
    this.dispatchEvent(
      new CustomEvent("history-change", {
        detail: { canUndo: this._undoStack.length > 0, canRedo: this._redoStack.length > 0 },
        bubbles: true,
      })
    );
  }

  undo() {
    if (!this._undoStack.length) return;
    this._arcPhase = 0; this._snapPixels = null;
    this._redoStack.push(new Uint8Array(this._pixels));
    this._pixels.set(this._undoStack.pop()!);
    this._render();
    this._emitHistoryChange();
    this.dispatchEvent(
      new CustomEvent("canvas-change", { detail: { dataUrl: this.toDataURL() }, bubbles: true })
    );
  }

  redo() {
    if (!this._redoStack.length) return;
    this._arcPhase = 0; this._snapPixels = null;
    this._undoStack.push(new Uint8Array(this._pixels));
    this._pixels.set(this._redoStack.pop()!);
    this._render();
    this._emitHistoryChange();
    this.dispatchEvent(
      new CustomEvent("canvas-change", { detail: { dataUrl: this.toDataURL() }, bubbles: true })
    );
  }

  // ── Public API ───────────────────────────────────────

  setTool(t: PaintTool) {
    if (t !== "arc" && this._arcPhase !== 0) {
      this._arcPhase = 0;
      if (this._snapPixels) { this._pixels.set(this._snapPixels); this._render(); }
      this._snapPixels = null;
    }
    this.tool = t;
  }
  setColor(i: number) { this.colorIndex = i; }
  setBrushSize(n: number) { this.brushSize = n; }
  setMirrorX(v: boolean) { this.mirrorX = v; }
  setShapeMode(m: "outline" | "fill") { this.shapeMode = m; }
  setStamp(data: Uint8Array, w: number, h: number) {
    this.stampData = data;
    this.stampWidth = w;
    this.stampHeight = h;
  }

  clear() {
    this._pushHistory();
    this._pixels.fill(EMPTY);
    this._render();
    this.dispatchEvent(
      new CustomEvent("canvas-change", { detail: { dataUrl: this.toDataURL() }, bubbles: true })
    );
  }

  getPixels(): Uint8Array { return new Uint8Array(this._pixels); }

  setPixels(pixels: Uint8Array) {
    this._pixels.set(pixels);
    this._render();
  }

  toDataURL(): string {
    const ec = document.createElement("canvas");
    ec.width = this.logWidth;
    ec.height = this.logHeight;
    const ectx = ec.getContext("2d")!;
    const img = ectx.createImageData(this.logWidth, this.logHeight);
    const d = img.data;
    for (let i = 0; i < this._pixels.length; i++) {
      const idx = this._pixels[i];
      if (idx === EMPTY) {
        d[i * 4 + 3] = 0;
      } else {
        const [r, g, b] = PALETTE_RGB[idx];
        d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
      }
    }
    ectx.putImageData(img, 0, 0);
    return ec.toDataURL("image/png");
  }
}

export function definePaintCanvas() {
  if (!customElements.get("paint-canvas")) {
    customElements.define("paint-canvas", PaintCanvas);
  }
}
