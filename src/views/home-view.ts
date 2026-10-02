import {
  loadManifest, getMyPeerId, resolveFollowedPeer, resolveCachedPeer,
  fetchPeerPostBuckets, fetchPeerInteractions, fetchPeerBookmarks,
  recentMonths, getAllMyPosts, getAllMyLikes, getAllMyBookmarks,
  likePost, unlikePost, bookmarkPost, unbookmarkPost,
} from '../services/profile'
import type {
  LikeRecord, BookmarkRecord, ResolvedManifest, WallManifest, WallPost,
  PeerResolution, PeerInteractions,
} from '../services/profile'
import type { FeedPost } from '../components/feed-item'
import type { WallScrollElement } from '../components/wall-scroll'

type FeedItemElement = HTMLElement & { post: FeedPost; myPeerId: string }

interface PeerData {
  peerId: string
  tagCid: string
  displayName?: string
  posts: WallPost[]
  interactions: PeerInteractions
  stale: boolean
  resolvedAt: number
}

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

  .finding {
    text-align: center;
    padding: 0.25rem 1rem 0.75rem;
    font-family: var(--font-pixel);
    font-size: 0.5rem;
    letter-spacing: 2px;
    color: var(--text-muted);
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
  private _manifest: WallManifest | null = null
  /** Latest known data for each followed peer (cached or live). */
  private readonly _peers = new Map<string, PeerData>()
  /** Peers whose live resolution is still in flight. */
  private readonly _pendingPeers = new Set<string>()
  /** Peers we couldn't load at all on the last attempt (no live or cached data). */
  private readonly _unreachablePeers = new Set<string>()
  private _renderTimer: ReturnType<typeof setTimeout> | null = null
  private _lastSignature = ''

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
    this._bindBookmarks()
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

  private _bindBookmarks() {
    this._root.addEventListener('post-bookmark', (e: Event) => {
      const { target, author, bookmarked } = (e as CustomEvent).detail as {
        target: string; author: string; bookmarked: boolean
      }

      // Optimistic UI update
      this._root.querySelectorAll('feed-item').forEach((el) => {
        const item = el as FeedItemElement
        if (item.post.cid !== target) return
        item.post = { ...item.post, bookmarked }
      })

      for (const post of this._posts) {
        if (post.cid === target) post.bookmarked = bookmarked
      }

      // Persist to IPFS in background
      const op = bookmarked
        ? bookmarkPost(target, author)
        : unbookmarkPost(target)
      op.catch(err => console.warn('[home] Bookmark publish failed:', err))
    })
  }

  private async _loadFeed() {
    try {
      const manifest = loadManifest()
      this._myPeerId = await getMyPeerId()
      this._manifest = manifest

      // Forget peers that are no longer followed
      for (const peerId of [...this._peers.keys()]) {
        if (!manifest.following.includes(peerId)) this._peers.delete(peerId)
      }
      for (const peerId of [...this._unreachablePeers]) {
        if (!manifest.following.includes(peerId)) this._unreachablePeers.delete(peerId)
      }

      // Own posts are local: show them (plus any peers we already have) at once
      this._loading = false
      this._rebuildPosts()

      // Each followed peer loads independently and is merged in as it arrives
      for (const peerId of manifest.following) this._loadPeer(peerId)
    } catch (err) {
      console.error('[home] Failed to load feed:', err)
      const content = this._root.querySelector('.content')!
      content.innerHTML = '<div class="status">FAILED TO LOAD FEED</div>'
    }
  }

  /** Load one followed peer: last-known (cached) wall first, then the live one. */
  private async _loadPeer(peerId: string) {
    if (this._pendingPeers.has(peerId)) return
    this._pendingPeers.add(peerId)
    this._scheduleRender()

    const months = recentMonths(3)
    const load = async (result: PeerResolution | null): Promise<PeerData | null> => {
      if (!result) return null
      const peerManifest = result.manifest
      const inlinePosts = (peerManifest as ResolvedManifest)._inlinePosts
      const [posts, interactions] = await Promise.all([
        inlinePosts ? Promise.resolve(inlinePosts) : fetchPeerPostBuckets(peerManifest, months),
        fetchPeerInteractions(peerManifest, months),
      ])
      return {
        peerId,
        tagCid: peerManifest.tag,
        displayName: peerManifest.displayName || undefined,
        posts,
        interactions,
        stale: result.stale,
        resolvedAt: result.resolvedAt,
      }
    }

    try {
      // Cached first, unless we already have something for this peer
      if (!this._peers.has(peerId)) {
        const cached = await load(await resolveCachedPeer(peerId)).catch(() => null)
        if (cached && !this._peers.has(peerId)) {
          this._peers.set(peerId, cached)
          this._scheduleRender()
        }
      }

      const live = await load(await resolveFollowedPeer(peerId))
      if (live && this._manifest?.following.includes(peerId)) this._peers.set(peerId, live)
      if (live || this._peers.has(peerId)) this._unreachablePeers.delete(peerId)
      else this._unreachablePeers.add(peerId)
    } catch (err) {
      console.warn('[home] Failed to load peer', peerId, err)
    } finally {
      this._pendingPeers.delete(peerId)
      this._scheduleRender()
    }
  }

  /** Coalesce bursts of peer arrivals into one rebuild + render. */
  private _scheduleRender() {
    if (this._renderTimer) return
    this._renderTimer = setTimeout(() => {
      this._renderTimer = null
      this._rebuildPosts()
    }, 250)
  }

  /** Merge own data and every loaded peer into the feed, then re-render if it changed. */
  private _rebuildPosts() {
    const manifest = this._manifest
    if (!manifest) return
    const myPeerId = this._myPeerId

    // ── Own data ──
    const myPosts = getAllMyPosts()
    const myLikes = getAllMyLikes()
    const myLikeMap = new Map<string, LikeRecord>()
    for (const l of myLikes) myLikeMap.set(l.target, l)

    const myBookmarks = getAllMyBookmarks()
    const myBookmarkSet = new Set<string>()
    for (const b of myBookmarks) myBookmarkSet.add(b.target)

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
      bookmarked: myBookmarkSet.has(p.cid),
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

    for (const pr of this._peers.values()) {
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
          bookmarked: myBookmarkSet.has(p.cid),
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

    // Only re-render when something visible changed, so a background refresh
    // that finds nothing new doesn't reset the scroll position.
    const signature = JSON.stringify(
      posts.map(p => [p.cid, p.stale, p.likeCount, p.reallyLikeCount, p.reallyLikedBy, p.myInteraction, p.bookmarked]),
    )
    this._posts = posts
    if (signature === this._lastSignature && this._root.querySelector('.content > :not(.status)')) {
      this._updateFinding()
      return
    }
    this._lastSignature = signature
    this._renderView()
  }

  /** Show how many followed walls are still being found, without re-rendering the feed. */
  private _updateFinding() {
    const content = this._root.querySelector('.content')!
    const pending = this._pendingPeers.size
    const following = this._manifest?.following.length ?? 0

    if (this._posts.length === 0) {
      if (pending > 0) {
        content.innerHTML = '<div class="status">FINDING WALLS ON THE NETWORK…<br><br>WITH NO SERVERS THIS CAN TAKE A MINUTE</div>'
      } else if (this._unreachablePeers.size > 0) {
        content.innerHTML = '<div class="status">COULDN\'T REACH THE WALLS YOU FOLLOW<br><br>THEIR OWNERS MAY BE OFFLINE, OR NOT PINNING<br><br>PAINT YOUR OWN TO GET STARTED</div>'
      } else {
        content.innerHTML = '<div class="status">NO POSTS YET</div>'
      }
      return
    }

    let finding = content.querySelector<HTMLElement>('.finding')
    if (pending === 0) {
      finding?.remove()
      return
    }
    if (!finding) {
      finding = document.createElement('div')
      finding.className = 'finding'
      content.prepend(finding)
    }
    finding.textContent = `FINDING ${pending} OF ${following} WALL${following === 1 ? '' : 'S'}…`
  }

  private _renderView() {
    const content = this._root.querySelector('.content')!

    if (this._loading) {
      content.innerHTML = '<div class="status">LOADING…</div>'
      return
    }

    if (this._posts.length === 0) {
      this._updateFinding()
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

    this._updateFinding()
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
