type MdEditorElement = HTMLElement & { value: string };
type EditorChangeEvent = CustomEvent<{ value: string }>;

const template = document.createElement("template");
template.innerHTML = `
  <section class="create">
    <header class="create-header">
      <input class="title" type="text" name="title" placeholder="Title" />
      <button class="publish" type="submit">Publish</button>
    </header>
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
        rgba(251, 251, 251, 0.98) 0%,  /* --surface-header */
        rgba(251, 251, 251, 0.9) 80%,
        rgba(251, 251, 251, 0) 100%
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
      background: var(--surface-raised);
      box-shadow: var(--shadow-input);
    }
    .title::placeholder {
      color: var(--text-muted);
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
  </style>
`;

class CreateView extends HTMLElement {
  private postTitle = "";
  private markdown = `# Hello

Type *markdown* here.
- lists
- **bold**
- \`code\`
`;

  private titleInput: HTMLInputElement | null = null;
  private editor: MdEditorElement | null = null;
  private publishButton: HTMLButtonElement | null = null;
  private readonly onEditorChange: (event: Event) => void;
  private readonly onPublish: () => void;

  constructor() {
    super();
    this.onEditorChange = (event: Event) => {
      const detail = (event as EditorChangeEvent).detail;
      this.markdown = detail?.value ?? "";
    };

    this.onPublish = () => {
      this.postTitle = this.titleInput?.value ?? "";
      console.log({ title: this.postTitle, body: this.markdown });
    };
  }

  connectedCallback() {
    if (!this.titleInput) {
      this.appendChild(template.content.cloneNode(true));
      this.titleInput = this.querySelector(".title") as HTMLInputElement;
      this.editor = this.querySelector("md-editor") as MdEditorElement;
      this.publishButton = this.querySelector(".publish") as HTMLButtonElement;
    }

    this.titleInput.value = this.postTitle;
    this.editor!.value = this.markdown;
    this.editor!.addEventListener("markdown-change", this.onEditorChange);
    this.publishButton!.addEventListener("click", this.onPublish);
  }

  disconnectedCallback() {
    this.editor?.removeEventListener("markdown-change", this.onEditorChange);
    this.publishButton?.removeEventListener("click", this.onPublish);
  }
}

export function defineCreateView() {
  if (!customElements.get("view-create")) {
    customElements.define("view-create", CreateView);
  }
}
