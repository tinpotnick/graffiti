import { loadManifest, getMyPeerId, resolveFollowedPeer } from '../services/profile'
import type { FeedPost } from '../components/feed-item'

type FeedItemElement = HTMLElement & { post: FeedPost }

const STYLES = `
  :host { display: block; }

  .feed {
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

class HomeView extends HTMLElement {
  private _root!: ShadowRoot

  connectedCallback() {
    if (this.shadowRoot) return
    this._root = this.attachShadow({ mode: 'open' })
    this._root.innerHTML = `
      <style>${STYLES}</style>
      <section class="feed">
        <div class="status">LOADING…</div>
      </section>
    `
    this._loadFeed()
  }

  private async _loadFeed() {
    const feed = this._root.querySelector('.feed')!

    try {
      const manifest = loadManifest()
      const myPeerId = await getMyPeerId()

      // Own posts
      const posts: FeedPost[] = manifest.wall.map(p => ({
        cid: p.cid,
        caption: p.caption,
        timestamp: p.timestamp,
        peerId: myPeerId,
        tagCid: manifest.tag,
      }))

      // Resolve followed peers in parallel
      const peerResults = await Promise.all(
        manifest.following.map(async (peerId) => {
          const peerManifest = await resolveFollowedPeer(peerId)
          if (!peerManifest) return []
          return peerManifest.wall.map(p => ({
            cid: p.cid,
            caption: p.caption,
            timestamp: p.timestamp,
            peerId,
            tagCid: peerManifest.tag,
          }))
        })
      )
      for (const peerPosts of peerResults) {
        posts.push(...peerPosts)
      }

      // Sort newest first
      posts.sort((a, b) => b.timestamp - a.timestamp)

      feed.innerHTML = ''

      if (posts.length === 0) {
        feed.innerHTML = '<div class="status">NO POSTS YET</div>'
        return
      }

      for (const post of posts) {
        const item = document.createElement('feed-item') as FeedItemElement
        item.post = post
        feed.appendChild(item)
      }
    } catch (err) {
      console.error('[home] Failed to load feed:', err)
      feed.innerHTML = '<div class="status">FAILED TO LOAD FEED</div>'
    }
  }
}

export function defineHomeView() {
  if (!customElements.get('view-home')) {
    customElements.define('view-home', HomeView)
  }
}
