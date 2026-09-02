import { S, bus, load, save, dayOf } from "./store.js";
import { cloud, initCloud } from "./cloud.js";
import { setMeta, icon, closeSheet, isSheetOpen, toast } from "./ui.js";
import { bindDock, wakeSupported, wakeActive, requestWake, releaseWake } from "./timer.js";
import * as train from "./views/train.js";
import * as week from "./views/week.js";
import * as progress from "./views/progress.js";
import * as me from "./views/me.js";

const VIEWS = { train, week, progress, me };
const TITLES = { train: "Train", week: "Week", progress: "Progress", me: "You" };
const $ = id => document.getElementById(id);

const main = $("main"), sub = $("subbar"), tabbar = $("tabbar");
const roots = {};
// Each view owns a root element so its listeners bind once.
for (const k of Object.keys(VIEWS)) {
  const el = document.createElement("div"); el.className = "view"; el.dataset.viewroot = k; el.hidden = true;
  main.appendChild(el); roots[k] = el;
}

function renderCurrent() {
  const v = S.ui.view in VIEWS ? S.ui.view : "train";
  for (const k of Object.keys(VIEWS)) roots[k].hidden = k !== v;
  VIEWS[v].renderSub(sub);
  VIEWS[v].render(roots[v]);
  tabbar.querySelectorAll("[data-view]").forEach(b => b.setAttribute("aria-current", b.dataset.view === v ? "page" : "false"));
  $("crumb").textContent = v === "train" ? "Day " + S.ui.day + " · " + dayOf(S.ui.day).focus : TITLES[v];
  document.title = "Iron Log · " + TITLES[v];
}

function go(view) {
  if (isSheetOpen()) closeSheet();
  S.ui.view = view; save();
  window.scrollTo({ top: 0 });
  renderCurrent();
}

/* ---------------- cloud pill ---------------- */
function paintCloud() {
  const b = $("cloudBtn");
  b.dataset.s = cloud.status;
  $("cloudTxt").textContent = { local: "Local", loading: "…", "signed-out": "Sign in", syncing: "Syncing", synced: "Synced", offline: S.pending.length + " pending", error: "Retry" }[cloud.status] || cloud.status;
  b.hidden = false;
}

/* ---------------- boot ---------------- */
async function boot() {
  load();
  bindDock();
  for (const k of Object.keys(VIEWS)) VIEWS[k].bind(roots[k], sub);
  tabbar.addEventListener("click", e => { const b = e.target.closest("[data-view]"); if (b) go(b.dataset.view); });
  $("cloudBtn").addEventListener("click", () => go("me"));
  $("sheet").addEventListener("click", e => { if (e.target.classList.contains("sheet-bg")) closeSheet(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });

  if (wakeSupported) {
    const wb = $("wakeBtn"); wb.hidden = false;
    wb.addEventListener("click", () => wakeActive() ? releaseWake() : requestWake());
    document.addEventListener("wake", () => wb.setAttribute("aria-pressed", String(wakeActive())));
  }

  bus.addEventListener("change", () => { renderCurrent(); paintCloud(); });
  bus.addEventListener("view", () => { window.scrollTo({ top: 0 }); renderCurrent(); });
  bus.addEventListener("cloud", () => { paintCloud(); if (S.ui.view === "me") renderCurrent(); });
  bus.addEventListener("sync", paintCloud);

  renderCurrent();
  paintCloud();

  fetch("img/ex/_meta.json").then(r => r.json()).then(m => { setMeta(m); }).catch(() => {});
  initCloud();

  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js");
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        nw && nw.addEventListener("statechange", () => { if (nw.state === "installed" && navigator.serviceWorker.controller) toast("Update ready. Reopen the app to get it."); });
      });
    } catch (e) { /* offline install is a bonus, not a requirement */ }
  }
}
boot();
