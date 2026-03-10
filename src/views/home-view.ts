import {
  loadManifest, getMyPeerId, resolveFollowedPeer,
  fetchPeerPostBuckets, fetchPeerInteractions,
  recentMonths, getAllMyPosts, getAllMyLikes,
  likePost, unlikePost,
} from '../services/profile'
import type { LikeRecord, ResolvedManifest } from '../services/profile'
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
    this._bindInteractions()
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

  private _bindInteractions() {
    this._root.addEventListener('post-interact', (e: Event) => {
      const { target, author, strength } = (e as CustomEvent).detail as {
        target: string; author: string; strength: 0 | 1 | 2
      }

      // Optimistic UI update — build new state from each item's own current state
      this._root.querySelectorAll('feed-item').forEach((el) => {
        const item = el as FeedItemElement
        if (item.post.cid !== target) return
        const prev = item.post
        const oldStr = prev.myInteraction ?? 0
        item.post = {
          ...prev,
          myInteraction: strength,
          likeCount: Math.max(0, (prev.likeCount ?? 0) - (oldStr === 1 ? 1 : 0) + (strength === 1 ? 1 : 0)),
          reallyLikeCount: Math.max(0, (prev.reallyLikeCount ?? 0) - (oldStr === 2 ? 1 : 0) + (strength === 2 ? 1 : 0)),
        }
      })

      // Keep this._posts in sync for next full render
      for (const post of this._posts) {
        if (post.cid === target) post.myInteraction = strength
      }

      // Persist to IPFS in background
      const op = strength === 0
        ? unlikePost(target)
        : likePost(target, author, strength)
      op.catch(err => console.warn('[home] Interaction publish failed:', err))
    })
  }

  private async _loadFeed() {
    try {
      const manifest = loadManifest()
      const myPeerId = await getMyPeerId()
      this._myPeerId = myPeerId
      const months = recentMonths(3)

      // ── Own data ──
      const myPosts = getAllMyPosts()
      const myLikes = getAllMyLikes()
      const myLikeMap = new Map<string, LikeRecord>()
      for (const l of myLikes) myLikeMap.set(l.target, l)

      // Build FeedPost[] from own posts
      const posts: FeedPost[] = myPosts.map(p => ({
        cid: p.cid,
        caption: p.caption,
        timestamp: p.timestamp,
        peerId: myPeerId,
        tagCid: manifest.tag,
        displayName: manifest.displayName || undefined,
        type: p.type,
        title: p.title,
        updatedAt: p.updatedAt,
        bounds: p.x != null ? { x: p.x, y: p.y!, w: p.w!, h: p.h! } : undefined,
        wallRef: p.wallRef,
        wallBounds: p.wallBounds,
        myInteraction: (myLikeMap.get(p.cid)?.strength ?? 0) as 0 | 1 | 2,
      }))

      // ── Interaction counts ──
      const interactionCounts = new Map<string, { likes: number; reallyLikes: number }>()
      const allReallyLikes: Array<LikeRecord & { byPeerId: string; byTagCid: string; byName?: string }> = []

      // Count own likes
      for (const l of myLikes) {
        const c = interactionCounts.get(l.target) ?? { likes: 0, reallyLikes: 0 }
        if (l.strength === 1) c.likes++
        else c.reallyLikes++
        interactionCounts.set(l.target, c)
      }

      // ── Resolve peers ──
      const peerResults = await Promise.all(
        manifest.following.map(async (peerId) => {
          const result = await resolveFollowedPeer(peerId)
          if (!result) return null
          const peerManifest = result.manifest

          const inlinePosts = (peerManifest as ResolvedManifest)._inlinePosts
          const [peerPosts, peerInteractions] = await Promise.all([
            inlinePosts
              ? Promise.resolve(inlinePosts)
              : fetchPeerPostBuckets(peerManifest, months),
            fetchPeerInteractions(peerManifest, months),
          ])

          return {
            peerId,
            tagCid: peerManifest.tag,
            displayName: peerManifest.displayName || undefined,
            posts: peerPosts,
            interactions: peerInteractions,
            stale: result.stale,
            resolvedAt: result.resolvedAt,
          }
        })
      )

      for (const pr of peerResults) {
        if (!pr) continue

        // Add peer posts to feed
        for (const p of pr.posts) {
          posts.push({
            cid: p.cid,
            caption: p.caption,
            timestamp: p.timestamp,
            peerId: pr.peerId,
            tagCid: pr.tagCid,
            displayName: pr.displayName,
            type: p.type,
            title: p.title,
            updatedAt: p.updatedAt,
            bounds: p.x != null ? { x: p.x, y: p.y!, w: p.w!, h: p.h! } : undefined,
            wallRef: p.wallRef,
            wallBounds: p.wallBounds,
            stale: pr.stale,
            resolvedAt: pr.resolvedAt,
            myInteraction: (myLikeMap.get(p.cid)?.strength ?? 0) as 0 | 1 | 2,
          })
        }

        // Aggregate interaction counts
        for (const l of pr.interactions.likes) {
          const c = interactionCounts.get(l.target) ?? { likes: 0, reallyLikes: 0 }
          if (l.strength === 1) c.likes++
          else c.reallyLikes++
          interactionCounts.set(l.target, c)

          if (l.strength === 2) {
            allReallyLikes.push({
              ...l,
              byPeerId: pr.peerId,
              byTagCid: pr.tagCid,
              byName: pr.displayName,
            })
          }
        }
      }

      // ── Inject really-likes as feed items (repost-style) ──
      for (const rl of allReallyLikes) {
        const original = posts.find(p => p.cid === rl.target)
        if (original) {
          posts.push({
            ...original,
            timestamp: rl.timestamp,
            reallyLikedBy: rl.byPeerId,
            reallyLikedByTagCid: rl.byTagCid,
            reallyLikedByName: rl.byName,
          })
        }
      }

      // ── Apply interaction counts to all posts ──
      for (const post of posts) {
        const counts = interactionCounts.get(post.cid)
        if (counts) {
          post.likeCount = counts.likes
          post.reallyLikeCount = counts.reallyLikes
        }
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
