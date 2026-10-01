import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { getMyPeerId, loadManifest, followPeer, unfollowPeer, setDisplayName, getAllMyPosts, getAllMyLikes, deletePost, resolveFollowedPeer, fetchPeerInteractions, recentMonths } from '../services/profile'
import type { WallPost } from '../services/profile'
import { catBytes } from '../services/ipfs'
import { hasPinataJwt, setPinataJwt, clearPinataJwt, getPinataGateway, setPinataGateway, clearPinataGateway } from '../services/pinning'
import { getTheme, setTheme } from '../main'
import type { ThemeChoice } from '../main'
import { navigate } from '../shell/paths'

type TabName = 'profile' | 'posts' | 'settings'

const STYLES = `
  :host {
    display: block;
    font-family: var(--font-body);
    color: var(--text);
  }

  .view {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-top: 0.5rem;
  }

  h2 {
    margin: 0 0 1rem;
    font-size: 0.7rem;
    font-family: var(--font-pixel);
    letter-spacing: 2px;
    color: var(--text-secondary);
  }

  /* ── Profile header (always visible) ─── */
  .profile-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.5rem;
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-input);
  }

  .avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    image-rendering: pixelated;
    background: var(--surface-inset);
    border: 2px solid var(--border);
    object-fit: cover;
    flex-shrink: 0;
  }

  .avatar-placeholder {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--surface-inset);
    border: 2px dashed var(--border-medium);
    flex-shrink: 0;
  }

  .header-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .name-row {
    display: flex;
    gap: 0.5rem;
  }

  .name-input {
    flex: 1;
    min-width: 0;
    font-family: var(--font-body);
    font-size: 0.85rem;
    padding: 0.5rem 0.65rem;
    background: var(--surface-inset);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-md);
    color: var(--text);
    outline: none;
    transition: border-color 150ms;
  }
  .name-input:focus { border-color: var(--accent); }
  .name-input::placeholder { color: var(--text-muted); }

  /* ── QR + Peer ID (inside profile tab) ── */
  .qr-card {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 1.5rem;
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-input);
  }

  #qr-canvas {
    display: block;
    border-radius: var(--radius-md);
    image-rendering: pixelated;
    flex-shrink: 0;
  }

  .qr-placeholder {
    width: 140px;
    height: 140px;
    border-radius: var(--radius-md);
    background: var(--surface-inset);
    border: 1px dashed var(--border-medium);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.55rem;
    font-family: var(--font-pixel);
    letter-spacing: 1.5px;
    color: var(--text-muted);
    text-align: center;
    padding: 0.75rem;
    flex-shrink: 0;
  }

  .qr-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .qr-label {
    font-family: var(--font-pixel);
    font-size: 0.5rem;
    letter-spacing: 2px;
    color: var(--text-muted);
  }

  .code-text {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--text-secondary);
    background: var(--surface-inset);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0.5rem 0.65rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    user-select: all;
    cursor: text;
    word-break: break-all;
  }

  .code-text.empty {
    color: var(--text-muted);
    font-style: italic;
    font-family: var(--font-body);
    font-size: 0.8rem;
  }

  /* ── Tab bar ───────────────────────────── */
  .tab-bar {
    display: flex;
  }

  .tab-btn {
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
  .tab-btn:first-child {
    border-radius: var(--radius-md) 0 0 var(--radius-md);
    border-right: none;
  }
  .tab-btn:nth-child(2) {
    border-right: none;
  }
  .tab-btn:last-child {
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
  }
  .tab-btn.active {
    background: var(--accent);
    color: var(--text-inverse);
    border-color: var(--accent);
  }

  .tab-panel { display: none; }
  .tab-panel.active {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* ── Buttons ───────────────────────── */
  .btn {
    padding: 0.6rem 1rem;
    font-family: var(--font-pixel);
    font-size: 0.6rem;
    letter-spacing: 1.5px;
    cursor: pointer;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-medium);
    background: var(--surface-raised);
    color: var(--text);
    box-shadow: var(--shadow-btn);
    transition: transform 150ms, box-shadow 150ms;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .btn:hover { transform: translateY(-1px); box-shadow: var(--shadow-btn-hover); }
  .btn:active { transform: translateY(0); }
  .btn:disabled { opacity: 0.4; cursor: default; transform: none; box-shadow: var(--shadow-btn); }

  .btn-primary {
    background: var(--accent);
    color: var(--text-inverse);
    border-color: transparent;
    box-shadow: var(--shadow-btn-active);
  }

  .btn-outline {
    justify-content: center;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.7rem 1rem;
  }
  .btn-outline svg {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .scan-row {
    display: flex;
    gap: 0.5rem;
  }
  .scan-row .btn-outline {
    flex: 1;
    min-width: 0;
    font-size: 0.5rem;
  }

  /* ── Status messages ───────────────── */
  .status {
    margin: 0.6rem 0 0;
    font-size: 0.72rem;
    min-height: 1.1em;
    color: transparent;
    font-family: var(--font-body);
  }
  .status[data-state="ok"]    { color: #16a34a; }
  .status[data-state="error"] { color: #dc2626; }
  .status[data-state="info"]  { color: var(--text-secondary); }

  /* ── Add contact ───────────────────── */
  .add-card {
    padding: 1.5rem;
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-input);
  }

  .input-row {
    display: flex;
    gap: 0.5rem;
  }

  .peer-input {
    flex: 1;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    padding: 0.6rem 0.75rem;
    background: var(--surface-inset);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-md);
    color: var(--text);
    outline: none;
    transition: border-color 150ms;
  }
  .peer-input:focus { border-color: var(--accent); }
  .peer-input::placeholder { color: var(--text-muted); font-family: var(--font-body); }

  .divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 1rem 0;
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* ── Following section ─────────────── */
  .following-card {
    padding: 1.5rem;
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-input);
  }

  .following-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .following-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.65rem;
    background: var(--surface-inset);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .following-id {
    flex: 1;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove-btn {
    flex-shrink: 0;
    padding: 0.25rem 0.6rem;
    font-family: var(--font-pixel);
    font-size: 0.55rem;
    letter-spacing: 1px;
    cursor: pointer;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-medium);
    background: transparent;
    color: var(--text-muted);
    transition: color 150ms, border-color 150ms;
  }
  .remove-btn:hover { color: #dc2626; border-color: #dc2626; }

  .empty-following {
    font-size: 0.8rem;
    color: var(--text-muted);
    text-align: center;
    padding: 0.5rem 0;
  }

  /* ── Camera overlay ─────────────── */
  .camera-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: #000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .camera-overlay video {
    width: 100%;
    max-height: 80vh;
    object-fit: cover;
  }
  .camera-guide {
    position: absolute;
    width: 220px;
    height: 220px;
    border: 3px solid rgba(255,255,255,0.6);
    border-radius: var(--radius-xl, 12px);
    pointer-events: none;
  }
  .camera-close {
    position: absolute;
    bottom: calc(2rem + env(safe-area-inset-bottom, 0px));
    background: rgba(255,255,255,0.15) !important;
    color: #fff !important;
    border-color: rgba(255,255,255,0.3) !important;
  }

  /* ── My Posts section ─────────── */
  .posts-card {
    padding: 1.5rem;
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-input);
  }

  .posts-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .post-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.65rem;
    background: var(--surface-inset);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .post-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .post-title {
    font-family: var(--font-body);
    font-size: 0.82rem;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .post-date {
    font-family: var(--font-pixel);
    font-size: 0.45rem;
    letter-spacing: 1px;
    color: var(--text-muted);
  }

  .post-badge {
    font-family: var(--font-pixel);
    font-size: 0.4rem;
    letter-spacing: 1px;
    color: var(--text-muted);
    opacity: 0.7;
    margin-left: 0.3rem;
  }

  .post-actions {
    display: flex;
    gap: 0.3rem;
    flex-shrink: 0;
  }

  .post-edit-btn,
  .post-delete-btn {
    flex-shrink: 0;
    padding: 0.25rem 0.6rem;
    font-family: var(--font-pixel);
    font-size: 0.55rem;
    letter-spacing: 1px;
    cursor: pointer;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-medium);
    background: transparent;
    color: var(--text-muted);
    transition: color 150ms, border-color 150ms;
  }
  .post-edit-btn:hover { color: var(--accent); border-color: var(--accent); }
  .post-delete-btn:hover { color: #dc2626; border-color: #dc2626; }

  .post-likes {
    font-family: var(--font-pixel);
    font-size: 0.45rem;
    letter-spacing: 1px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 0.2rem;
    flex-shrink: 0;
  }
  .post-likes svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .post-likes.has-likes { color: #e5395e; }
  .post-likes.has-likes svg { fill: #e5395e; stroke: #e5395e; }

  .empty-posts {
    font-size: 0.8rem;
    color: var(--text-muted);
    text-align: center;
    padding: 0.5rem 0;
  }

  /* ── Settings section ──────────────── */
  .settings-card {
    padding: 1.5rem;
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-input);
  }

  .jwt-input {
    width: 100%;
    box-sizing: border-box;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    padding: 0.6rem 0.75rem;
    background: var(--surface-inset);
    border: 1px solid var(--border-medium);
    border-radius: var(--radius-md);
    color: var(--text);
    outline: none;
    transition: border-color 150ms;
    margin-bottom: 0.5rem;
  }
  .jwt-input:focus { border-color: var(--accent); }
  .jwt-input::placeholder { color: var(--text-muted); font-family: var(--font-body); }

  .settings-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .pin-badge {
    font-family: var(--font-pixel);
    font-size: 0.55rem;
    letter-spacing: 1px;
    padding: 0.2rem 0.5rem;
    border-radius: var(--radius-sm);
    border: 1px solid;
  }
  .pin-badge.ok    { color: #16a34a; border-color: #16a34a; }
  .pin-badge.warn  { color: #d97706; border-color: #d97706; }

  /* ── Theme toggle ──────────────── */
  .theme-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }
  .theme-btn {
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
  .theme-btn:first-child { border-radius: var(--radius-md) 0 0 var(--radius-md); border-right: none; }
  .theme-btn:nth-child(2) { border-right: none; }
  .theme-btn:last-child  { border-radius: 0 var(--radius-md) var(--radius-md) 0; }
  .theme-btn.active {
    background: var(--accent);
    color: var(--text-inverse);
    border-color: var(--accent);
  }
`

class AccountView extends HTMLElement {
  private _root!: ShadowRoot
  private _peerId = ''
  private _activeTab: TabName = 'profile'

  connectedCallback() {
    if (this.shadowRoot) return
    this._activeTab = (localStorage.getItem('graffiti:account-tab') as TabName) || 'profile'
    this._root = this.attachShadow({ mode: 'open' })
    this._render()
    this._loadProfile()
    this._bindName()
    this._bindTabs()
    this._renderFollowing()
    this._renderMyPosts()
    this._bindEvents()
    this._bindTheme()
    this._bindSettings()
  }

  private _render() {
    this._root.innerHTML = `
      <style>${STYLES}</style>
      <div class="view">
        <section class="profile-header">
          <div id="avatar-wrap"><div class="avatar-placeholder"></div></div>
          <div class="header-info">
            <div class="name-row">
              <input class="name-input" id="name-input" type="text"
                placeholder="Display name…" maxlength="40" autocomplete="off" spellcheck="false">
              <button class="btn btn-primary" id="name-save-btn">SAVE</button>
            </div>
            <p class="status" id="name-status"></p>
          </div>
        </section>

        <div class="tab-bar" id="tab-bar">
          <button class="tab-btn" data-tab="profile">PROFILE</button>
          <button class="tab-btn" data-tab="posts">POSTS</button>
          <button class="tab-btn" data-tab="settings">SETTINGS</button>
        </div>

        <div class="tab-panel" data-tab="profile" id="panel-profile">
          <section class="qr-card">
            <div id="qr-wrap">
              <div class="qr-placeholder" id="qr-placeholder">LOADING…</div>
            </div>
            <div class="qr-info">
              <span class="qr-label">IPNS HASH</span>
              <code class="code-text empty" id="peer-id-text">loading…</code>
              <button class="btn" id="copy-btn" disabled>COPY</button>
            </div>
          </section>

          <section class="add-card">
            <h2>ADD CONTACT</h2>
            <div class="input-row">
              <input class="peer-input" id="peer-input" type="text"
                placeholder="Paste share code (PeerID)…" autocomplete="off" spellcheck="false">
              <button class="btn btn-primary" id="add-btn">ADD</button>
            </div>
            <p class="divider">or</p>
            <div class="scan-row">
              <button class="btn btn-outline" id="camera-btn" style="display:none">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                CAMERA
              </button>
              <button class="btn btn-outline" id="scan-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="5" height="5" rx="0.5"/>
                  <rect x="16" y="3" width="5" height="5" rx="0.5"/>
                  <rect x="3" y="16" width="5" height="5" rx="0.5"/>
                  <path d="M21 16h-3v3M21 21h-2M16 21v-2M13 3v5h2M13 11h5v2M21 11v1"/>
                </svg>
                SCAN IMAGE
              </button>
            </div>
            <input type="file" id="scan-input" accept="image/*" style="display:none">
            <div class="camera-overlay" id="camera-overlay" style="display:none">
              <video id="camera-video" autoplay playsinline></video>
              <canvas id="camera-canvas" style="display:none"></canvas>
              <div class="camera-guide"></div>
              <button class="btn camera-close" id="camera-close">CLOSE</button>
            </div>
            <p class="status" id="add-status"></p>
          </section>

          <section class="following-card">
            <h2>FOLLOWING</h2>
            <ul class="following-list" id="following-list"></ul>
          </section>
        </div>

        <div class="tab-panel" data-tab="posts" id="panel-posts">
          <section class="posts-card">
            <h2>MY POSTS</h2>
            <ul class="posts-list" id="posts-list"></ul>
          </section>
        </div>

        <div class="tab-panel" data-tab="settings" id="panel-settings">
          <section class="settings-card">
            <h2>THEME</h2>
            <div class="theme-row" id="theme-row">
              <button class="theme-btn" data-theme="light">LIGHT</button>
              <button class="theme-btn" data-theme="dark">DARK</button>
              <button class="theme-btn" data-theme="system">SYSTEM</button>
            </div>
          </section>

          <section class="settings-card">
            <h2>PINATA</h2>
            <input class="jwt-input" id="jwt-input" type="password"
              placeholder="Pinata JWT (for remote pinning)…" autocomplete="off" spellcheck="false">
            <div class="settings-row">
              <button class="btn btn-primary" id="jwt-save-btn">SAVE</button>
              <button class="btn" id="jwt-clear-btn">CLEAR</button>
              <span class="pin-badge" id="pin-badge"></span>
            </div>
            <p class="status" id="jwt-status"></p>

            <input class="jwt-input" id="gw-input" type="text"
              placeholder="Pinata gateway (e.g. https://mygateway.mypinata.cloud)…" autocomplete="off" spellcheck="false"
              style="margin-top: 1rem">
            <div class="settings-row">
              <button class="btn btn-primary" id="gw-save-btn">SAVE</button>
              <button class="btn" id="gw-clear-btn">CLEAR</button>
              <span class="pin-badge" id="gw-badge"></span>
            </div>
            <p class="status" id="gw-status"></p>
          </section>
        </div>
      </div>
    `
  }

  private _bindTabs() {
    this._updateTabs()
    this._root.querySelector('#tab-bar')!.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.tab-btn')
      if (!btn?.dataset.tab) return
      const next = btn.dataset.tab as TabName
      if (next === this._activeTab) return
      this._activeTab = next
      try { localStorage.setItem('graffiti:account-tab', next) } catch {}
      this._updateTabs()
    })
  }

  private _updateTabs() {
    this._root.querySelectorAll<HTMLElement>('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === this._activeTab)
    })
    this._root.querySelectorAll<HTMLElement>('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.tab === this._activeTab)
    })
  }

  private async _loadProfile() {
    const placeholder = this._root.querySelector<HTMLElement>('#qr-placeholder')!
    const codeEl = this._root.querySelector<HTMLElement>('#peer-id-text')!
    const copyBtn = this._root.querySelector<HTMLButtonElement>('#copy-btn')!
    const avatarWrap = this._root.querySelector<HTMLElement>('#avatar-wrap')!

    try {
      this._peerId = await getMyPeerId()

      // Load avatar (tag.png)
      const manifest = loadManifest()
      if (manifest.tag) {
        try {
          const bytes = await catBytes(manifest.tag)
          const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'image/png' })
          const img = document.createElement('img')
          img.className = 'avatar'
          img.src = URL.createObjectURL(blob)
          img.alt = 'My tag'
          avatarWrap.innerHTML = ''
          avatarWrap.appendChild(img)
        } catch { /* tag unavailable */ }
      }

      // QR code
      const style = getComputedStyle(document.documentElement)
      const qrDark = style.getPropertyValue('--text').trim() || '#0b0b0b'
      const qrLight = style.getPropertyValue('--surface').trim() || '#fafafa'
      const dataUrl = await QRCode.toDataURL(this._peerId, {
        width: 140,
        margin: 2,
        color: { dark: qrDark, light: qrLight },
      })
      const qrImg = document.createElement('img')
      qrImg.id = 'qr-canvas'
      qrImg.width = 140
      qrImg.height = 140
      qrImg.src = dataUrl
      placeholder.replaceWith(qrImg)

      codeEl.textContent = this._peerId
      codeEl.classList.remove('empty')
      copyBtn.disabled = false
    } catch {
      placeholder.textContent = 'START APP\nTO SEE\nPROFILE'
      codeEl.textContent = 'not available in browser mode'
    }
  }

  private _bindName() {
    const nameInput = this._root.querySelector<HTMLInputElement>('#name-input')!
    const saveBtn = this._root.querySelector<HTMLButtonElement>('#name-save-btn')!
    const status = this._root.querySelector<HTMLElement>('#name-status')!

    const manifest = loadManifest()
    if (manifest.displayName) nameInput.value = manifest.displayName

    saveBtn.addEventListener('click', () => {
      const val = nameInput.value.trim()
      setDisplayName(val)
      this._setStatus(status, 'ok', val ? 'NAME SAVED.' : 'NAME CLEARED.')
      setTimeout(() => this._setStatus(status, '', ''), 3000)
    })

    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveBtn.click()
    })
  }

  private _renderFollowing() {
    const list = this._root.querySelector<HTMLElement>('#following-list')!
    const manifest = loadManifest()
    list.innerHTML = ''

    if (manifest.following.length === 0) {
      list.innerHTML = '<li class="empty-following">No contacts yet.</li>'
      return
    }

    manifest.following.forEach(id => {
      const li = document.createElement('li')
      li.className = 'following-item'
      const short = id.length > 24 ? `${id.slice(0, 12)}…${id.slice(-8)}` : id
      li.innerHTML = `
        <span class="following-id" title="${id}">${short}</span>
        <button class="remove-btn" data-peer-id="${id}">REMOVE</button>
      `
      list.appendChild(li)
    })
  }

  private _renderMyPosts() {
    const list = this._root.querySelector<HTMLElement>('#posts-list')!
    const posts = getAllMyPosts().sort((a, b) => b.timestamp - a.timestamp)
    list.innerHTML = ''

    if (posts.length === 0) {
      list.innerHTML = '<li class="empty-posts">No posts yet.</li>'
      return
    }

    const heartSvg = '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>'

    for (const post of posts) {
      const li = document.createElement('li')
      li.className = 'post-item'

      const label = post.type === 'text'
        ? (post.title || 'Untitled')
        : (post.caption ? `Wall: ${post.caption}` : 'Wall post')
      const date = new Date(post.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      const edited = post.updatedAt ? '<span class="post-badge">EDITED</span>' : ''

      const actions = post.type === 'text'
        ? `<button class="post-edit-btn" data-cid="${post.cid}">EDIT</button>
           <button class="post-delete-btn" data-cid="${post.cid}">DELETE</button>`
        : `<button class="post-delete-btn" data-cid="${post.cid}">DELETE</button>`

      li.innerHTML = `
        <div class="post-info">
          <span class="post-title">${this._escapeHtml(label)}</span>
          <span class="post-date">${date}${edited}</span>
        </div>
        <span class="post-likes" data-cid="${post.cid}">${heartSvg} <span class="count">…</span></span>
        <div class="post-actions">${actions}</div>
      `
      list.appendChild(li)
    }

    list.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.post-delete-btn, .post-edit-btn')
      if (!btn?.dataset.cid) return

      if (btn.classList.contains('post-delete-btn')) {
        if (!confirm('Delete this post? This cannot be undone.')) return
        deletePost(btn.dataset.cid).then(() => this._renderMyPosts())
          .catch(err => console.warn('[account] delete post failed:', err))
      } else if (btn.classList.contains('post-edit-btn')) {
        navigate(`/create?edit=${encodeURIComponent(btn.dataset.cid)}`)
      }
    })

    this._loadPostLikeCounts(posts.map(p => p.cid))
  }

  private async _loadPostLikeCounts(postCids: string[]) {
    const counts = new Map<string, number>()

    for (const l of getAllMyLikes()) {
      if (postCids.includes(l.target)) {
        counts.set(l.target, (counts.get(l.target) ?? 0) + 1)
      }
    }

    const manifest = loadManifest()
    const months = recentMonths(3)
    const cidSet = new Set(postCids)

    await Promise.all(
      manifest.following.map(async (peerId) => {
        try {
          const result = await resolveFollowedPeer(peerId)
          if (!result) return
          const interactions = await fetchPeerInteractions(result.manifest, months)
          for (const l of interactions.likes) {
            if (cidSet.has(l.target)) {
              counts.set(l.target, (counts.get(l.target) ?? 0) + 1)
            }
          }
        } catch { /* skip unreachable peer */ }
      })
    )

    for (const cid of postCids) {
      const el = this._root.querySelector<HTMLElement>(`.post-likes[data-cid="${cid}"]`)
      if (!el) continue
      const total = counts.get(cid) ?? 0
      const countSpan = el.querySelector('.count')
      if (countSpan) countSpan.textContent = String(total)
      if (total > 0) el.classList.add('has-likes')
    }
  }

  private _escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  private _bindEvents() {
    const copyBtn  = this._root.querySelector<HTMLButtonElement>('#copy-btn')!
    const addBtn   = this._root.querySelector<HTMLButtonElement>('#add-btn')!
    const scanBtn  = this._root.querySelector<HTMLButtonElement>('#scan-btn')!
    const scanInput = this._root.querySelector<HTMLInputElement>('#scan-input')!
    const peerInput = this._root.querySelector<HTMLInputElement>('#peer-input')!
    const addStatus = this._root.querySelector<HTMLElement>('#add-status')!

    copyBtn.addEventListener('click', async () => {
      if (!this._peerId) return
      try {
        await navigator.clipboard.writeText(this._peerId)
        copyBtn.textContent = 'COPIED!'
        setTimeout(() => { copyBtn.textContent = 'COPY' }, 2000)
      } catch {
        copyBtn.textContent = 'COPY'
      }
    })

    addBtn.addEventListener('click', () => {
      this._addContact(peerInput.value.trim(), peerInput, addStatus)
    })

    peerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._addContact(peerInput.value.trim(), peerInput, addStatus)
    })

    const cameraBtn = this._root.querySelector<HTMLButtonElement>('#camera-btn')!
    const cameraOverlay = this._root.querySelector<HTMLElement>('#camera-overlay')!
    const cameraVideo = this._root.querySelector<HTMLVideoElement>('#camera-video')!
    const cameraCanvas = this._root.querySelector<HTMLCanvasElement>('#camera-canvas')!
    const cameraClose = this._root.querySelector<HTMLButtonElement>('#camera-close')!

    // Only show camera button on actual mobile devices
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isMobile && navigator.mediaDevices) {
      cameraBtn.style.display = ''
    }

    let cameraStream: MediaStream | null = null
    let cameraScanId = 0

    const stopCamera = () => {
      cameraScanId = 0
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop())
        cameraStream = null
      }
      cameraVideo.srcObject = null
      cameraOverlay.style.display = 'none'
    }

    const scanFrame = () => {
      if (!cameraScanId) return
      if (cameraVideo.readyState !== cameraVideo.HAVE_ENOUGH_DATA) {
        requestAnimationFrame(scanFrame)
        return
      }
      const w = cameraVideo.videoWidth
      const h = cameraVideo.videoHeight
      cameraCanvas.width = w
      cameraCanvas.height = h
      const ctx = cameraCanvas.getContext('2d')!
      ctx.drawImage(cameraVideo, 0, 0, w, h)
      const imageData = ctx.getImageData(0, 0, w, h)
      const code = jsQR(imageData.data, w, h)
      if (code?.data) {
        stopCamera()
        peerInput.value = code.data
        this._addContact(code.data, peerInput, addStatus)
        return
      }
      cameraScanId = requestAnimationFrame(scanFrame)
    }

    cameraBtn.addEventListener('click', async () => {
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        })
        cameraVideo.srcObject = cameraStream
        cameraOverlay.style.display = ''
        cameraScanId = requestAnimationFrame(scanFrame)
      } catch (err) {
        this._setStatus(addStatus, 'error', 'Camera not available.')
      }
    })

    cameraClose.addEventListener('click', stopCamera)

    scanBtn.addEventListener('click', () => scanInput.click())

    scanInput.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      scanInput.value = ''
      this._setStatus(addStatus, 'info', 'SCANNING…')
      try {
        const peerId = await this._decodeQrFromFile(file)
        if (!peerId) { this._setStatus(addStatus, 'error', 'No QR code found in image.'); return }
        peerInput.value = peerId
        this._addContact(peerId, peerInput, addStatus)
      } catch {
        this._setStatus(addStatus, 'error', 'Could not read image.')
      }
    })

    this._root.querySelector('#following-list')!.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.remove-btn')
      if (!btn?.dataset.peerId) return
      unfollowPeer(btn.dataset.peerId)
      this._renderFollowing()
    })
  }

  private async _addContact(
    peerId: string,
    input: HTMLInputElement,
    status: HTMLElement,
  ) {
    if (!peerId) { this._setStatus(status, 'error', 'Paste a share code first.'); return }
    if (peerId === this._peerId) { this._setStatus(status, 'error', 'That\'s your own ID.'); return }
    try {
      await followPeer(peerId)
      input.value = ''
      this._renderFollowing()
      this._setStatus(status, 'ok', 'Contact added.')
      setTimeout(() => this._setStatus(status, '', ''), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this._setStatus(status, 'error', msg.slice(0, 60))
    }
  }

  private async _decodeQrFromFile(file: File): Promise<string | null> {
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = reject
        el.src = url
      })
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, canvas.width, canvas.height)
      return code?.data ?? null
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  private _bindTheme() {
    const row = this._root.querySelector<HTMLElement>('#theme-row')!
    const current = getTheme()
    row.querySelectorAll<HTMLElement>('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === current)
    })
    row.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.theme-btn')
      if (!btn?.dataset.theme) return
      const choice = btn.dataset.theme as ThemeChoice
      setTheme(choice)
      row.querySelectorAll<HTMLElement>('.theme-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.theme === choice)
      })
    })
  }

  private _bindSettings() {
    const jwtInput  = this._root.querySelector<HTMLInputElement>('#jwt-input')!
    const saveBtn   = this._root.querySelector<HTMLButtonElement>('#jwt-save-btn')!
    const clearBtn  = this._root.querySelector<HTMLButtonElement>('#jwt-clear-btn')!
    const badge     = this._root.querySelector<HTMLElement>('#pin-badge')!
    const status    = this._root.querySelector<HTMLElement>('#jwt-status')!

    const updateBadge = () => {
      if (hasPinataJwt()) {
        badge.textContent = 'PINNING ON'
        badge.className = 'pin-badge ok'
      } else {
        badge.textContent = 'NO PINNING'
        badge.className = 'pin-badge warn'
      }
    }
    updateBadge()

    saveBtn.addEventListener('click', () => {
      const val = jwtInput.value.trim()
      if (!val) { this._setStatus(status, 'error', 'Paste your Pinata JWT first.'); return }
      setPinataJwt(val)
      jwtInput.value = ''
      updateBadge()
      this._setStatus(status, 'ok', 'JWT saved.')
      setTimeout(() => this._setStatus(status, '', ''), 3000)
    })

    clearBtn.addEventListener('click', () => {
      clearPinataJwt()
      jwtInput.value = ''
      updateBadge()
      this._setStatus(status, 'info', 'JWT cleared.')
      setTimeout(() => this._setStatus(status, '', ''), 3000)
    })

    // ── Gateway URL ──
    const gwInput  = this._root.querySelector<HTMLInputElement>('#gw-input')!
    const gwSave   = this._root.querySelector<HTMLButtonElement>('#gw-save-btn')!
    const gwClear  = this._root.querySelector<HTMLButtonElement>('#gw-clear-btn')!
    const gwBadge  = this._root.querySelector<HTMLElement>('#gw-badge')!
    const gwStatus = this._root.querySelector<HTMLElement>('#gw-status')!

    const updateGwBadge = () => {
      if (getPinataGateway()) {
        gwBadge.textContent = 'GATEWAY ON'
        gwBadge.className = 'pin-badge ok'
      } else {
        gwBadge.textContent = 'NO GATEWAY'
        gwBadge.className = 'pin-badge warn'
      }
    }
    updateGwBadge()

    gwSave.addEventListener('click', () => {
      const val = gwInput.value.trim()
      if (!val) { this._setStatus(gwStatus, 'error', 'Paste your gateway URL first.'); return }
      setPinataGateway(val)
      gwInput.value = ''
      updateGwBadge()
      this._setStatus(gwStatus, 'ok', 'Gateway saved.')
      setTimeout(() => this._setStatus(gwStatus, '', ''), 3000)
    })

    gwClear.addEventListener('click', () => {
      clearPinataGateway()
      gwInput.value = ''
      updateGwBadge()
      this._setStatus(gwStatus, 'info', 'Gateway cleared.')
      setTimeout(() => this._setStatus(gwStatus, '', ''), 3000)
    })
  }

  private _setStatus(el: HTMLElement, state: string, text: string) {
    el.textContent = text
    el.dataset.state = state
  }
}

export function defineAccountView() {
  if (!customElements.get('view-account')) {
    customElements.define('view-account', AccountView)
  }
}
