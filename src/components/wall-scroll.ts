import { catBytes } from '../services/ipfs'
import { compositeWallState, relativeTime, escapeHtml } from '../services/compositing'
import type { FeedPost } from './feed-item'

export type WallScrollElement = HTMLElement & { posts: FeedPost[]; myPeerId: string }

interface WallState {
  base: FeedPost
  tags: FeedPost[]
  latestTimestamp: number
}

const STYLES = `
  :host {
    display: block;
    width: 100vw;
    position: relative;
    left: 50%;
    margin-left: -50vw;
  }

  .wall-strip {
    display: flex;
    flex-direction: column;
  }

  .wall-slot {
    position: relative;
    width: 100%;
    overflow: hidden;
    font-size: 0;
    line-height: 0;
  }

  .wall-placeholder {
    width: 100%;
    padding-bottom: 56.25%; /* 180/320 */
    background: var(--surface-inset, #f7f7f7);
  }

  .wall-img {
    display: block;
    width: 100%;
    image-rendering: pixelated;
    opacity: 0;
    transition: opacity 0.3s ease-in;
  }

  .wall-img.loaded {
    opacity: 1;
  }

  /* ── Overlay ────────────────────── */

  .wall-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-end;
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.78) 0%,
      rgba(0, 0, 0, 0.25) 55%,
      transparent 100%
    );
    padding: 0.75rem;
    cursor: pointer;
    animation: overlay-in 0.2s ease-out;
    z-index: 2;
  }

  @keyframes overlay-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .overlay-tag {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.6);
    image-rendering: pixelated;
    flex-shrink: 0;
    object-fit: cover;
    margin-right: 0.6rem;
    background: rgba(255, 255, 255, 0.1);
  }

  .overlay-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    flex: 1;
    min-width: 0;
  }

  .overlay-author {
    font-family: var(--font-pixel, monospace);
    font-size: 0.5rem;
    letter-spacing: 1.5px;
    color: #fff;
  }

  .overlay-time {
    font-family: var(--font-pixel, monospace);
    font-size: 0.4rem;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.6);
  }

  .overlay-caption {
    margin: 0.2rem 0 0;
    font-family: var(--font-body, sans-serif);
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.9);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .overlay-action {
    display: inline-block;
    margin-top: 0.3rem;
    padding: 0.3rem 0.55rem;
    font-family: var(--font-pixel, monospace);
    font-size: 0.4rem;
    letter-spacing: 1.5px;
    color: #fff;
    text-decoration: none;
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: var(--radius-sm, 4px);
    align-self: flex-start;
    transition: border-color 0.15s, background 0.15s;
  }
  .overlay-action:hover {
    border-color: #fff;
    background: rgba(255, 255, 255, 0.12);
  }

  .overlay-tags-count {
    font-family: var(--font-pixel, monospace);
    font-size: 0.35rem;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 0.1rem;
  }

  .empty {
    text-align: center;
    padding: 3rem 1rem;
    font-family: var(--font-pixel, monospace);
    font-size: 0.6rem;
    letter-spacing: 2px;
    color: var(--text-muted, #999);
  }
`

class WallScroll extends HTMLElement {
  private _root!: ShadowRoot
  private _posts: FeedPost[] = []
  private _wallStates: WallState[] = []
  private _observer: IntersectionObserver | null = null
  private _objectUrls = new Map<number, string>()
  private _tagCache = new Map<string, string>()
  private _activeOverlay: HTMLElement | null = null
  myPeerId = ''

  set posts(value: FeedPost[]) {
    this._posts = value
    this._wallStates = this._buildWallStates(value)
    if (this._root) this._buildSlots()
  }

  connectedCallback() {
    if (this.shadowRoot) return
    this._root = this.attachShadow({ mode: 'open' })
    this._root.innerHTML = `<style>${STYLES}</style><div class="wall-strip"></div>`

    this._observer = new IntersectionObserver(
      (entries) => this._onIntersect(entries),
      { rootMargin: '200px 0px' },
    )

    if (this._wallStates.length) this._buildSlots()
  }

  disconnectedCallback() {
    this._observer?.disconnect()
    this._observer = null
    for (const url of this._objectUrls.values()) URL.revokeObjectURL(url)
    this._objectUrls.clear()
    for (const url of this._tagCache.values()) URL.revokeObjectURL(url)
    this._tagCache.clear()
    this._activeOverlay = null
  }

  /**
   * Deduplicate posts into one wall state per user (their latest original wall),
   * with all tags from anyone composited on top.
   */
  private _buildWallStates(posts: FeedPost[]): WallState[] {
    const wallPosts = posts.filter(p => p.type !== 'text')
    const originals = wallPosts.filter(p => !p.wallRef)
    const tags = wallPosts.filter(p => p.wallRef)

    // Keep only the latest original wall per user
    const latestByUser = new Map<string, FeedPost>()
    for (const post of originals) {
      const existing = latestByUser.get(post.peerId)
      if (!existing || post.timestamp > existing.timestamp) {
        latestByUser.set(post.peerId, post)
      }
    }

    const states: WallState[] = []
    for (const base of latestByUser.values()) {
      // Find all tags that reference this wall, sorted oldest→newest for layering
      const wallTags = tags
        .filter(t => t.wallRef === base.cid)
        .sort((a, b) => a.timestamp - b.timestamp)

      const latestTimestamp = wallTags.length > 0
        ? Math.max(base.timestamp, wallTags[wallTags.length - 1].timestamp)
        : base.timestamp

      states.push({ base, tags: wallTags, latestTimestamp })
    }

    // Sort by latest activity, newest first
    states.sort((a, b) => b.latestTimestamp - a.latestTimestamp)
    return states
  }

  private _buildSlots() {
    const strip = this._root.querySelector('.wall-strip')!
    strip.innerHTML = ''

    if (this._wallStates.length === 0) {
      strip.innerHTML = '<div class="empty">NO WALLS YET</div>'
      return
    }

    for (let i = 0; i < this._wallStates.length; i++) {
      const slot = document.createElement('div')
      slot.className = 'wall-slot'
      slot.dataset.index = String(i)
      slot.innerHTML = '<div class="wall-placeholder"></div>'
      strip.appendChild(slot)
      this._observer?.observe(slot)
    }
  }

  private _onIntersect(entries: IntersectionObserverEntry[]) {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      const slot = entry.target as HTMLElement
      this._observer?.unobserve(slot)
      const idx = parseInt(slot.dataset.index!, 10)
      const state = this._wallStates[idx]
      if (state) this._loadWallImage(slot, state, idx)
    }
  }

  private async _loadWallImage(slot: HTMLElement, state: WallState, idx: number) {
    try {
      const blobUrl = await compositeWallState(state.base, state.tags)
      if (!this.isConnected) { URL.revokeObjectURL(blobUrl); return }

      this._objectUrls.set(idx, blobUrl)

      const img = document.createElement('img')
      img.className = 'wall-img'
      img.alt = state.base.caption || 'Wall'
      img.src = blobUrl

      img.onload = () => img.classList.add('loaded')
      img.addEventListener('click', (e) => {
        e.stopPropagation()
        this._showOverlay(slot, state)
      })

      const placeholder = slot.querySelector('.wall-placeholder')
      if (placeholder) placeholder.replaceWith(img)
    } catch {
      // Leave placeholder on failure
    }
  }

  private async _showOverlay(slot: HTMLElement, state: WallState) {
    this._dismissOverlay()

    const { base, tags } = state
    const shortId = base.displayName || (base.peerId.length > 16
      ? `${base.peerId.slice(0, 8)}…${base.peerId.slice(-6)}`
      : base.peerId)
    const timeStr = state.latestTimestamp ? relativeTime(state.latestTimestamp) : ''

    // Own wall → EDIT (go to wall painter); other walls → TAG THIS
    const isOwn = this.myPeerId && base.peerId === this.myPeerId
    let actionHref: string
    let actionLabel: string
    if (isOwn) {
      actionHref = '/paint?mode=wall'
      actionLabel = 'EDIT'
    } else {
      const refBounds = base.bounds ?? { x: 0, y: 0, w: 320, h: 180 }
      actionHref = `/paint?wallRef=${encodeURIComponent(base.cid)}&wx=${refBounds.x}&wy=${refBounds.y}&ww=${refBounds.w}&wh=${refBounds.h}`
      actionLabel = 'TAG THIS'
    }

    const overlay = document.createElement('div')
    overlay.className = 'wall-overlay'
    overlay.innerHTML = `
      <img class="overlay-tag" id="otag-${base.cid}" alt="">
      <div class="overlay-info">
        ${tags.length > 0 ? `<div class="overlay-tags-count">${tags.length} TAG${tags.length > 1 ? 'S' : ''}</div>` : ''}
        <span class="overlay-author">${shortId}</span>
        <span class="overlay-time">${timeStr}</span>
        ${base.caption ? `<p class="overlay-caption">${escapeHtml(base.caption)}</p>` : ''}
        <a class="overlay-action" href="${actionHref}">${actionLabel}</a>
      </div>
    `

    const actionLink = overlay.querySelector('.overlay-action')
    actionLink?.addEventListener('click', (e) => e.stopPropagation())

    overlay.addEventListener('click', (e) => {
      e.stopPropagation()
      this._dismissOverlay()
    })

    slot.appendChild(overlay)
    this._activeOverlay = overlay

    if (base.tagCid) this._loadTagAvatar(base.tagCid, `otag-${base.cid}`)
  }

  private _dismissOverlay() {
    if (this._activeOverlay) {
      this._activeOverlay.remove()
      this._activeOverlay = null
    }
  }

  private async _loadTagAvatar(tagCid: string, slotId: string) {
    try {
      let url = this._tagCache.get(tagCid)
      if (!url) {
        const bytes = await catBytes(tagCid)
        const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'image/png' })
        url = URL.createObjectURL(blob)
        this._tagCache.set(tagCid, url)
      }
      const el = this._root.querySelector<HTMLImageElement>(`#${slotId}`)
      if (el) el.src = url
    } catch {
      // Tag unavailable — leave blank
    }
  }
}

export function defineWallScroll() {
  if (!customElements.get('wall-scroll')) {
    customElements.define('wall-scroll', WallScroll)
  }
}
