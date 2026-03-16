import "./styles.css";
import { defineAppShell } from "./shell/app-shell";
import { defineTopNav } from "./components/top-nav";
import * as ipfs from "./services/ipfs";
import * as profile from "./services/profile";
import { defineFeedItem } from "./components/feed-item";
import { defineMdEditor } from "./components/md-editor";
import { defineHomeView } from "./views/home-view";
import { defineCreateView } from "./views/create-view";
import { definePaintCanvas } from "./components/paint-canvas";
import { definePaintView } from "./views/paint-view";
import { defineAccountView } from "./views/account-view";
import { definePostView } from "./views/post-view";
import { defineSavedView } from "./views/saved-view";
import { defineWallScroll } from "./components/wall-scroll";

/* ── Theme ──────────────────────────────────────── */
export type ThemeChoice = "light" | "dark" | "system";
const THEME_KEY = "graffiti:theme";

function applyTheme(choice: ThemeChoice) {
  if (choice === "light" || choice === "dark") {
    document.documentElement.dataset.theme = choice;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

export function getTheme(): ThemeChoice {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "dark";
}

export function setTheme(choice: ThemeChoice) {
  if (choice === "system") {
    localStorage.removeItem(THEME_KEY);
  } else {
    localStorage.setItem(THEME_KEY, choice);
  }
  applyTheme(choice);
}

applyTheme(getTheme());

defineTopNav();
defineFeedItem();
defineMdEditor();
defineWallScroll();
defineHomeView();
defineCreateView();
definePaintCanvas();
definePaintView();
defineAccountView();
definePostView();
defineSavedView();
defineAppShell();

// Debug helpers — accessible from browser console as graffiti.*
(window as any).graffiti = { ipfs, profile };
