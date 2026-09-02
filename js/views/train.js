import {
  S, save, emit, PROGRAM, dayOf, exFor, toggleVariant, activeFor, setsFor, activeStats, discardActive,
  lastEntry, bestFor, progressed, prefill, finishSession, getDaily, setDaily, suggestDay, todayISO, daysAgo,
  isDeloadWeek, repLow, repTop, exerciseByKey, round1,
} from "../store.js";
import { isTimed } from "../program.js";
import { esc, META, imgUrl, icon, openSheet, closeSheet, toast, arm, fmtTon } from "../ui.js";
import { startRest, stopRest, unlockAudio, tapHaptic } from "../timer.js";

let open = null; // {key, set}

export function chipVal(rx, s) {
  if (!s.done) return "&mdash;";
  const r = s.r == null ? repLow(rx.reps) : s.r;
  if (isTimed(rx.reps)) return r + "s";
  if (!s.w) return r;
  return s.w + "&times;" + r;
}
export function ghostVal(rx, key, j) {
  const last = lastEntry(key);
  if (!last) return "";
  const src = last.sets[j] || last.sets[last.sets.length - 1];
  if (!src) return "";
  if (isTimed(rx.reps)) return src.r + "s";
  return src.w ? src.w + "&times;" + src.r : String(src.r);
}

/* ---------------- sub bar: day tabs ---------------- */
export function renderSub(sub) {
  const next = suggestDay();
  sub.innerHTML = '<div class="days" role="tablist">' + PROGRAM.days.map(d => {
    const st = activeStats(d.id);
    const sel = S.ui.day === d.id;
    return '<button class="day" role="tab" data-day="' + d.id + '" aria-selected="' + sel + '">' +
      (st.done === 0 && d.id === next ? '<span class="next">NEXT</span>' : "") +
      '<span class="l">' + d.id + '</span><span class="f">' + esc(d.focus) + "</span>" +
      (st.done ? '<span class="prog" style="width:' + Math.round(st.pct * 100) + '%"></span>' : "") +
      "</button>";
  }).join("") + "</div>";
}

/* ---------------- main ---------------- */
export function render(main) {
  const d = dayOf(S.ui.day);
  const st = activeStats(d.id);
  const today = getDaily(todayISO());
  const deload = isDeloadWeek();
  let html = "";

  if (deload) html += '<div class="banner yellow">' + icon("moon") + '<div><b>Deload week</b><span>About half the usual volume. Keep the weights, drop a set per exercise, stop well short of failure.</span></div></div>';

  html += '<div class="meta">' +
    '<span class="chip">' + icon("heart") + (d.cardioAfter ? "Cardio ok after" : "No cardio after A") + "</span>" +
    '<button class="chip' + (today.protein ? " done" : "") + '" data-hab="protein">' + icon("check") + PROGRAM.nutrition.protein + "</button>" +
    '<button class="chip' + (today.creatine ? " done" : "") + '" data-hab="creatine">' + icon("check") + PROGRAM.nutrition.creatine + "</button>" +
    "</div>";

  d.exercises.forEach(ex => {
    const rx = exFor(ex);
    const arr = setsFor(d.id, ex);
    const allDone = arr.every(s => s.done);
    const last = lastEntry(ex.key);
    let hist = "No history yet";
    if (last) {
      const w = last.sets[0].w;
      hist = "<b>Last</b> " + (w ? w + "kg &times; " : "") + last.sets.map(s => s.r == null ? "-" : s.r).join(", ") + " &middot; " + daysAgo(last.date);
    }
    const targetSets = deload ? Math.max(1, ex.sets - 1) : ex.sets;
    html += '<section class="card' + (allDone ? " complete" : "") + '" data-ex="' + ex.key + '">' +
      '<div class="head">' +
        '<button class="thumb" data-photo="' + ex.key + '" aria-label="Show ' + esc(rx.name) + '"><img src="' + imgUrl(rx.img, 0) + '" alt="" loading="lazy" width="112" height="75"></button>' +
        '<div class="hd">' +
          '<h2 class="name">' + esc(rx.name) + (rx.variant === "alt" ? ' <span class="alt-tag">alt</span>' : "") + "</h2>" +
          '<div class="tline"><span class="target">' + targetSets + " &times; " + esc(rx.reps.replace(" sec", "s")) + '</span><span class="muscle">' + esc(ex.muscle) + "</span></div>" +
          '<div class="sub"><span class="hist">' + hist + "</span>" + (progressed(ex) ? '<span class="flag">' + icon("bolt") + "Add weight</span>" : "") + "</div>" +
        "</div>" +
      "</div>" +
      '<div class="sets">' + arr.map((s, j) => {
        const ghost = !s.done ? ghostVal(rx, ex.key, j) : "";
        return '<button class="set" data-set="' + j + '" data-done="' + (s.done ? 1 : 0) + '"' + (open && open.key === ex.key && open.set === j ? ' data-open="1"' : "") + (deload && j >= targetSets ? ' data-extra="1"' : "") + ">" +
          '<span class="n">Set ' + (j + 1) + "</span><span class=\"v\">" + (s.done ? chipVal(rx, s) : (ghost ? '<span class="ghost">' + ghost + "</span>" : "&mdash;")) + "</span></button>";
      }).join("") + "</div>";

    if (open && open.key === ex.key) {
      const s = arr[open.set];
      const timed = isTimed(rx.reps);
      html += '<div class="entry">' +
        (timed || rx.bodyweight ? "" : '<div class="field"><span class="lab">kg</span>' +
          '<button class="step" data-adj="w" data-by="-2.5">' + icon("minus") + "</button>" +
          '<input class="num" id="inW" type="number" inputmode="decimal" step="0.5" value="' + (s.w == null ? "" : s.w) + '" placeholder="0">' +
          '<button class="step" data-adj="w" data-by="2.5">' + icon("plus") + "</button></div>") +
        '<div class="field"><span class="lab">' + (timed ? "sec" : "reps") + "</span>" +
          '<button class="step" data-adj="r" data-by="' + (timed ? -5 : -1) + '">' + icon("minus") + "</button>" +
          '<input class="num" id="inR" type="number" inputmode="numeric" step="1" value="' + (s.r == null ? "" : s.r) + '" placeholder="0">' +
          '<button class="step" data-adj="r" data-by="' + (timed ? 5 : 1) + '">' + icon("plus") + "</button></div>" +
        '<div class="acts"><button class="act warn" data-clear="1">Undo set</button><button class="act primary" data-close="1">Done</button></div>' +
        "</div>";
    }
    html += "</section>";
  });

  html += '<div class="tally">' + st.done + " / " + st.total + " sets" + (st.vol ? " &middot; " + fmtTon(st.vol) + " lifted" : "") + "</div>" +
    '<button class="finish' + (st.done ? " ready" : "") + '" data-finish="1"' + (st.done ? "" : " disabled") + ">Finish day " + d.id + "</button>" +
    (S.active[d.id] && st.done ? '<button class="linkbtn" data-discard="1" data-arm="Tap again to discard">Discard this session</button>' : "");

  main.innerHTML = html;
}

/* ---------------- interactions ---------------- */
export function bind(main, sub) {
  sub.addEventListener("click", e => {
    const b = e.target.closest("[data-day]"); if (!b) return;
    S.ui.day = b.dataset.day; open = null; save(); emit("view");
  });

  main.addEventListener("click", e => {
    const t = e.target;
    const d = dayOf(S.ui.day);

    const hab = t.closest("[data-hab]");
    if (hab) { const f = hab.dataset.hab; setDaily(todayISO(), { [f]: !getDaily(todayISO())[f] }); tapHaptic(); return; }

    const ph = t.closest("[data-photo]");
    if (ph) { showExercise(ph.dataset.photo); return; }

    const setBtn = t.closest("[data-set]");
    if (setBtn) {
      unlockAudio();
      const card = setBtn.closest("[data-ex]");
      const ex = exerciseByKey(card.dataset.ex), rx = exFor(ex);
      const j = +setBtn.dataset.set;
      const arr = setsFor(d.id, ex);
      const s = arr[j];
      if (!s.done) {
        const pre = prefill(d.id, ex, j);
        s.done = true; s.w = pre.w; s.r = pre.r;
        tapHaptic();
        startRest({ name: rx.name, setIdx: j, sets: ex.sets, seconds: ex.rest });
      }
      open = { key: ex.key, set: j };
      save(); emit();
      return;
    }

    const adj = t.closest("[data-adj]");
    if (adj && open) {
      const ex = exerciseByKey(open.key), rx = exFor(ex);
      const f = adj.dataset.adj, by = Number(adj.dataset.by);
      const s = setsFor(d.id, ex)[open.set];
      const cur = s[f] == null ? (f === "r" ? repLow(rx.reps) : 0) : s[f];
      const nv = Math.max(0, Math.round((cur + by) * 10) / 10);
      s[f] = nv;
      const input = document.getElementById(f === "w" ? "inW" : "inR");
      if (input) input.value = nv;
      const chip = main.querySelector('[data-ex="' + open.key + '"] [data-set="' + open.set + '"] .v');
      if (chip) chip.innerHTML = chipVal(rx, s);
      tapHaptic();
      save();
      return;
    }

    if (t.closest("[data-close]")) { open = null; emit(); return; }

    if (t.closest("[data-clear]") && open) {
      const ex = exerciseByKey(open.key);
      setsFor(d.id, ex)[open.set] = { done: false, w: null, r: null };
      open = null; stopRest(); save(); emit(); return;
    }

    if (t.closest("[data-finish]")) { finishSheet(d.id); return; }

    const dis = t.closest("[data-discard]");
    if (dis) { if (arm(dis)) { discardActive(d.id); stopRest(); open = null; toast("Session discarded"); } return; }
  });

  main.addEventListener("input", e => {
    if (!open || !e.target.classList.contains("num")) return;
    const d = dayOf(S.ui.day);
    const ex = exerciseByKey(open.key), rx = exFor(ex);
    const f = e.target.id === "inW" ? "w" : "r";
    const s = setsFor(d.id, ex)[open.set];
    s[f] = e.target.value === "" ? null : Math.max(0, Number(e.target.value));
    const chip = main.querySelector('[data-ex="' + open.key + '"] [data-set="' + open.set + '"] .v');
    if (chip) chip.innerHTML = chipVal(rx, s);
    save();
  });
}

/* ---------------- exercise sheet (photos + cues) ---------------- */
export function showExercise(key) {
  const ex = exerciseByKey(key); if (!ex) return;
  const rx = exFor(ex);
  const m = META[rx.img] || {};
  const best = bestFor(ex.key);
  const muscles = [...(m.primary || []), ...(m.secondary || [])].map(x => x.replace(/\b\w/g, c => c.toUpperCase()));
  const steps = (m.steps || []).slice(0, 6);
  const html =
    '<div class="sheet-head"><div><span class="eyebrow">' + esc(ex.muscle) + " &middot; " + esc(m.equipment || "") + '</span><h3>' + esc(rx.name) + "</h3></div>" +
      '<button class="iconbtn" data-x="1" aria-label="Close">' + icon("x") + "</button></div>" +
    '<div class="frames" data-frames="1"><img class="fr on" src="' + imgUrl(rx.img, 0) + '" alt="' + esc(rx.name) + ' start position"><img class="fr" src="' + imgUrl(rx.img, 1) + '" alt="' + esc(rx.name) + ' end position"><span class="frame-tag" id="frameTag">Start</span></div>' +
    '<div class="kv"><div><span>Target</span><b>' + ex.sets + " &times; " + esc(rx.reps) + '</b></div><div><span>Rest</span><b>' + ex.rest + 's</b></div>' +
      '<div><span>Best</span><b>' + (best.weight ? best.weight + " kg" : "&mdash;") + '</b></div><div><span>e1RM</span><b>' + (best.e1rm ? round1(best.e1rm) + " kg" : "&mdash;") + "</b></div></div>" +
    (muscles.length ? '<div class="tags">' + muscles.map(x => '<span class="tag">' + esc(x) + "</span>").join("") + "</div>" : "") +
    (steps.length ? '<ol class="steps">' + steps.map(s => "<li>" + esc(s) + "</li>").join("") + "</ol>" : "") +
    (ex.alt ? '<button class="act wide" data-swap="1">' + icon("swap") + "Swap to " + esc(rx.variant === "alt" ? ex.name : ex.alt.name) + "</button>" : "") +
    '<p class="fine">Photos and cues from the free-exercise-db (public domain).</p>';

  openSheet(html, {
    onOpen(body) {
      const frs = body.querySelectorAll(".fr"), tag = body.querySelector("#frameTag");
      let i = 0;
      const t = setInterval(() => { i = 1 - i; frs.forEach((f, k) => f.classList.toggle("on", k === i)); if (tag) tag.textContent = i ? "End" : "Start"; }, 1100);
      body.querySelector("[data-x]").onclick = closeSheet;
      const fr = body.querySelector("[data-frames]");
      fr.onclick = () => { i = 1 - i; frs.forEach((f, k) => f.classList.toggle("on", k === i)); if (tag) tag.textContent = i ? "End" : "Start"; };
      const sw = body.querySelector("[data-swap]");
      if (sw) sw.onclick = () => { toggleVariant(ex.key); closeSheet(); toast("Swapped to " + exFor(ex).name); };
      return () => clearInterval(t);
    },
  });
}

/* ---------------- finish sheet ---------------- */
function finishSheet(dayId) {
  const d = dayOf(dayId), st = activeStats(dayId), a = activeFor(dayId);
  const lines = d.exercises.map(ex => {
    const rx = exFor(ex);
    const done = (a.sets[ex.key] || []).filter(s => s.done);
    if (!done.length) return "";
    const w = done[0].w;
    return '<div class="line"><span class="en">' + esc(rx.name) + '</span><span class="ev">' + (w ? w + " &times; " : "") + done.map(s => s.r == null ? repLow(rx.reps) : s.r).join(", ") + "</span></div>";
  }).join("");
  const html =
    '<div class="sheet-head"><div><span class="eyebrow">Day ' + d.id + " &middot; " + esc(d.focus) + '</span><h3>Finish session</h3></div><button class="iconbtn" data-x="1" aria-label="Close">' + icon("x") + "</button></div>" +
    '<div class="kv"><div><span>Sets</span><b>' + st.done + " / " + st.total + '</b></div><div><span>Lifted</span><b>' + fmtTon(st.vol) + "</b></div></div>" +
    '<div class="lines">' + lines + "</div>" +
    '<textarea class="notes" id="fnNotes" placeholder="Notes (optional): how it felt, what to change next time" rows="2"></textarea>' +
    '<button class="act primary wide big" data-save="1">' + icon("check") + "Save session</button>";
  openSheet(html, {
    onOpen(body) {
      body.querySelector("[data-x]").onclick = closeSheet;
      body.querySelector("[data-save]").onclick = () => {
        const notes = body.querySelector("#fnNotes").value.trim();
        const res = finishSession(dayId, notes);
        stopRest(); open = null;
        if (!res) { closeSheet(); return; }
        const prs = res.prs;
        body.innerHTML =
          '<div class="saved">' + icon("trophy", "big") + "<h3>Day " + d.id + " logged</h3><p>" + res.session.set_count + " sets &middot; " + fmtTon(res.session.volume) + "</p>" +
          (prs.length ? '<div class="prs">' + prs.map(p => '<div class="pr"><b>PR</b><span>' + esc(exFor(exerciseByKey(p.key)).name) + "</span><em>" + (p.type === "weight" ? p.from + " &rarr; " + p.to + " kg" : "e1RM " + p.from + " &rarr; " + p.to) + "</em></div>").join("") + "</div>" : '<p class="fine">No new records today. Consistency is the record.</p>') +
          '<button class="act primary wide big" data-ok="1">Done</button></div>';
        body.querySelector("[data-ok]").onclick = () => { closeSheet(); S.ui.view = "week"; save(); emit("view"); };
        if (navigator.vibrate) { try { navigator.vibrate(prs.length ? [60, 40, 60, 40, 200] : 60); } catch (e) {} }
      };
    },
  });
}
