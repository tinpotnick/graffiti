type Post = { id: number; title: string; excerpt: string };
type FeedItemElement = HTMLElement & { post: Omit<Post, "id"> };

const posts: Post[] = [
  { id: 1, title: "First post", excerpt: "Decentralised nonsense begins." },
  { id: 2, title: "Second post", excerpt: "Still immutable. Still here." },
];

const template = document.createElement("template");
template.innerHTML = `
  <section class="feed"></section>
`;

class HomeView extends HTMLElement {
  private readonly feedEl: HTMLElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.appendChild(template.content.cloneNode(true));
    this.feedEl = root.querySelector(".feed") as HTMLElement;
  }

  connectedCallback() {
    this.render();
  }

  private render() {
    this.feedEl.replaceChildren();

    posts.forEach((post) => {
      const item = document.createElement("feed-item") as FeedItemElement;
      item.post = { title: post.title, excerpt: post.excerpt };
      this.feedEl.appendChild(item);
    });
  }
}

export function defineHomeView() {
  if (!customElements.get("view-home")) {
    customElements.define("view-home", HomeView);
  }
}
