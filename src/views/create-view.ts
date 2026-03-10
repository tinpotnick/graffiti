import { publishTextPost, updateTextPost, saveDraft, loadDrafts, deleteDraft, publishDraft, getAllMyPosts, type DraftEntry } from '../services/profile'
import { catJson } from '../services/ipfs'

type MdEditorElement = HTMLElement & { value: string };
type EditorChangeEvent = CustomEvent<{ value: string }>;

const template = document.createElement("template");
template.innerHTML = `
  <section class="create">
    <header class="create-header">
      <input class="title" type="text" name="title" placeholder="Title" />
      <button class="save-draft" type="button">Save</button>
      <button class="publish" type="submit">Publish</button>
    </header>
    <div class="drafts-list"></div>
    <md-editor></md-editor>
  </section>
  <style>
    .create {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      padding: 1.5rem 2rem 7rem;
      min-height: calc(100vh - 6.5rem);
      background: linear-gradient(180deg, var(--surface-header) 0%, var(--surface-inset) 100%);
    }
    .create-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      position: sticky;
      top: 0;
      z-index: 2;
      background: linear-gradient(
        180deg,
        var(--surface-header-98) 0%,
        var(--surface-header-90) 80%,
        var(--surface-header-0) 100%
      );
      padding: 0.5rem 0 1rem;
    }
    .title {
      flex: 1;
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      padding: 0.7rem 0.9rem;
      font-size: 1.4rem;
      font-weight: 600;
      letter-spacing: 0.01em;
      color: var(--text);
      background: var(--surface-raised);
      box-shadow: var(--shadow-input);
    }
    .title::placeholder {
      color: var(--text-muted);
    }
    .save-draft {
      border: 1px solid var(--border-medium);
      padding: 0.65rem 1.15rem;
      border-radius: var(--radius-pill);
      font-weight: 600;
      font-size: 0.8rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--text-secondary);
      background: var(--surface-raised);
      cursor: pointer;
    }
    .save-draft:active {
      transform: translateY(1px);
    }
    .publish {
      border: 0;
      padding: 0.65rem 1.15rem;
      border-radius: var(--radius-pill);
      font-weight: 600;
      font-size: 0.8rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--text-inverse);
      background: var(--accent);
      box-shadow: var(--shadow-publish);
      cursor: pointer;
    }
    .publish:active {
      transform: translateY(1px);
    }
    .drafts-list:empty {
      display: none;
    }
    .drafts-heading {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: var(--font-pixel, monospace);
      font-size: 0.55rem;
      letter-spacing: 2px;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }
    .draft-new {
      background: none;
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-pill);
      font-family: var(--font-pixel, monospace);
      font-size: 0.55rem;
      letter-spacing: 1px;
      color: var(--text-secondary);
      padding: 0.15rem 0.5rem;
      cursor: pointer;
    }
    .draft-new:hover {
      color: var(--text);
      border-color: var(--border-strong);
    }
    .draft-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0;
      border-bottom: 1px solid var(--border);
    }
    .draft-row:last-child {
      border-bottom: none;
    }
    .draft-row.active {
      background: var(--surface-inset);
      border-radius: var(--radius-md);
      padding-left: 0.5rem;
      margin: 0 -0.5rem;
    }
    .draft-open {
      flex: 1;
      background: none;
      border: none;
      text-align: left;
      font-size: 0.85rem;
      color: var(--text);
      cursor: pointer;
      padding: 0.2rem 0;
    }
    .draft-open:hover {
      color: var(--accent);
    }
    .draft-date {
      font-size: 0.7rem;
      color: var(--text-muted);
      white-space: nowrap;
    }
    .draft-delete {
      background: none;
      border: none;
      font-size: 1rem;
      line-height: 1;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.2rem 0.4rem;
      border-radius: var(--radius-sm);
    }
    .draft-delete:hover {
      color: var(--text);
      background: var(--surface-raised);
    }
  </style>
`;

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

class CreateView extends HTMLElement {
  private postTitle = "";
  private markdown = "";
  private activeDraftId: string | null = null;
  private editingPostCid: string | null = null;

  private titleInput: HTMLInputElement | null = null;
  private editor: MdEditorElement | null = null;
  private publishButton: HTMLButtonElement | null = null;
  private saveButton: HTMLButtonElement | null = null;
  private draftsContainer: HTMLDivElement | null = null;
  private readonly onEditorChange: (event: Event) => void;
  private readonly onPublish: () => void;
  private readonly onSave: () => void;

  constructor() {
    super();
    this.onEditorChange = (event: Event) => {
      const detail = (event as EditorChangeEvent).detail;
      this.markdown = detail?.value ?? "";
    };

    this.onSave = async () => {
      this.postTitle = this.titleInput?.value ?? "";
      if (!this.postTitle && !this.markdown.trim()) return;
      this.saveButton?.setAttribute("disabled", "");
      try {
        const id = await saveDraft(this.postTitle, this.markdown, this.activeDraftId ?? undefined);
        this.activeDraftId = id;
        this._renderDrafts();
        // Brief "SAVED" feedback
        if (this.saveButton) {
          this.saveButton.textContent = "Saved";
          setTimeout(() => { if (this.saveButton) this.saveButton.textContent = "Save"; }, 1000);
        }
      } catch (err) {
        console.error("[create] save draft failed:", err);
      } finally {
        this.saveButton?.removeAttribute("disabled");
      }
    };

    this.onPublish = async () => {
      this.postTitle = this.titleInput?.value ?? "";
      if (!this.postTitle && !this.markdown.trim()) return;
      this.publishButton?.setAttribute("disabled", "");
      try {
        if (this.editingPostCid) {
          await updateTextPost(this.editingPostCid, this.postTitle, this.markdown);
        } else if (this.activeDraftId) {
          await publishDraft(this.activeDraftId);
        } else {
          await publishTextPost(this.postTitle, this.markdown);
        }
        this._clearEditor();
        try { localStorage.setItem("graffiti:home-view-mode", "feed"); } catch {}
        window.history.pushState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      } catch (err) {
        console.error("[create] publish failed:", err);
      } finally {
        this.publishButton?.removeAttribute("disabled");
      }
    };
  }

  connectedCallback() {
    if (!this.titleInput) {
      this.appendChild(template.content.cloneNode(true));
      this.titleInput = this.querySelector(".title") as HTMLInputElement;
      this.editor = this.querySelector("md-editor") as MdEditorElement;
      this.publishButton = this.querySelector(".publish") as HTMLButtonElement;
      this.saveButton = this.querySelector(".save-draft") as HTMLButtonElement;
      this.draftsContainer = this.querySelector(".drafts-list") as HTMLDivElement;
    }

    this.titleInput.value = this.postTitle;
    this.editor!.value = this.markdown;
    this.editor!.addEventListener("markdown-change", this.onEditorChange);
    this.publishButton!.addEventListener("click", this.onPublish);
    this.saveButton!.addEventListener("click", this.onSave);
    this._renderDrafts();
    this._checkEditParam();

    window.addEventListener('route-change', this._onRouteChange);
  }

  private _onRouteChange = (e: Event) => {
    const { pathname } = (e as CustomEvent).detail;
    if (pathname === '/create') this._checkEditParam();
  };

  private _checkEditParam() {
    const params = new URLSearchParams(window.location.search);
    const editCid = params.get('edit');
    if (editCid && editCid !== this.editingPostCid) {
      this._loadEditPost(editCid);
    }
  }

  private async _loadEditPost(cid: string) {
    // Find post metadata in local buckets
    const allPosts = getAllMyPosts();
    const post = allPosts.find(p => p.cid === cid);
    if (!post || post.type !== 'text') return;

    try {
      const content = await catJson<{ title: string; markdown: string }>(cid);
      this.editingPostCid = cid;
      this.activeDraftId = null;
      this.postTitle = content.title;
      this.markdown = content.markdown;
      if (this.titleInput) this.titleInput.value = content.title;
      if (this.editor) this.editor.value = content.markdown;
      if (this.publishButton) this.publishButton.textContent = "Update";
      if (this.saveButton) this.saveButton.style.display = "none";
      this._renderDrafts();
    } catch (err) {
      console.error("[create] load post for edit failed:", err);
    }
  }

  disconnectedCallback() {
    this.editor?.removeEventListener("markdown-change", this.onEditorChange);
    this.publishButton?.removeEventListener("click", this.onPublish);
    this.saveButton?.removeEventListener("click", this.onSave);
    window.removeEventListener('route-change', this._onRouteChange);
  }

  private _clearEditor() {
    this.postTitle = "";
    this.markdown = "";
    this.activeDraftId = null;
    this.editingPostCid = null;
    if (this.titleInput) this.titleInput.value = "";
    if (this.editor) this.editor.value = "";
    if (this.publishButton) this.publishButton.textContent = "Publish";
    if (this.saveButton) this.saveButton.style.display = "";
    this._renderDrafts();
  }

  private _renderDrafts() {
    if (!this.draftsContainer) return;
    const drafts = loadDrafts();
    if (drafts.length === 0) {
      this.draftsContainer.innerHTML = "";
      return;
    }

    const heading = document.createElement("div");
    heading.className = "drafts-heading";
    const label = document.createElement("span");
    label.textContent = "DRAFTS";
    heading.appendChild(label);
    if (this.activeDraftId) {
      const newBtn = document.createElement("button");
      newBtn.className = "draft-new";
      newBtn.textContent = "+ NEW";
      newBtn.addEventListener("click", () => this._clearEditor());
      heading.appendChild(newBtn);
    }

    const fragment = document.createDocumentFragment();
    fragment.appendChild(heading);

    for (const draft of drafts) {
      const row = document.createElement("div");
      row.className = "draft-row";
      if (draft.id === this.activeDraftId) row.classList.add("active");

      const openBtn = document.createElement("button");
      openBtn.className = "draft-open";
      openBtn.textContent = draft.title || "Untitled";
      openBtn.addEventListener("click", () => this._openDraft(draft));

      const date = document.createElement("span");
      date.className = "draft-date";
      date.textContent = formatDate(draft.updatedAt);

      const delBtn = document.createElement("button");
      delBtn.className = "draft-delete";
      delBtn.textContent = "\u00d7";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._deleteDraft(draft.id);
      });

      row.appendChild(openBtn);
      row.appendChild(date);
      row.appendChild(delBtn);
      fragment.appendChild(row);
    }

    this.draftsContainer.innerHTML = "";
    this.draftsContainer.appendChild(fragment);
  }

  private _openDraft(draft: DraftEntry) {
    this.activeDraftId = draft.id;
    this.postTitle = draft.title;
    this.markdown = draft.markdown;
    if (this.titleInput) this.titleInput.value = draft.title;
    if (this.editor) this.editor.value = draft.markdown;
    this._renderDrafts();
  }

  private async _deleteDraft(draftId: string) {
    try {
      await deleteDraft(draftId);
      if (this.activeDraftId === draftId) {
        this._clearEditor();
      } else {
        this._renderDrafts();
      }
    } catch (err) {
      console.error("[create] delete draft failed:", err);
    }
  }
}

export function defineCreateView() {
  if (!customElements.get("view-create")) {
    customElements.define("view-create", CreateView);
  }
}
