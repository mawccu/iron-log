import {
  S, save, emit, PROGRAM, dayOf, getDaily, setDaily, setProfile, slotFor, slotDone, dayStatus, sessionsOn, sessionsInWeek, cardioInWeek,
  streakWeeks, weeksSinceDeload, isDeloadWeek, toggleDeload, todayISO, addDays, weekStart, weekdayIndex, fmtDate, fmtShort, parseISO, isoOf, exFor, exerciseByKey,
} from "../store.js";
import { SLOT_LABEL, SLOT_CYCLE } from "../program.js";
import { esc, icon, imgUrl, openSheet, closeSheet, toast, arm, fmtTon } from "../ui.js";
import { tapHaptic } from "../timer.js";

let weekOffset = 0;
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function slotClass(slot) { return slot === "cardio" ? "cardio" : slot === "rest" ? "rest" : "lift"; }
function slotShort(slot) { return slot === "cardio" ? "CA" : slot === "rest" ? "—" : slot; }

export function renderSub(sub) { sub.innerHTML = ""; }

export function render(main) {
  const today = todayISO();
  const wk = addDays(weekStart(today), weekOffset * 7);
  const isThisWeek = weekOffset === 0;
  const lifts = sessionsInWeek(wk).length, cardio = cardioInWeek(wk);
  const target = S.profile.schedule.filter(s => ["A", "B", "C"].includes(s)).length || 3;
  const cardioTarget = S.profile.schedule.filter(s => s === "cardio").length || 2;
  const streak = streakWeeks();
  const sinceDeload = weeksSinceDeload();
  const deload = isDeloadWeek(wk);
  const td = getDaily(today);
  const slot = slotFor(today), status = dayStatus(today);
  let html = "";

  /* today hero */
  if (isThisWeek) {
    const done = slotDone(today);
    const d = ["A", "B", "C"].includes(slot) ? dayOf(slot) : null;
    html += '<section class="hero' + (done ? " done" : "") + '">' +
      '<div class="hero-top"><span class="eyebrow">Today &middot; ' + fmtDate(today) + "</span>" + (streak ? '<span class="streak">' + icon("flame") + streak + " wk streak</span>" : "") + "</div>" +
      '<div class="hero-main">' +
        (d ? '<img class="hero-img" src="' + imgUrl(exFor(d.exercises[0]).img, 0) + '" alt="">' : slot === "cardio" ? '<img class="hero-img" src="' + imgUrl(PROGRAM.cardio.img, 0) + '" alt="">' : "") +
        "<div><h2>" + (d ? "Day " + d.id : slot === "cardio" ? "Cardio" : "Rest day") + "</h2>" +
        "<p>" + (d ? esc(d.focus) : slot === "cardio" ? esc(PROGRAM.cardio.name) + " &middot; " + PROGRAM.cardio.minutes + " min &middot; HR " + PROGRAM.cardio.hr : "Recover. Protein and creatine still count.") + "</p>" +
        (status.lifts.length ? '<p class="did">' + icon("check") + "Day " + status.lifts.join(", ") + " logged" + (status.cardio ? " &middot; cardio " + td.cardio_min + " min" : "") + "</p>" : status.cardio ? '<p class="did">' + icon("check") + "Cardio " + td.cardio_min + " min logged</p>" : "") +
        "</div></div>" +
      '<div class="hero-acts">' +
        (d && !done ? '<button class="act primary big" data-start="' + d.id + '">' + icon("dumbbell") + "Start Day " + d.id + "</button>" : "") +
        (!d && !status.lifts.length ? '<button class="act big" data-start="' + suggestLift() + '">' + icon("dumbbell") + "Lift anyway (Day " + suggestLift() + ")</button>" : "") +
        (slot !== "A" || status.lifts.every(x => x !== "A") ? '<button class="act big" data-cardio="' + today + '">' + icon("heart") + (status.cardio ? "Edit cardio" : "Log cardio") + "</button>" : "") +
      "</div>" +
      '<div class="habits">' +
        '<button class="chip' + (td.protein ? " done" : "") + '" data-hab="protein">' + icon("check") + PROGRAM.nutrition.protein + "</button>" +
        '<button class="chip' + (td.creatine ? " done" : "") + '" data-hab="creatine">' + icon("check") + PROGRAM.nutrition.creatine + "</button>" +
        '<button class="chip' + (td.bodyweight ? " done" : "") + '" data-bw="' + today + '">' + icon("scale") + (td.bodyweight ? td.bodyweight + " kg" : "Bodyweight") + "</button>" +
      "</div>" +
    "</section>";
  }

  /* deload banner */
  if (isThisWeek && !deload && sinceDeload >= 4) {
    html += '<div class="banner yellow">' + icon("moon") + "<div><b>" + sinceDeload + " hard weeks in a row</b><span>The program calls for a lighter week every 4-6. Mark this week as deload to drop a set per exercise.</span></div>" +
      '<button class="act sm" data-deload="' + wk + '">Deload</button></div>';
  }
  if (deload) html += '<div class="banner yellow">' + icon("moon") + "<div><b>Deload week</b><span>Half volume, same weights, nothing near failure.</span></div>" + '<button class="act sm" data-deload="' + wk + '">Undo</button></div>';

  /* week strip */
  html += '<section class="weekbox">' +
    '<div class="week-nav"><button class="iconbtn" data-wk="-1" aria-label="Previous week">' + icon("chevL") + "</button>" +
      "<div><b>" + (isThisWeek ? "This week" : weekOffset === -1 ? "Last week" : weekOffset === 1 ? "Next week" : fmtShort(wk) + " &ndash; " + fmtShort(addDays(wk, 6))) + "</b>" +
      "<span>" + lifts + "/" + target + " lifts &middot; " + cardio + "/" + cardioTarget + " cardio" + (lifts ? " &middot; " + fmtTon(sessionsInWeek(wk).reduce((a, s) => a + s.volume, 0)) : "") + "</span></div>" +
      '<button class="iconbtn" data-wk="1" aria-label="Next week">' + icon("chevR") + "</button></div>" +
    '<div class="strip">' + [0, 1, 2, 3, 4, 5, 6].map(i => {
      const date = addDays(wk, i), sl = slotFor(date), st = dayStatus(date), dn = slotDone(date, sl);
      const isToday = date === today, future = date > today;
      const actual = st.lifts.length ? st.lifts.join("") : st.cardio ? "CA" : null;
      return '<button class="dcell ' + slotClass(sl) + (isToday ? " today" : "") + (dn ? " done" : "") + (future ? " future" : "") + (!dn && !future && sl !== "rest" && !st.any && !isToday ? " missed" : "") + '" data-date="' + date + '">' +
        '<span class="dw">' + DOW[i] + '</span><span class="dn">' + parseISO(date).getDate() + "</span>" +
        '<span class="ds">' + (actual && actual !== slotShort(sl) ? actual : slotShort(sl)) + "</span>" +
        (dn ? '<span class="dk">' + icon("check") + "</span>" : "") +
        (st.protein && st.creatine ? '<span class="dots"><i></i><i></i></span>' : st.protein || st.creatine ? '<span class="dots"><i></i></span>' : "") +
        "</button>";
    }).join("") + "</div>" +
    '<p class="fine">Tap a day to change what it is or mark it done. Template: ' + S.profile.schedule.map((s, i) => DOW[i][0] + " " + slotShort(s)).join(" &middot; ") + "</p>" +
  "</section>";

  /* consistency map: last 12 weeks */
  const weeks = 12, start = addDays(weekStart(today), -(weeks - 1) * 7);
  let cells = "";
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < weeks; c++) {
      const date = addDays(start, c * 7 + r), st = dayStatus(date);
      const lvl = date > today ? "f" : st.lifts.length && st.cardio ? "3" : st.lifts.length ? "2" : st.cardio ? "1" : "0";
      cells += '<i class="hc" data-l="' + lvl + '" title="' + fmtDate(date) + (st.lifts.length ? " · Day " + st.lifts.join(",") : "") + (st.cardio ? " · cardio" : "") + '"></i>';
    }
  }
  html += '<section class="mapbox"><div class="sec-head"><h3>Last 12 weeks</h3><span>' + S.sessions.length + " sessions total</span></div>" +
    '<div class="hmap" style="grid-template-columns:repeat(' + weeks + ',1fr)">' + cells + "</div>" +
    '<div class="hleg"><i class="hc" data-l="0"></i>none <i class="hc" data-l="1"></i>cardio <i class="hc" data-l="2"></i>lift <i class="hc" data-l="3"></i>both</div></section>';

  main.innerHTML = html;
}

function suggestLift() {
  const last = [...S.sessions].reverse()[0];
  const order = ["A", "B", "C"];
  return last ? order[(order.indexOf(last.day) + 1) % 3] : "A";
}

export function bind(main) {
  main.addEventListener("click", e => {
    const t = e.target;
    const today = todayISO();
    const w = t.closest("[data-wk]"); if (w) { weekOffset += Number(w.dataset.wk); emit(); return; }
    const st = t.closest("[data-start]"); if (st) { S.ui.day = st.dataset.start; S.ui.view = "train"; save(); emit("view"); return; }
    const hab = t.closest("[data-hab]"); if (hab) { const f = hab.dataset.hab; setDaily(today, { [f]: !getDaily(today)[f] }); tapHaptic(); return; }
    const ca = t.closest("[data-cardio]"); if (ca) { cardioSheet(ca.dataset.cardio); return; }
    const bw = t.closest("[data-bw]"); if (bw) { bodyweightSheet(bw.dataset.bw); return; }
    const dl = t.closest("[data-deload]"); if (dl) { toggleDeload(dl.dataset.deload); toast(isDeloadWeek(dl.dataset.deload) ? "Deload week on" : "Deload week off"); return; }
    const dc = t.closest("[data-date]"); if (dc) { daySheet(dc.dataset.date); return; }
  });
}

/* ---------------- sheets ---------------- */
function cardioSheet(date) {
  const d = getDaily(date);
  const html = '<div class="sheet-head"><div><span class="eyebrow">' + fmtDate(date) + '</span><h3>Cardio</h3></div><button class="iconbtn" data-x="1" aria-label="Close">' + icon("x") + "</button></div>" +
    '<div class="cardio-pic"><img src="' + imgUrl(PROGRAM.cardio.img, 0) + '" alt=""><div><b>' + esc(PROGRAM.cardio.name) + "</b><span>" + PROGRAM.cardio.minutes + " min &middot; heart rate " + PROGRAM.cardio.hr + "</span><span>" + esc(PROGRAM.cardio.rule) + "</span></div></div>" +
    '<div class="field"><span class="lab">min</span><button class="step" data-f="m" data-by="-5">' + icon("minus") + '</button><input class="num" id="cMin" type="number" inputmode="numeric" value="' + (d.cardio_min || 20) + '"><button class="step" data-f="m" data-by="5">' + icon("plus") + "</button></div>" +
    '<div class="field"><span class="lab">avg HR</span><button class="step" data-f="h" data-by="-5">' + icon("minus") + '</button><input class="num" id="cHr" type="number" inputmode="numeric" value="' + (d.cardio_hr || 130) + '"><button class="step" data-f="h" data-by="5">' + icon("plus") + "</button></div>" +
    '<div class="acts">' + (d.cardio_min ? '<button class="act warn" data-rm="1">Remove</button>' : "") + '<button class="act primary" data-ok="1">Save</button></div>';
  openSheet(html, {
    onOpen(body) {
      body.querySelector("[data-x]").onclick = closeSheet;
      body.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { const el = body.querySelector(b.dataset.f === "m" ? "#cMin" : "#cHr"); el.value = Math.max(0, (Number(el.value) || 0) + Number(b.dataset.by)); });
      body.querySelector("[data-ok]").onclick = () => { setDaily(date, { cardio_min: Number(body.querySelector("#cMin").value) || 0, cardio_hr: Number(body.querySelector("#cHr").value) || null }); closeSheet(); toast("Cardio logged"); };
      const rm = body.querySelector("[data-rm]"); if (rm) rm.onclick = () => { setDaily(date, { cardio_min: 0, cardio_hr: null }); closeSheet(); };
    },
  });
}

function bodyweightSheet(date) {
  const d = getDaily(date);
  const html = '<div class="sheet-head"><div><span class="eyebrow">' + fmtDate(date) + '</span><h3>Bodyweight</h3></div><button class="iconbtn" data-x="1" aria-label="Close">' + icon("x") + "</button></div>" +
    '<div class="field"><span class="lab">kg</span><button class="step" data-by="-0.5">' + icon("minus") + '</button><input class="num" id="bw" type="number" inputmode="decimal" step="0.1" value="' + (d.bodyweight || lastBW() || "") + '" placeholder="0"><button class="step" data-by="0.5">' + icon("plus") + "</button></div>" +
    '<div class="acts">' + (d.bodyweight ? '<button class="act warn" data-rm="1">Remove</button>' : "") + '<button class="act primary" data-ok="1">Save</button></div>';
  openSheet(html, {
    onOpen(body) {
      body.querySelector("[data-x]").onclick = closeSheet;
      body.querySelectorAll("[data-by]").forEach(b => b.onclick = () => { const el = body.querySelector("#bw"); el.value = Math.max(0, Math.round(((Number(el.value) || 0) + Number(b.dataset.by)) * 10) / 10); });
      body.querySelector("[data-ok]").onclick = () => { const v = Number(body.querySelector("#bw").value) || null; setDaily(date, { bodyweight: v }); closeSheet(); toast("Bodyweight saved"); };
      const rm = body.querySelector("[data-rm]"); if (rm) rm.onclick = () => { setDaily(date, { bodyweight: null }); closeSheet(); };
    },
  });
}
function lastBW() { const rows = Object.values(S.daily).filter(x => x.bodyweight > 0).sort((a, b) => b.date.localeCompare(a.date)); return rows.length ? rows[0].bodyweight : null; }

function daySheet(date) {
  const sl = slotFor(date), d = getDaily(date), st = dayStatus(date), dn = slotDone(date, sl);
  const ss = sessionsOn(date);
  const html = '<div class="sheet-head"><div><span class="eyebrow">' + DOW[weekdayIndex(date)] + " &middot; " + esc(SLOT_LABEL[sl]) + (dn ? " &middot; done" : "") + '</span><h3>' + fmtDate(date, { year: true }) + '</h3></div><button class="iconbtn" data-x="1" aria-label="Close">' + icon("x") + "</button></div>" +
    (ss.length ? '<div class="lines">' + ss.map(s => '<div class="line"><span class="en">Day ' + s.day + " &middot; " + esc(dayOf(s.day).focus) + '</span><span class="ev">' + s.set_count + " sets &middot; " + fmtTon(s.volume) + "</span></div>").join("") + "</div>" : "") +
    (st.cardio ? '<div class="lines"><div class="line"><span class="en">Cardio</span><span class="ev">' + d.cardio_min + " min" + (d.cardio_hr ? " &middot; HR " + d.cardio_hr : "") + "</span></div></div>" : "") +
    '<p class="lab-l">This weekday is</p><div class="slots">' + SLOT_CYCLE.map(s => '<button class="slot ' + slotClass(s) + (s === sl ? " on" : "") + '" data-slot="' + s + '">' + esc(SLOT_LABEL[s]) + "</button>").join("") + "</div>" +
    '<p class="fine">Changes the weekly template for every ' + DOW[weekdayIndex(date)] + ". Cardio is never placed on a Day A.</p>" +
    '<div class="acts">' +
      (date <= todayISO() ? '<button class="act' + (d.done === true ? " warn" : "") + '" data-done="1">' + (dn ? "Mark not done" : "Mark done") + "</button>" : "") +
      '<button class="act" data-cardio="1">' + icon("heart") + (st.cardio ? "Edit cardio" : "Log cardio") + "</button>" +
    "</div>" +
    (date <= todayISO() && !["rest"].includes(sl) && !st.lifts.length && ["A", "B", "C"].includes(sl) ? '<button class="act primary wide" data-start="' + sl + '">' + icon("dumbbell") + "Train Day " + sl + " now</button>" : "");
  openSheet(html, {
    onOpen(body) {
      body.querySelector("[data-x]").onclick = closeSheet;
      body.querySelectorAll("[data-slot]").forEach(b => b.onclick = () => {
        const s = b.dataset.slot, i = weekdayIndex(date);
        const schedule = S.profile.schedule.slice(); schedule[i] = s;
        setProfile({ schedule }); closeSheet(); toast(DOW[i] + " is now " + SLOT_LABEL[s]);
      });
      const dd = body.querySelector("[data-done]"); if (dd) dd.onclick = () => { setDaily(date, { done: dn ? false : true }); closeSheet(); toast(dn ? "Marked not done" : "Marked done"); };
      body.querySelector("[data-cardio]").onclick = () => { closeSheet(); setTimeout(() => cardioSheet(date), 260); };
      const st2 = body.querySelector("[data-start]"); if (st2) st2.onclick = () => { S.ui.day = st2.dataset.start; S.ui.view = "train"; save(); closeSheet(); emit("view"); };
    },
  });
}
