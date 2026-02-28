export const PALETTE_HEX = [
  "#000000", "#1d2b53", "#7e2553", "#008751",
  "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8",
  "#ff004d", "#ffa300", "#ffec27", "#00e436",
  "#29adff", "#83769c", "#ff77a8", "#ffccaa",
];

const PALETTE_RGB: [number, number, number][] = PALETTE_HEX.map((h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
});

export type PaintTool = "pencil" | "eraser" | "fill" | "eyedropper";

const EMPTY = 255;

export class PaintCanvas extends HTMLElement {
  private _canvas!: HTMLCanvasElement;
  private _ctx!: CanvasRenderingContext2D;
  private _pixels!: Uint8Array;
  private _drawing = false;
  private _lastX = -1;
  private _lastY = -1;

  logWidth = 64;
  logHeight = 64;
  scale = 8;
  tool: PaintTool = "pencil";
  colorIndex = 8; // red

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
  }

  private _pos(clientX: number, clientY: number): [number, number] {
    const rect = this._canvas.getBoundingClientRect();
    return [
      Math.max(0, Math.min(this.logWidth - 1, Math.floor((clientX - rect.left) / this.scale))),
      Math.max(0, Math.min(this.logHeight - 1, Math.floor((clientY - rect.top) / this.scale))),
    ];
  }

  private _onMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    this._drawing = true;
    const [x, y] = this._pos(e.clientX, e.clientY);
    this._apply(x, y);
    this._lastX = x;
    this._lastY = y;
  };

  private _onMouseMove = (e: MouseEvent) => {
    if (!this._drawing) return;
    const [x, y] = this._pos(e.clientX, e.clientY);
    if (x !== this._lastX || y !== this._lastY) {
      this._line(this._lastX, this._lastY, x, y);
      this._lastX = x;
      this._lastY = y;
    }
  };

  private _onMouseUp = () => {
    if (!this._drawing) return;
    this._drawing = false;
    this._lastX = -1;
    this._lastY = -1;
    this.dispatchEvent(
      new CustomEvent("canvas-change", { detail: { dataUrl: this.toDataURL() }, bubbles: true })
    );
  };

  private _onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    this._drawing = true;
    const [x, y] = this._pos(t.clientX, t.clientY);
    this._apply(x, y);
    this._lastX = x;
    this._lastY = y;
  };

  private _onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (!this._drawing) return;
    const t = e.touches[0];
    const [x, y] = this._pos(t.clientX, t.clientY);
    if (x !== this._lastX || y !== this._lastY) {
      this._line(this._lastX, this._lastY, x, y);
      this._lastX = x;
      this._lastY = y;
    }
  };

  // Bresenham's line — no gaps when moving fast
  private _line(x0: number, y0: number, x1: number, y1: number) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      this._apply(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
    this._render();
  }

  private _apply(x: number, y: number) {
    switch (this.tool) {
      case "pencil":
        this._pixels[y * this.logWidth + x] = this.colorIndex;
        break;
      case "eraser":
        this._pixels[y * this.logWidth + x] = EMPTY;
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
    this._render();
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

  setTool(t: PaintTool) { this.tool = t; }
  setColor(i: number) { this.colorIndex = i; }

  clear() {
    this._pixels.fill(EMPTY);
    this._render();
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
