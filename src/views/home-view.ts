import { loadManifest, getMyPeerId, resolveFollowedPeer } from '../services/profile'
import type { FeedPost } from '../components/feed-item'
import type { WallScrollElement } from '../components/wall-scroll'

type FeedItemElement = HTMLElement & { post: FeedPost; myPeerId: string }

const STYLES = `
  :host { display: block; }

  .view-toggle {
    display: flex;
    margin-bottom: 0.5rem;
  }

  .toggle-btn {
    flex: 1;
    padding: 0.6rem 0;
    font-family: var(--font-pixel);
    font-size: 0.55rem;
    letter-spacing: 2px;
    cursor: pointer;
    background: var(--surface-raised);
    color: var(--text-muted);
    border: 1px solid var(--border);
    transition: color 0.15s, background 0.15s;
  }

  .toggle-btn:first-child {
    border-radius: var(--radius-md) 0 0 var(--radius-md);
    border-right: none;
  }

  .toggle-btn:last-child {
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
  }

  .toggle-btn.active {
    background: var(--accent);
    color: var(--text-inverse);
    border-color: var(--accent);
  }

  .feed-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-top: 0.5rem;
  }

  .status {
    text-align: center;
    padding: 3rem 1rem;
    font-family: var(--font-pixel);
    font-size: 0.6rem;
    letter-spacing: 2px;
    color: var(--text-muted);
  }
`

const REFRESH_INTERVAL = 30 * 60 * 1000 // 30 minutes
const PAGE_SIZE = 20

class HomeView extends HTMLElement {
  private _root!: ShadowRoot
  private _posts: FeedPost[] = []
  private _myPeerId = ''
  private _viewMode: 'feed' | 'wall' = 'wall'
  private _loading = true
  private _refreshTimer: ReturnType<typeof setInterval> | null = null
  private _renderedCount = 0
  private _feedObserver: IntersectionObserver | null = null

  connectedCallback() {
    if (this.shadowRoot) return
    this._viewMode = (localStorage.getItem('graffiti:home-view-mode') as 'feed' | 'wall') || 'wall'
    this._root = this.attachShadow({ mode: 'open' })
    this._root.innerHTML = `
      <style>${STYLES}</style>
      <div class="view-toggle">
        <button class="toggle-btn" data-mode="wall">WALL</button>
        <button class="toggle-btn" data-mode="feed">FEED</button>
      </div>
      <section class="content">
        <div class="status">LOADING…</div>
      </section>
    `
    this._updateToggle()
    this._bindToggle()
    this._loadFeed()
    this._refreshTimer = setInterval(() => this._loadFeed(), REFRESH_INTERVAL)

    // Re-fetch feed when navigating back to home (cached SPA view)
    window.addEventListener('route-change', (e: Event) => {
      const { pathname } = (e as CustomEvent).detail
      if (pathname === '/') this._loadFeed()
    })
  }

  private _bindToggle() {
    this._root.querySelector('.view-toggle')!.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.toggle-btn')
      if (!btn?.dataset.mode) return
      const next = btn.dataset.mode as 'feed' | 'wall'
      if (next === this._viewMode) return
      this._viewMode = next
      try { localStorage.setItem('graffiti:home-view-mode', next) } catch {}
      this._updateToggle()
      this._renderView()
    })
  }

  private _updateToggle() {
    this._root.querySelectorAll<HTMLElement>('.toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === this._viewMode)
    })
  }

  private async _loadFeed() {
    try {
      const manifest = loadManifest()
      const myPeerId = await getMyPeerId()
      this._myPeerId = myPeerId

      // Own posts
      const posts: FeedPost[] = manifest.wall.map(p => ({
        cid: p.cid,
        caption: p.caption,
        timestamp: p.timestamp,
        peerId: myPeerId,
        tagCid: manifest.tag,
        type: p.type,
        title: p.title,
        bounds: p.x != null ? { x: p.x, y: p.y!, w: p.w!, h: p.h! } : undefined,
        wallRef: p.wallRef,
        wallBounds: p.wallBounds,
      }))

      // Resolve followed peers in parallel
      const peerResults = await Promise.all(
        manifest.following.map(async (peerId) => {
          const result = await resolveFollowedPeer(peerId)
          if (!result) return []
          return result.manifest.wall.map(p => ({
            cid: p.cid,
            caption: p.caption,
            timestamp: p.timestamp,
            peerId,
            tagCid: result.manifest.tag,
            type: p.type,
            title: p.title,
            bounds: p.x != null ? { x: p.x, y: p.y!, w: p.w!, h: p.h! } : undefined,
            wallRef: p.wallRef,
            wallBounds: p.wallBounds,
            stale: result.stale,
            resolvedAt: result.resolvedAt,
          }))
        })
      )
      for (const peerPosts of peerResults) {
        posts.push(...peerPosts)
      }

      // Sort newest first
      posts.sort((a, b) => b.timestamp - a.timestamp)

      this._posts = posts
      this._loading = false
      this._renderView()
    } catch (err) {
      console.error('[home] Failed to load feed:', err)
      const content = this._root.querySelector('.content')!
      content.innerHTML = '<div class="status">FAILED TO LOAD FEED</div>'
    }
  }

  private _renderView() {
    const content = this._root.querySelector('.content')!

    if (this._loading) {
      content.innerHTML = '<div class="status">LOADING…</div>'
      return
    }

    if (this._posts.length === 0) {
      content.innerHTML = '<div class="status">NO POSTS YET</div>'
      return
    }

    this._disconnectFeedObserver()
    content.innerHTML = ''

    if (this._viewMode === 'wall') {
      const wallScroll = document.createElement('wall-scroll') as WallScrollElement
      wallScroll.myPeerId = this._myPeerId
      wallScroll.posts = this._posts
      content.appendChild(wallScroll)
    } else {
      const feed = document.createElement('div')
      feed.className = 'feed-list'
      content.appendChild(feed)

      this._renderedCount = 0
      this._appendFeedPage(feed)

      if (this._renderedCount < this._posts.length) {
        const sentinel = document.createElement('div')
        sentinel.className = 'status'
        sentinel.textContent = 'LOADING MORE…'
        content.appendChild(sentinel)

        this._feedObserver = new IntersectionObserver(
          (entries) => {
            if (!entries[0].isIntersecting) return
            this._appendFeedPage(feed)
            if (this._renderedCount >= this._posts.length) {
              this._disconnectFeedObserver()
              sentinel.remove()
            }
          },
          { root: null, rootMargin: '200px 0px' }
        )
        this._feedObserver.observe(sentinel)
      }
    }
  }

  private _appendFeedPage(feed: HTMLElement) {
    const end = Math.min(this._renderedCount + PAGE_SIZE, this._posts.length)
    for (let i = this._renderedCount; i < end; i++) {
      const item = document.createElement('feed-item') as FeedItemElement
      item.myPeerId = this._myPeerId
      item.post = this._posts[i]
      feed.appendChild(item)
    }
    this._renderedCount = end
  }

  private _disconnectFeedObserver() {
    if (this._feedObserver) {
      this._feedObserver.disconnect()
      this._feedObserver = null
    }
  }
}

export function defineHomeView() {
  if (!customElements.get('view-home')) {
    customElements.define('view-home', HomeView)
  }
}
