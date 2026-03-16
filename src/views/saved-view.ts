import {
  loadManifest, getMyPeerId, resolveFollowedPeer,
  fetchPeerPostBuckets, recentMonths,
  getAllMyPosts, getAllMyBookmarks, getAllMyLikes,
  likePost, unlikePost, bookmarkPost, unbookmarkPost,
} from '../services/profile'
import type { LikeRecord, BookmarkRecord } from '../services/profile'
import type { FeedPost } from '../components/feed-item'

type FeedItemElement = HTMLElement & { post: FeedPost; myPeerId: string }

const STYLES = `
  :host { display: block; }

  .header {
    font-family: var(--font-pixel);
    font-size: 0.65rem;
    letter-spacing: 2px;
    color: var(--text);
    margin-bottom: 0.75rem;
  }

  .feed-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
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

class SavedView extends HTMLElement {
  private _root!: ShadowRoot
  private _posts: FeedPost[] = []
  private _myPeerId = ''
  private _loading = true

  connectedCallback() {
    if (this.shadowRoot) return
    this._root = this.attachShadow({ mode: 'open' })
    this._root.innerHTML = `
      <style>${STYLES}</style>
      <div class="header">SAVED</div>
      <section class="content">
        <div class="status">LOADING…</div>
      </section>
    `
    this._bindInteractions()
    this._bindBookmarks()
    this._loadSaved()

    window.addEventListener('route-change', (e: Event) => {
      const { pathname } = (e as CustomEvent).detail
      if (pathname === '/saved') this._loadSaved()
    })
  }

  private _bindInteractions() {
    this._root.addEventListener('post-interact', (e: Event) => {
      const { target, author, strength } = (e as CustomEvent).detail as {
        target: string; author: string; strength: 0 | 1 | 2
      }

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

      for (const post of this._posts) {
        if (post.cid === target) post.myInteraction = strength
      }

      const op = strength === 0
        ? unlikePost(target)
        : likePost(target, author, strength)
      op.catch(err => console.warn('[saved] Interaction publish failed:', err))
    })
  }

  private _bindBookmarks() {
    this._root.addEventListener('post-bookmark', (e: Event) => {
      const { target, author, bookmarked } = (e as CustomEvent).detail as {
        target: string; author: string; bookmarked: boolean
      }

      // Optimistic UI — toggle bookmark state
      this._root.querySelectorAll('feed-item').forEach((el) => {
        const item = el as FeedItemElement
        if (item.post.cid !== target) return
        item.post = { ...item.post, bookmarked }
      })

      // If unbookmarked, remove from local list and DOM
      if (!bookmarked) {
        this._posts = this._posts.filter(p => p.cid !== target)
        this._root.querySelectorAll('feed-item').forEach((el) => {
          const item = el as FeedItemElement
          if (item.post.cid === target) el.remove()
        })
        if (this._posts.length === 0) {
          this._root.querySelector('.content')!.innerHTML =
            '<div class="status">NO SAVED POSTS</div>'
        }
      }

      const op = bookmarked
        ? bookmarkPost(target, author)
        : unbookmarkPost(target)
      op.catch(err => console.warn('[saved] Bookmark publish failed:', err))
    })
  }

  private async _loadSaved() {
    try {
      const manifest = loadManifest()
      const myPeerId = await getMyPeerId()
      this._myPeerId = myPeerId
      const months = recentMonths(3)

      const myBookmarks = getAllMyBookmarks()
      if (myBookmarks.length === 0) {
        this._loading = false
        this._posts = []
        this._renderList()
        return
      }

      const myLikes = getAllMyLikes()
      const myLikeMap = new Map<string, LikeRecord>()
      for (const l of myLikes) myLikeMap.set(l.target, l)

      const myBookmarkSet = new Set<string>()
      for (const b of myBookmarks) myBookmarkSet.add(b.target)

      // We need to find the actual post data for each bookmarked CID.
      // It could be our own post or a peer's post.
      // Collect all bookmarks keyed by target CID → BookmarkRecord
      const bookmarkMap = new Map<string, BookmarkRecord>()
      for (const b of myBookmarks) bookmarkMap.set(b.target, b)

      const posts: FeedPost[] = []

      // Check own posts
      const myPosts = getAllMyPosts()
      for (const p of myPosts) {
        if (!bookmarkMap.has(p.cid)) continue
        posts.push({
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
          bookmarked: true,
        })
        bookmarkMap.delete(p.cid)
      }

      // Check peer posts for remaining bookmarks
      if (bookmarkMap.size > 0) {
        const peerResults = await Promise.all(
          manifest.following.map(async (peerId) => {
            const result = await resolveFollowedPeer(peerId)
            if (!result) return null
            const peerManifest = result.manifest
            const inlinePosts = (peerManifest as any)._inlinePosts
            const peerPosts = inlinePosts
              ? inlinePosts
              : await fetchPeerPostBuckets(peerManifest, months)
            return { peerId, tagCid: peerManifest.tag, displayName: peerManifest.displayName || undefined, posts: peerPosts }
          })
        )

        for (const pr of peerResults) {
          if (!pr) continue
          for (const p of pr.posts) {
            if (!bookmarkMap.has(p.cid)) continue
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
              myInteraction: (myLikeMap.get(p.cid)?.strength ?? 0) as 0 | 1 | 2,
              bookmarked: true,
            })
            bookmarkMap.delete(p.cid)
          }
        }
      }

      // Sort by bookmark time (newest bookmarks first)
      const bookmarkOrder = new Map<string, number>()
      for (const b of myBookmarks) bookmarkOrder.set(b.target, b.timestamp)
      posts.sort((a, b) => (bookmarkOrder.get(b.cid) ?? 0) - (bookmarkOrder.get(a.cid) ?? 0))

      this._posts = posts
      this._loading = false
      this._renderList()
    } catch (err) {
      console.error('[saved] Failed to load saved posts:', err)
      this._root.querySelector('.content')!.innerHTML =
        '<div class="status">FAILED TO LOAD SAVED POSTS</div>'
    }
  }

  private _renderList() {
    const content = this._root.querySelector('.content')!

    if (this._loading) {
      content.innerHTML = '<div class="status">LOADING…</div>'
      return
    }

    if (this._posts.length === 0) {
      content.innerHTML = '<div class="status">NO SAVED POSTS</div>'
      return
    }

    const feed = document.createElement('div')
    feed.className = 'feed-list'

    for (const post of this._posts) {
      const item = document.createElement('feed-item') as FeedItemElement
      item.myPeerId = this._myPeerId
      item.post = post
      feed.appendChild(item)
    }

    content.innerHTML = ''
    content.appendChild(feed)
  }
}

export function defineSavedView() {
  if (!customElements.get('view-saved')) {
    customElements.define('view-saved', SavedView)
  }
}
