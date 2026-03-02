type ChangeDetail = { value: string };

const template = document.createElement("template");
template.innerHTML = `
  <div class="editor-host">
    <div class="editor-content"></div>
  </div>
  <style>
    .editor-host {
      border: 1px solid var(--border-editor);
      border-radius: var(--radius-lg);
      min-height: 280px;
    }
    .editor-content {
      padding: 1rem 1.25rem;
      min-height: 280px;
      cursor: text;
    }
    .editor-content .ProseMirror {
      outline: none;
      min-height: 240px;
      font-size: 1rem;
      line-height: 1.6;
    }
    .editor-content .ProseMirror > * + * { margin-top: 0.5rem; }
    .editor-content .ProseMirror p { margin: 0; }
    .editor-content .ProseMirror h1 { font-size: 1.8rem; font-weight: 700; line-height: 1.2; }
    .editor-content .ProseMirror h2 { font-size: 1.45rem; font-weight: 600; line-height: 1.3; }
    .editor-content .ProseMirror h3 { font-size: 1.2rem; font-weight: 600; line-height: 1.4; }
    .editor-content .ProseMirror h4,
    .editor-content .ProseMirror h5,
    .editor-content .ProseMirror h6 { font-size: 1rem; font-weight: 600; }
    .editor-content .ProseMirror ul,
    .editor-content .ProseMirror ol { padding-left: 1.5rem; }
    .editor-content .ProseMirror li { margin: 0.2rem 0; }
    .editor-content .ProseMirror code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.875em;
      background: var(--surface-code);
      padding: 0.1em 0.35em;
      border-radius: 3px;
    }
    .editor-content .ProseMirror pre {
      background: var(--surface-code);
      padding: 0.75rem 1rem;
      border-radius: 6px;
      overflow-x: auto;
    }
    .editor-content .ProseMirror pre code {
      background: none;
      padding: 0;
      font-size: 0.875rem;
    }
    .editor-content .ProseMirror blockquote {
      border-left: 3px solid var(--border-strong);
      padding-left: 1rem;
      color: var(--text-secondary);
    }
    .editor-content .ProseMirror hr {
      border: none;
      border-top: 1px solid var(--border-medium);
      margin: 1rem 0;
    }
    /* placeholder */
    .editor-content .ProseMirror.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      color: var(--text-muted);
      pointer-events: none;
      float: left;
      height: 0;
    }
  </style>
`;

class MdEditor extends HTMLElement {
  private hostEl: HTMLDivElement | null = null;
  private contentEl: HTMLDivElement | null = null;
  private fallbackEl: HTMLTextAreaElement | null = null;
  private editor: any = null;
  private _value = "";
  private readonly onFallbackInput: () => void;

  constructor() {
    super();
    this.onFallbackInput = () => {
      if (!this.fallbackEl) {
        return;
      }
      this._value = this.fallbackEl.value;
      this.emitChange(this._value);
    };
  }

  get value() {
    return this._value;
  }

  set value(nextValue: string) {
    this._value = nextValue;
    if (this.fallbackEl) {
      this.fallbackEl.value = nextValue;
    }
    if (this.editor) {
      this.editor.commands.setContent(nextValue);
    }
  }

  async connectedCallback() {
    if (this.editor) {
      return;
    }

    if (!this.hostEl) {
      this.appendChild(template.content.cloneNode(true));
      this.hostEl = this.querySelector(".editor-host") as HTMLDivElement;
      this.contentEl = this.querySelector(".editor-content") as HTMLDivElement;
    }

    if (!this.fallbackEl) {
      this.mountFallback();
    }

    try {
      const [{ Editor }, { default: StarterKit }, { Markdown }] = await Promise.all([
        import("@tiptap/core"),
        import("@tiptap/starter-kit"),
        import("tiptap-markdown"),
      ]);

      if (!this.contentEl) {
        return;
      }

      if (this.fallbackEl) {
        this._value = this.fallbackEl.value;
        this.fallbackEl.removeEventListener("input", this.onFallbackInput);
        this.fallbackEl = null;
      }
      this.contentEl.replaceChildren();

      this.editor = new Editor({
        element: this.contentEl,
        extensions: [
          StarterKit,
          Markdown.configure({ html: false, transformPastedText: true }),
        ],
        // Start empty — setContent below uses tiptap-markdown's command override
        // which renders markdown → HTML before handing off to ProseMirror.
        // Passing markdown directly as `content` bypasses that override (Tiptap
        // calls createDoc() internally, which parses as HTML, not markdown).
        content: '',
        onUpdate: ({ editor }: { editor: any }) => {
          this._value = editor.storage.markdown.getMarkdown();
          this.emitChange(this._value);
        },
      });

      if (this._value) {
        this.editor.commands.setContent(this._value);
      }
    } catch (error) {
      console.warn("md-editor: failed to initialize Tiptap, using textarea fallback", error);
      if (!this.fallbackEl) {
        this.mountFallback();
      }
    }
  }

  disconnectedCallback() {
    if (this.fallbackEl) {
      this.fallbackEl.removeEventListener("input", this.onFallbackInput);
      this.fallbackEl = null;
    }

    if (!this.editor) {
      return;
    }

    this.editor.destroy();
    this.editor = null;
  }

  private mountFallback() {
    if (!this.contentEl) {
      return;
    }
    this.contentEl.replaceChildren();
    const textarea = document.createElement("textarea");
    textarea.value = this._value;
    textarea.setAttribute("aria-label", "Markdown editor");
    textarea.style.width = "100%";
    textarea.style.minHeight = "240px";
    textarea.style.border = "0";
    textarea.style.padding = "0";
    textarea.style.resize = "vertical";
    textarea.style.background = "transparent";
    textarea.style.font = "400 1rem/1.6 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    textarea.addEventListener("input", this.onFallbackInput);
    this.contentEl.appendChild(textarea);
    this.fallbackEl = textarea;
  }

  private emitChange(markdown: string) {
    this.dispatchEvent(
      new CustomEvent<ChangeDetail>("markdown-change", {
        detail: { value: markdown },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

export function defineMdEditor() {
  if (!customElements.get("md-editor")) {
    customElements.define("md-editor", MdEditor);
  }
}
