#!/usr/bin/env node
// Render docs/essay.md to build/essay/index.html for the GitHub Pages site.
// Run after `vite build`: node scripts/build-essay.mjs
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import MarkdownIt from "markdown-it";

const SITE = "https://tinpotnick.github.io/graffiti";
const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

const source = readFileSync("docs/essay.md", "utf8");
const title = source.match(/^# (.+)$/m)?.[1] ?? "graffiti";
const body = md.render(source.replace(/^# .+\n/m, ""));
const description =
  "An experiment in building a social network on IPFS: no server, no database, no accounts. " +
  "How do you paint on a wall you don't own?";

const escape = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${SITE}/essay/">
<meta property="og:image" content="${SITE}/essay/hero.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="../favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #fafafa; --text: #16161c; --muted: #5c5c66; --rule: rgba(0,0,0,.1);
    --code: rgba(0,0,0,.05); --link: #c2185b; --accent: #e8590c;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #121218; --text: #e8e8ee; --muted: #9a9aa8; --rule: rgba(255,255,255,.1);
      --code: rgba(255,255,255,.06); --link: #ff7ab6; --accent: #ffa94d;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 18px/1.7 "Space Grotesk", system-ui, sans-serif;
  }
  .wrap { max-width: 42rem; margin: 0 auto; padding: 3rem 1rem 5rem; }
  .kicker {
    font: 10px/1.6 "Press Start 2P", monospace; letter-spacing: 1px;
    color: var(--accent); text-decoration: none;
  }
  h1 { font-size: clamp(2rem, 6vw, 2.8rem); line-height: 1.15; margin: 1rem 0 1.5rem; }
  h2 { font-size: 1.4rem; margin: 2.8rem 0 .8rem; }
  a { color: var(--link); }
  .hero { width: 100%; height: auto; border-radius: 12px; margin: .5rem 0 .4rem; display: block; }
  .credit { color: var(--muted); font-size: .8rem; margin: 0 0 2rem; }
  .cta { display: flex; flex-wrap: wrap; gap: .75rem; margin: 0 0 2.5rem; }
  .cta a {
    font: 10px/1 "Press Start 2P", monospace; text-decoration: none;
    padding: .9rem 1.1rem; border-radius: 8px; border: 2px solid var(--text); color: var(--text);
  }
  .cta a.primary { background: var(--text); color: var(--bg); }
  code { font: .88em ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--code); padding: .1em .35em; border-radius: 4px; }
  pre { background: var(--code); padding: 1rem; border-radius: 8px; overflow-x: auto; line-height: 1.5; }
  pre code { background: none; padding: 0; font-size: .8rem; }
  li { margin: .35rem 0; }
  hr { border: 0; border-top: 1px solid var(--rule); margin: 3rem 0; }
  footer { color: var(--muted); font-size: .9rem; }
</style>
</head>
<body>
<main class="wrap">
  <a class="kicker" href="../">GRAFFITI</a>
  <h1>${escape(title)}</h1>
  <img class="hero" src="hero.png" alt="graffiti's feed, paint and profile screens" width="1598" height="1155">
  <p class="credit">The robots on the wall are a tribute to street artist <a href="https://migtherobot.com/">migtherobot</a>.</p>
  <div class="cta">
    <a class="primary" href="../">TRY IT ▶</a>
    <a href="https://github.com/tinpotnick/graffiti">CODE ON GITHUB</a>
  </div>
  <article>
${body}
  </article>
  <hr>
  <footer>
    <p>graffiti is MIT-licensed and lives at <a href="https://github.com/tinpotnick/graffiti">github.com/tinpotnick/graffiti</a>.</p>
  </footer>
</main>
</body>
</html>
`;

mkdirSync("build/essay", { recursive: true });
writeFileSync("build/essay/index.html", html);
copyFileSync("docs/screenshots/hero.png", "build/essay/hero.png");
console.log("Wrote build/essay/index.html");
