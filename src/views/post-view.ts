import MarkdownIt from 'markdown-it'
import { catJson } from '../services/ipfs'
import { relativeTime } from '../services/compositing'

const md = new MarkdownIt()

interface TextPost {
  title: string
  markdown: string
}

const STYLES = `
  :host { display: block; }

  .post {
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-input);
    padding: 1.5rem;
    margin-top: 0.5rem;
  }

  .post-title {
    margin: 0 0 0.75rem;
    font-family: var(--font-body);
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--text);
    line-height: 1.3;
  }

  .post-meta {
    font-family: var(--font-pixel);
    font-size: 0.5rem;
    letter-spacing: 1px;
    color: var(--text-muted);
    margin-bottom: 1rem;
  }

  .post-markdown {
    font-family: var(--font-body);
    font-size: 0.95rem;
    color: var(--text);
    line-height: 1.6;
  }

  .post-markdown h1, .post-markdown h2, .post-markdown h3 {
    margin: 1rem 0 0.5rem;
    line-height: 1.3;
  }

  .post-markdown p { margin: 0 0 0.75rem; }
  .post-markdown ul, .post-markdown ol { margin: 0 0 0.75rem; padding-left: 1.5rem; }
  .post-markdown code {
    background: var(--surface-inset);
    padding: 0.15em 0.35em;
    border-radius: 3px;
    font-size: 0.85em;
  }
  .post-markdown pre {
    background: var(--surface-inset);
    padding: 0.75rem;
    border-radius: var(--radius-md, 6px);
    overflow-x: auto;
    margin: 0 0 0.75rem;
  }
  .post-markdown pre code {
    background: none;
    padding: 0;
  }
  .post-markdown blockquote {
    border-left: 3px solid var(--border);
    margin: 0 0 0.75rem;
    padding: 0.25rem 0.75rem;
    color: var(--text-muted);
  }

  .back-link {
    display: inline-block;
    margin-bottom: 0.5rem;
    font-family: var(--font-pixel);
    font-size: 0.5rem;
    letter-spacing: 1.5px;
    color: var(--text-muted);
    text-decoration: none;
  }
  .back-link:hover { color: var(--text); }

  .status {
    text-align: center;
    padding: 3rem 1rem;
    font-family: var(--font-pixel);
    font-size: 0.6rem;
    letter-spacing: 2px;
    color: var(--text-muted);
  }
`

class PostView extends HTMLElement {
  private _root!: ShadowRoot

  connectedCallback() {
    if (this.shadowRoot) return
    this._root = this.attachShadow({ mode: 'open' })
    this._root.innerHTML = `<style>${STYLES}</style><div class="status">LOADING…</div>`
    this._load()
  }

  private async _load() {
    const params = new URLSearchParams(window.location.search)
    const cid = params.get('cid')
    const timestamp = Number(params.get('t')) || 0
    const peerId = params.get('peer') || ''

    if (!cid) {
      this._root.innerHTML = `<style>${STYLES}</style><a class="back-link" href="/">← BACK</a><div class="status">NO POST CID</div>`
      return
    }

    try {
      const post = await catJson<TextPost>(cid)
      const shortId = peerId.length > 16 ? `${peerId.slice(0, 8)}…${peerId.slice(-6)}` : peerId
      const timeStr = timestamp ? relativeTime(timestamp) : ''
      const rendered = md.render(post.markdown || '')

      this._root.innerHTML = `
        <style>${STYLES}</style>
        <a class="back-link" href="/">← BACK</a>
        <article class="post">
          ${post.title ? `<h1 class="post-title">${md.utils.escapeHtml(post.title)}</h1>` : ''}
          <div class="post-meta">${shortId}${timeStr ? ` · ${timeStr}` : ''}</div>
          <div class="post-markdown">${rendered}</div>
        </article>
      `
    } catch (err) {
      console.error('[post-view] Failed to load post:', err)
      this._root.innerHTML = `<style>${STYLES}</style><a class="back-link" href="/">← BACK</a><div class="status">FAILED TO LOAD POST</div>`
    }
  }
}

export function definePostView() {
  if (!customElements.get('view-post')) {
    customElements.define('view-post', PostView)
  }
}
