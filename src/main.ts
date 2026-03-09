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
import { defineWallScroll } from "./components/wall-scroll";

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
defineAppShell();

// Debug helpers — accessible from browser console as graffiti.*
(window as any).graffiti = { ipfs, profile };
