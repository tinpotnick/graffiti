import { catBytes } from '../services/ipfs'
import { loadWallPostImage, relativeTime, escapeHtml } from '../services/compositing'

export interface FeedPost {
  cid: string
  caption: string
  timestamp: number
  peerId: string
  tagCid: string
  /** This post's crop bounds on the 320×180 wall */
  bounds?: { x: number; y: number; w: number; h: number }
  /** If this is a tag/delta, the CID of the original wall image */
  wallRef?: string
  /** Bounds of the original wall image on the 320×180 canvas */
  wallBounds?: { x: number; y: number; w: number; h: number }
}

const STYLES = `
  :host {
    display: block;
  }

  article {
    position: relative;
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-input);
    overflow: hidden;
  }

  .post-img {
    display: block;
    width: 100%;
    image-rendering: pixelated;
    background: var(--surface-inset);
    min-height: 80px;
  }

  .post-body {
    position: relative;
    padding: 0.75rem 1rem;
  }

  .caption {
    margin: 0 0 0.4rem;
    font-family: var(--font-body);
    font-size: 0.9rem;
    color: var(--text);
    line-height: 1.4;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--font-pixel);
    font-size: 0.5rem;
    letter-spacing: 1px;
    color: var(--text-muted);
  }

  .tag-img {
    position: absolute;
    top: -32px;
    right: 12px;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 2px solid var(--surface-raised);
    image-rendering: pixelated;
    background: var(--surface-inset);
    z-index: 1;
    object-fit: cover;
  }

  .meta-text {
    flex: 1;
    display: flex;
    justify-content: space-between;
  }

  .loading {
    padding: 2rem;
    text-align: center;
    font-family: var(--font-pixel);
    font-size: 0.55rem;
    letter-spacing: 1.5px;
    color: var(--text-muted);
  }

  .tag-link {
    display: inline-block;
    padding: 0.35rem 0.65rem;
    font-family: var(--font-pixel);
    font-size: 0.45rem;
    letter-spacing: 1.5px;
    color: var(--text-muted);
    text-decoration: none;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .tag-link:hover {
    color: var(--text);
    border-color: var(--text-muted);
  }

  .wall-ref-badge {
    font-family: var(--font-pixel);
    font-size: 0.4rem;
    letter-spacing: 1px;
    color: var(--text-muted);
    padding: 0.2rem 0;
  }
`

class FeedItem extends HTMLElement {
  private _root!: ShadowRoot
  private _post: FeedPost = { cid: '', caption: '', timestamp: 0, peerId: '', tagCid: '' }
  private _imageUrl: string | null = null
  private _tagUrl: string | null = null

  set post(value: FeedPost) {
    this._post = value
    this._render()
    this._loadImage()
    this._loadTag()
  }

  get post(): FeedPost {
    return this._post
  }

  connectedCallback() {
    if (this.shadowRoot) return
    this._root = this.attachShadow({ mode: 'open' })
    this._render()
    if (this._post.cid) this._loadImage()
    if (this._post.tagCid) this._loadTag()
  }

  disconnectedCallback() {
    if (this._imageUrl) {
      URL.revokeObjectURL(this._imageUrl)
      this._imageUrl = null
    }
    if (this._tagUrl) {
      URL.revokeObjectURL(this._tagUrl)
      this._tagUrl = null
    }
  }

  private _render() {
    if (!this._root) return
    const { caption, timestamp, peerId, bounds, wallRef, wallBounds } = this._post
    const shortId = peerId.length > 16 ? `${peerId.slice(0, 8)}…${peerId.slice(-6)}` : peerId
    const timeStr = timestamp ? relativeTime(timestamp) : ''

    // Build TAG THIS link — use the root wall ref (or this post's own CID for originals)
    const refCid = wallRef ?? this._post.cid
    const refBounds = wallRef ? (wallBounds ?? { x: 0, y: 0, w: 320, h: 180 }) : (bounds ?? { x: 0, y: 0, w: 320, h: 180 })
    const tagHref = `/paint?wallRef=${encodeURIComponent(refCid)}&wx=${refBounds.x}&wy=${refBounds.y}&ww=${refBounds.w}&wh=${refBounds.h}`

    this._root.innerHTML = `
      <style>${STYLES}</style>
      <article>
        <div class="loading" id="img-slot">LOADING…</div>
        <div class="post-body">
          ${wallRef ? '<div class="wall-ref-badge">TAGGED A WALL</div>' : ''}
          ${caption ? `<p class="caption">${escapeHtml(caption)}</p>` : ''}
          <div class="meta">
            <img class="tag-img" id="tag-slot" alt="">
            <div class="meta-text">
              <span>${shortId}</span>
              <a class="tag-link" href="${tagHref}">TAG THIS</a>
              <span>${timeStr}</span>
            </div>
          </div>
        </div>
      </article>
    `
  }

  private async _loadImage() {
    if (!this._post.cid || !this._root) return
    try {
      const blobUrl = await loadWallPostImage(this._post)

      if (this._imageUrl) URL.revokeObjectURL(this._imageUrl)
      this._imageUrl = blobUrl

      const slot = this._root.querySelector('#img-slot')
      if (slot) {
        const img = document.createElement('img')
        img.className = 'post-img'
        img.src = this._imageUrl
        img.alt = this._post.caption || 'Wall post'
        slot.replaceWith(img)
      }
    } catch (err) {
      const slot = this._root.querySelector('#img-slot')
      if (slot) slot.textContent = 'IMAGE UNAVAILABLE'
    }
  }

  private async _loadTag() {
    if (!this._post.tagCid || !this._root) return
    try {
      const bytes = await catBytes(this._post.tagCid)
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'image/png' })
      if (this._tagUrl) URL.revokeObjectURL(this._tagUrl)
      this._tagUrl = URL.createObjectURL(blob)

      const el = this._root.querySelector<HTMLImageElement>('#tag-slot')
      if (el) el.src = this._tagUrl
    } catch {
      // Tag unavailable — leave blank
    }
  }
}


export function defineFeedItem() {
  if (!customElements.get('feed-item')) {
    customElements.define('feed-item', FeedItem)
  }
}
