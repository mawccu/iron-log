// Rest timer dock + audio/haptics + screen wake lock.

let T = null, tick = null, actx = null, wl = null;
const $ = id => document.getElementById(id);

export function unlockAudio() {
  if (actx) return;
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
}
function beep() {
  if (actx && actx.state === "suspended") { try { actx.resume(); } catch (e) {} }
  if (actx) {
    [0, 0.22, 0.44].forEach((off, i) => {
      try {
        const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + off;
        o.type = "square"; o.frequency.setValueAtTime(i === 2 ? 1320 : 880, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.2);
      } catch (e) {}
    });
  }
  if (navigator.vibrate) { try { navigator.vibrate([120, 80, 120, 80, 220]); } catch (e) {} }
}
export function tapHaptic() { if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} } }

export const clock = sec => { sec = Math.max(0, sec); return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); };

export function startRest({ name, setIdx, sets, seconds }) {
  if (!seconds) { stopRest(); return; }
  T = { name, setIdx, sets, total: seconds, ends: Date.now() + seconds * 1000, rang: false, hide: 0 };
  $("dkEx").textContent = name;
  $("dkSet").textContent = "Set " + (setIdx + 1) + " of " + sets;
  $("dock").classList.add("up");
  document.body.classList.add("has-dock");
  paint();
  if (!tick) tick = setInterval(paint, 250);
}
export function stopRest() {
  T = null;
  $("dock").classList.remove("up");
  document.body.classList.remove("has-dock");
  if (tick) { clearInterval(tick); tick = null; }
}
export function isResting() { return !!T; }

function paint() {
  if (!T) return;
  const dock = $("dock");
  const left = Math.ceil((T.ends - Date.now()) / 1000);
  if (left > 0) {
    dock.dataset.phase = left <= 15 ? "soon" : "run";
    $("dkClock").textContent = clock(left);
    $("dkFill").style.width = (left / T.total * 100) + "%";
  } else {
    if (!T.rang) { T.rang = true; T.hide = Date.now() + 15000; beep(); }
    dock.dataset.phase = "go";
    $("dkClock").textContent = "GO";
    $("dkFill").style.width = "100%";
    if (Date.now() > T.hide) stopRest();
  }
}

export function bindDock() {
  $("dock").addEventListener("click", e => {
    const b = e.target.closest("[data-t]"); if (!b || !T) return;
    const t = b.dataset.t;
    if (t === "skip") { stopRest(); return; }
    T.ends += Number(t) * 1000;
    if (T.ends > Date.now()) T.rang = false;
    paint();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { paint(); if (wl === "lost") requestWake(); }
  });
}

/* ---------------- wake lock ---------------- */
export const wakeSupported = "wakeLock" in navigator;
export function wakeActive() { return !!wl && wl !== "lost"; }
export async function requestWake() {
  if (!wakeSupported) return false;
  try {
    wl = await navigator.wakeLock.request("screen");
    wl.addEventListener("release", () => { if (wl && wl !== "lost") wl = "lost"; document.dispatchEvent(new Event("wake")); });
    document.dispatchEvent(new Event("wake"));
    return true;
  } catch (e) { wl = null; document.dispatchEvent(new Event("wake")); return false; }
}
export async function releaseWake() {
  if (wl && wl !== "lost") { try { await wl.release(); } catch (e) {} }
  wl = null;
  document.dispatchEvent(new Event("wake"));
}
