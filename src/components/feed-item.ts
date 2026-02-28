type Post = { title: string; excerpt: string };

const template = document.createElement("template");
template.innerHTML = `
  <article>
    <h2></h2>
    <p></p>
  </article>
  <style>
    article {
      padding: 1rem 0;
      border-bottom: 1px solid #eee;
    }
    h2 {
      margin: 0 0 0.25rem 0;
    }
    p {
      margin: 0;
    }
  </style>
`;

class FeedItem extends HTMLElement {
  private readonly titleEl: HTMLHeadingElement;
  private readonly excerptEl: HTMLParagraphElement;
  private _post: Post = { title: "", excerpt: "" };

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.appendChild(template.content.cloneNode(true));
    this.titleEl = root.querySelector("h2") as HTMLHeadingElement;
    this.excerptEl = root.querySelector("p") as HTMLParagraphElement;
  }

  set post(value: Post) {
    this._post = value;
    this.render();
  }

  get post(): Post {
    return this._post;
  }

  connectedCallback() {
    this.render();
  }

  private render() {
    this.titleEl.textContent = this._post.title;
    this.excerptEl.textContent = this._post.excerpt;
  }
}

export function defineFeedItem() {
  if (!customElements.get("feed-item")) {
    customElements.define("feed-item", FeedItem);
  }
}
