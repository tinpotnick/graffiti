import { catBytes } from '../services/ipfs'
import { loadWallPostImage, relativeTime, escapeHtml } from '../services/compositing'

export interface FeedPost {
  cid: string
  caption: string
  timestamp: number
  peerId: string
  tagCid: string
  type?: 'wall' | 'text'
  title?: string
  /** This post's crop bounds on the 320×180 wall */
  bounds?: { x: number; y: number; w: number; h: number }
  /** If this is a tag/delta, the CID of the original wall image */
  wallRef?: string
  /** Bounds of the original wall image on the 320×180 canvas */
  wallBounds?: { x: number; y: number; w: number; h: number }
  /** True if this post came from a cached (possibly outdated) IPNS record. */
  stale?: boolean
  /** When the IPNS record was last successfully resolved (epoch ms). */
  resolvedAt?: number
  /** Local user's interaction: 0 = none, 1 = liked, 2 = really liked. */
  myInteraction?: 0 | 1 | 2
  /** Number of likes (strength 1) from resolved peers. */
  likeCount?: number
  /** Number of really-likes (strength 2) from resolved peers. */
  reallyLikeCount?: number
  /** If this feed item is a "really-like" repost, the PeerID of who really-liked it. */
  reallyLikedBy?: string
  /** Tag CID for the person who really-liked. */
  reallyLikedByTagCid?: string
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

  .text-content {
    padding: 1rem 1rem 0.5rem;
  }

  .text-title {
    margin: 0 0 0.5rem;
    font-family: var(--font-body);
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text);
    line-height: 1.3;
  }

  .text-body {
    margin: 0;
    font-family: var(--font-body);
    font-size: 0.85rem;
    color: var(--text);
    line-height: 1.5;
    word-break: break-word;
  }

  .text-link {
    text-decoration: none;
    color: inherit;
    display: block;
  }
  .text-link:hover .text-title { color: var(--accent); }

  .read-more {
    display: inline-block;
    margin-top: 0.4rem;
    font-family: var(--font-pixel);
    font-size: 0.45rem;
    letter-spacing: 1.5px;
    color: var(--accent);
  }

  .stale-badge {
    font-family: var(--font-pixel);
    font-size: 0.4rem;
    letter-spacing: 1px;
    color: var(--text-muted);
    opacity: 0.7;
  }

  .like-group {
    display: flex;
    align-items: center;
    gap: 0.15rem;
    padding-top: 0.5rem;
  }

  .like-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.2rem;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    transition: color 0.15s, transform 0.1s;
  }
  .like-btn:hover {
    color: var(--text);
  }
  .like-btn:active {
    transform: scale(0.85);
  }
  .like-btn svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: fill 0.15s;
  }
  .like-btn.lit {
    color: #e5395e;
  }
  .like-btn.lit svg {
    fill: #e5395e;
    stroke: #e5395e;
  }

  .like-count {
    font-family: var(--font-pixel);
    font-size: 0.4rem;
    letter-spacing: 1px;
    color: var(--text-muted);
    padding-left: 0.2rem;
  }

  .really-liked-banner {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 1rem;
    font-family: var(--font-pixel);
    font-size: 0.4rem;
    letter-spacing: 1px;
    color: var(--text-muted);
    background: var(--surface-inset);
  }
  .really-liked-banner img {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    image-rendering: pixelated;
  }
`

class FeedItem extends HTMLElement {
  private _root!: ShadowRoot
  private _post: FeedPost = { cid: '', caption: '', timestamp: 0, peerId: '', tagCid: '' }
  private _imageUrl: string | null = null
  private _tagUrl: string | null = null
  private _rlTagUrl: string | null = null
  private _doubleTapTimer: ReturnType<typeof setTimeout> | null = null
  myPeerId = ''

  set post(value: FeedPost) {
    const prev = this._post
    this._post = value

    // If only interaction state changed, patch the like UI without full re-render
    if (this._root && prev.cid === value.cid && prev.timestamp === value.timestamp) {
      this._patchLikes()
      return
    }

    this._render()
    this._bindActions()
    if (this._post.type !== 'text') this._loadImage()
    this._loadTag()
    if (this._post.reallyLikedByTagCid) this._loadRlTag()
  }

  get post(): FeedPost {
    return this._post
  }

  connectedCallback() {
    if (this.shadowRoot) return
    this._root = this.attachShadow({ mode: 'open' })
    this._render()
    this._bindActions()
    if (this._post.cid && this._post.type !== 'text') this._loadImage()
    if (this._post.tagCid) this._loadTag()
    if (this._post.reallyLikedByTagCid) this._loadRlTag()
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
    if (this._rlTagUrl) {
      URL.revokeObjectURL(this._rlTagUrl)
      this._rlTagUrl = null
    }
    if (this._doubleTapTimer) {
      clearTimeout(this._doubleTapTimer)
      this._doubleTapTimer = null
    }
  }

  private _render() {
    if (!this._root) return
    const { caption, timestamp, peerId, bounds, wallRef, wallBounds, type, title, cid,
            myInteraction, likeCount, reallyLikeCount, reallyLikedBy } = this._post
    const shortId = peerId.length > 16 ? `${peerId.slice(0, 8)}…${peerId.slice(-6)}` : peerId
    const timeStr = timestamp ? relativeTime(timestamp) : ''
    const isText = type === 'text'

    // Own wall → EDIT; other walls → TAG THIS
    const isOwn = this.myPeerId && peerId === this.myPeerId && !wallRef
    let tagHref: string
    let tagLabel: string
    if (isOwn) {
      tagHref = '/paint?mode=wall'
      tagLabel = 'EDIT'
    } else {
      const refCid = wallRef ?? cid
      const refBounds = wallRef ? (wallBounds ?? { x: 0, y: 0, w: 320, h: 180 }) : (bounds ?? { x: 0, y: 0, w: 320, h: 180 })
      tagHref = `/paint?wallRef=${encodeURIComponent(refCid)}&wx=${refBounds.x}&wy=${refBounds.y}&ww=${refBounds.w}&wh=${refBounds.h}`
      tagLabel = 'TAG THIS'
    }

    let topContent: string
    if (isText) {
      const postHref = `/post?cid=${encodeURIComponent(cid)}&t=${timestamp}&peer=${encodeURIComponent(peerId)}`
      const snippet = caption ? escapeHtml(caption.length > 140 ? caption.slice(0, 140) + '…' : caption) : ''
      topContent = `<a class="text-link" href="${postHref}">
        <div class="text-content">
          ${title ? `<h2 class="text-title">${escapeHtml(title)}</h2>` : ''}
          ${snippet ? `<p class="text-body">${snippet}</p>` : ''}
          <span class="read-more">READ MORE</span>
        </div>
      </a>`
    } else {
      topContent = `<div class="loading" id="img-slot">LOADING…</div>`
    }

    const tagLink = isText ? '' : `<a class="tag-link" href="${tagHref}">${tagLabel}</a>`
    const staleBadge = this._post.stale && this._post.resolvedAt
      ? `<span class="stale-badge">CACHED · ${relativeTime(this._post.resolvedAt)}</span>`
      : ''

    const interaction = myInteraction ?? 0
    const totalCount = (likeCount ?? 0) + (reallyLikeCount ?? 0)

    const reallyLikedBanner = reallyLikedBy
      ? `<div class="really-liked-banner">
          <img id="rl-tag-slot" alt="">
          <span>${reallyLikedBy.length > 16 ? `${reallyLikedBy.slice(0, 8)}…${reallyLikedBy.slice(-6)}` : reallyLikedBy} REALLY LIKED THIS</span>
        </div>`
      : ''

    this._root.innerHTML = `
      <style>${STYLES}</style>
      <article>
        ${reallyLikedBanner}
        ${topContent}
        <div class="post-body">
          ${wallRef ? '<div class="wall-ref-badge">TAGGED A WALL</div>' : ''}
          ${caption && !isText ? `<p class="caption">${escapeHtml(caption)}</p>` : ''}
          <div class="meta">
            <img class="tag-img" id="tag-slot" alt="">
            <div class="meta-text">
              <span>${shortId}</span>
              ${staleBadge}
              ${tagLink}
              <span>${timeStr}</span>
            </div>
          </div>
          <div class="like-group">
            <button class="like-btn ${interaction >= 1 ? 'lit' : ''}" id="like-btn" title="Like">
              <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>
            <button class="like-btn ${interaction >= 2 ? 'lit' : ''}" id="really-like-btn" title="Really like">
              <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>
            ${totalCount ? `<span class="like-count">${totalCount}</span>` : ''}
          </div>
        </div>
      </article>
    `
  }

  /** Patch only the like buttons + count without a full re-render. */
  private _patchLikes() {
    const interaction = this._post.myInteraction ?? 0
    const totalCount = (this._post.likeCount ?? 0) + (this._post.reallyLikeCount ?? 0)

    const likeBtn = this._root.querySelector('#like-btn')
    const reallyLikeBtn = this._root.querySelector('#really-like-btn')

    if (likeBtn) {
      likeBtn.className = `like-btn ${interaction >= 1 ? 'lit' : ''}`
    }
    if (reallyLikeBtn) {
      reallyLikeBtn.className = `like-btn ${interaction >= 2 ? 'lit' : ''}`
    }

    const countEl = this._root.querySelector('.like-count')
    if (totalCount && countEl) {
      countEl.textContent = String(totalCount)
    } else if (totalCount && !countEl) {
      const span = document.createElement('span')
      span.className = 'like-count'
      span.textContent = String(totalCount)
      this._root.querySelector('.like-group')?.appendChild(span)
    } else if (!totalCount && countEl) {
      countEl.remove()
    }
  }

  private _bindActions() {
    if (!this._root) return

    const likeBtn = this._root.querySelector('#like-btn')
    const reallyLikeBtn = this._root.querySelector('#really-like-btn')
    const article = this._root.querySelector('article')

    likeBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      const current = this._post.myInteraction ?? 0
      // 0 → 1 (like), 1 → 0 (unlike), 2 → 1 (downgrade to like)
      const next = current === 1 ? 0 : 1
      this._dispatchInteraction(next as 0 | 1 | 2)
    })

    reallyLikeBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      const current = this._post.myInteraction ?? 0
      // 0 → 2 (really like), 1 → 2 (upgrade), 2 → 0 (unlike)
      const next = current === 2 ? 0 : 2
      this._dispatchInteraction(next as 0 | 1 | 2)
    })

    // Double-tap on article → really like
    if (article) {
      let lastTap = 0
      article.addEventListener('click', () => {
        const now = Date.now()
        if (now - lastTap < 350) {
          // Double tap → really like (or toggle off if already really-liked)
          const current = this._post.myInteraction ?? 0
          this._dispatchInteraction(current === 2 ? 0 : 2)
          lastTap = 0
        } else {
          lastTap = now
        }
      })
    }
  }

  private _dispatchInteraction(strength: 0 | 1 | 2) {
    this.dispatchEvent(new CustomEvent('post-interact', {
      bubbles: true,
      composed: true,
      detail: {
        target: this._post.cid,
        author: this._post.peerId,
        strength,
      },
    }))
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

  private async _loadRlTag() {
    if (!this._post.reallyLikedByTagCid || !this._root) return
    try {
      const bytes = await catBytes(this._post.reallyLikedByTagCid)
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'image/png' })
      if (this._rlTagUrl) URL.revokeObjectURL(this._rlTagUrl)
      this._rlTagUrl = URL.createObjectURL(blob)

      const el = this._root.querySelector<HTMLImageElement>('#rl-tag-slot')
      if (el) el.src = this._rlTagUrl
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
