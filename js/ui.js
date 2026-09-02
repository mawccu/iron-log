// Shared UI helpers: escaping, exercise photo metadata, bottom sheet, toast, icons.

export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const META = {}; // exercise photo metadata (loaded from img/ex/_meta.json)
export function setMeta(obj) { Object.assign(META, obj); }
export const imgUrl = (id, frame = 0) => "img/ex/" + encodeURIComponent(id) + "_" + frame + ".jpg";

export const fmtNum = n => Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 });
export const fmtTon = kg => (kg >= 1000 ? (kg / 1000).toFixed(kg >= 10000 ? 0 : 1) + " t" : Math.round(kg) + " kg");

/* ---------------- icons ---------------- */
const PATHS = {
  dumbbell: '<path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  chart: '<path d="M4 19V5M4 19h16M8 15l4-5 3 3 5-6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1 0 9H7z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevL: '<path d="M15 5l-7 7 7 7"/>',
  chevR: '<path d="M9 5l7 7-7 7"/>',
  swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-5 1-9z"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
  scale: '<path d="M12 3v3M4 8l8-2 8 2M4 8l-2 6a3 3 0 0 0 6 0L6 8M20 8l2 6a3 3 0 0 1-6 0l2-6M12 6v14M8 20h8"/>',
  photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  moon: '<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
};
export const icon = (name, cls = "") => '<svg class="ico ' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PATHS[name] || "") + "</svg>";

/* ---------------- bottom sheet ---------------- */
let sheetCleanup = null;
export function openSheet(html, { onOpen, cls = "" } = {}) {
  const sh = document.getElementById("sheet");
  const body = document.getElementById("sheetBody");
  if (sheetCleanup) { try { sheetCleanup(); } catch (e) {} sheetCleanup = null; }
  body.innerHTML = html;
  sh.querySelector(".sheet-panel").className = "sheet-panel " + cls;
  sh.hidden = false;
  requestAnimationFrame(() => sh.classList.add("open"));
  document.body.classList.add("sheet-open");
  if (onOpen) sheetCleanup = onOpen(body) || null;
}
export function closeSheet() {
  const sh = document.getElementById("sheet");
  if (sh.hidden) return;
  sh.classList.remove("open");
  document.body.classList.remove("sheet-open");
  if (sheetCleanup) { try { sheetCleanup(); } catch (e) {} sheetCleanup = null; }
  setTimeout(() => { sh.hidden = true; document.getElementById("sheetBody").innerHTML = ""; }, 240);
}
export function isSheetOpen() { return !document.getElementById("sheet").hidden; }

/* ---------------- toast ---------------- */
let toastT = null;
export function toast(msg, kind = "") {
  const el = document.getElementById("toast");
  el.textContent = msg; el.className = "toast show " + kind;
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove("show"), 2600);
}

/* ---------------- two-tap confirm ---------------- */
// Usage: button has data-arm="Label when armed"; call arm(btn) on click; returns true when confirmed.
const armed = new WeakMap();
export function arm(btn) {
  if (armed.get(btn)) { clearTimeout(armed.get(btn).t); armed.delete(btn); btn.classList.remove("armed"); btn.textContent = btn.dataset.orig; return true; }
  btn.dataset.orig = btn.textContent;
  btn.textContent = btn.dataset.arm || "Tap again to confirm";
  btn.classList.add("armed");
  const t = setTimeout(() => { armed.delete(btn); btn.classList.remove("armed"); btn.textContent = btn.dataset.orig; }, 3200);
  armed.set(btn, { t });
  return false;
}

/* ---------------- download ---------------- */
export function download(name, text, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
