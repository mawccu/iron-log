import {
  S, PROGRAM, dayOf, exFor, exerciseByKey, totals, sessionsInWeek, weekStart, todayISO, streakWeeks, weeklyVolume, bodyweightSeries,
  exerciseSeries, allPRs, deleteSession, fmtDate, fmtShort, daysAgo, round1, repLow,
} from "../store.js";
import { esc, icon, imgUrl, openSheet, closeSheet, toast, arm, fmtTon } from "../ui.js";
import { lineChart, barChart } from "../charts.js";
import { showExercise } from "./train.js";

let pick = null, metric = "top", openSess = null, histLimit = 10;

export function renderSub(sub) { sub.innerHTML = ""; }

export function render(main) {
  const t = totals();
  const wk = sessionsInWeek(weekStart(todayISO())).length;
  const streak = streakWeeks();
  const prs = allPRs();
  const allEx = PROGRAM.days.flatMap(d => d.exercises);
  if (!pick) pick = (prs[0] && prs[0].key) || allEx[0].key;
  const ex = exerciseByKey(pick), rx = exFor(ex);
  const series = exerciseSeries(pick);
  const bw = bodyweightSeries();
  const wv = weeklyVolume(8);

  let html = '<div class="stats">' +
    '<div class="stat"><div class="k">Sessions</div><div class="v">' + t.sessions + "</div></div>" +
    '<div class="stat"><div class="k">This week</div><div class="v">' + wk + '<small>/3</small></div></div>' +
    '<div class="stat"><div class="k">Streak</div><div class="v">' + streak + "<small>wk</small></div></div>" +
    '<div class="stat"><div class="k">Lifted</div><div class="v">' + (t.volume >= 1000 ? (t.volume / 1000).toFixed(t.volume >= 10000 ? 0 : 1) + "<small>t</small>" : Math.round(t.volume) + "<small>kg</small>") + "</div></div>" +
    "</div>";

  /* exercise progress */
  html += '<section class="box"><div class="sec-head"><h3>Exercise progress</h3>' +
    '<div class="seg"><button class="' + (metric === "top" ? "on" : "") + '" data-metric="top">Top set</button><button class="' + (metric === "e1rm" ? "on" : "") + '" data-metric="e1rm">e1RM</button></div></div>' +
    '<div class="pickrow"><img src="' + imgUrl(rx.img, 0) + '" alt="" data-photo="' + ex.key + '"><select id="exPick" aria-label="Exercise">' +
      PROGRAM.days.map(d => '<optgroup label="Day ' + d.id + '">' + d.exercises.map(e => '<option value="' + e.key + '"' + (e.key === pick ? " selected" : "") + ">" + esc(exFor(e).name) + "</option>").join("") + "</optgroup>").join("") +
    "</select></div>" +
    '<div class="chartwrap"><canvas id="exChart" height="190"></canvas></div>' +
    (series.length ? '<div class="lines compact">' + series.slice(-5).reverse().map(p => '<div class="line"><span class="en">' + fmtDate(p.date) + '</span><span class="ev">' + (p.top ? p.top + " kg &times; " : "") + p.reps + (metric === "e1rm" ? " &middot; e1RM " + p.e1rm : "") + "</span></div>").join("") + "</div>" : '<p class="fine">Log this exercise once and the chart starts here.</p>') +
    "</section>";

  /* weekly volume */
  html += '<section class="box"><div class="sec-head"><h3>Weekly volume</h3><span>last 8 weeks</span></div><div class="chartwrap"><canvas id="volChart" height="170"></canvas></div></section>';

  /* bodyweight */
  html += '<section class="box"><div class="sec-head"><h3>Bodyweight</h3><span>' + (bw.length ? bw[bw.length - 1].y + " kg latest" : "log it from the Week tab") + '</span></div><div class="chartwrap"><canvas id="bwChart" height="150"></canvas></div></section>';

  /* PR board */
  html += '<section class="box"><div class="sec-head"><h3>Records</h3><span>best set &middot; est. 1RM</span></div>' +
    (prs.length ? '<div class="prboard">' + prs.map(p => '<button class="prrow" data-pick="' + p.key + '"><img src="' + imgUrl(exFor(exerciseByKey(p.key)).img, 0) + '" alt=""><span class="en">' + esc(p.name) + '<small>' + daysAgo(p.weightDate) + '</small></span><span class="ev"><b>' + p.weight + '</b> kg<small>e1RM ' + round1(p.e1rm) + "</small></span></button>").join("") + "</div>" : '<p class="fine">No records yet. Finish a session and they appear here.</p>') +
    "</section>";

  /* history */
  const hist = [...S.sessions].reverse();
  html += '<section class="box"><div class="sec-head"><h3>History</h3><span>' + hist.length + " sessions</span></div>";
  if (!hist.length) html += '<p class="fine">Finished sessions will be listed here with every set.</p>';
  hist.slice(0, histLimit).forEach(h => {
    const d = dayOf(h.day);
    const lines = d.exercises.map(ex => {
      const arr = (h.sets || []).filter(s => s.key === ex.key); if (!arr.length) return "";
      const w = arr[0].w;
      const name = arr[0].variant === "alt" && ex.alt ? ex.alt.name : ex.name;
      return '<div class="line"><span class="en">' + esc(name) + '</span><span class="ev">' + (w ? w + " &times; " : "") + arr.map(s => s.r).join(", ") + "</span></div>";
    }).join("");
    html += '<div class="sess' + (openSess === h.id ? " open" : "") + '" data-sess="' + h.id + '">' +
      '<button class="sess-h"><span class="badge">' + h.day + '</span><span class="sess-d"><b>' + fmtDate(h.date, { year: true }) + "</b><span>" + h.set_count + " sets &middot; " + daysAgo(h.date) + '</span></span><span class="sess-v">' + fmtTon(h.volume) + "</span></button>" +
      (openSess === h.id ? '<div class="sess-body">' + lines + (h.notes ? '<p class="note-txt">' + esc(h.notes) + "</p>" : "") + '<button class="linkbtn danger" data-del="' + h.id + '" data-arm="Tap again to delete">Delete session</button></div>' : "") +
      "</div>";
  });
  if (hist.length > histLimit) html += '<button class="act wide" data-more="1">Show more</button>';
  html += "</section>";

  main.innerHTML = html;

  /* charts */
  const fmtKg = v => (Math.round(v * 10) / 10) + "";
  const VOLT = "#C6F542", BLUE = "#4E9BFF", AMBER = "#FFB84D";
  lineChart(main.querySelector("#exChart"), series.map(p => ({ x: fmtShort(p.date), y: metric === "top" ? p.top : p.e1rm, tip: (metric === "top" ? "reps " + p.reps : "top " + p.top + " kg × " + p.reps) })), { fmt: fmtKg, color: VOLT, empty: "No sessions logged for " + rx.name });
  barChart(main.querySelector("#volChart"), wv.map(w => ({ x: fmtShort(w.week), y: Math.round(w.volume), tip: w.sessions + " sessions · " + w.cardio + " cardio", mark: w.sessions ? String(w.sessions) : "" })), { color: BLUE, fmt: v => (v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + "t" : String(v)) });
  lineChart(main.querySelector("#bwChart"), bw.map(p => ({ x: fmtShort(p.date), y: p.y })), { color: AMBER, fmt: v => fmtKg(v) + "", empty: "No bodyweight entries yet" });
}

export function bind(main) {
  main.addEventListener("change", e => { if (e.target.id === "exPick") { pick = e.target.value; render(main); } });
  main.addEventListener("click", e => {
    const t = e.target;
    const m = t.closest("[data-metric]"); if (m) { metric = m.dataset.metric; render(main); return; }
    const ph = t.closest("[data-photo]"); if (ph) { showExercise(ph.dataset.photo); return; }
    const pk = t.closest("[data-pick]"); if (pk) { pick = pk.dataset.pick; render(main); main.querySelector("#exChart").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const del = t.closest("[data-del]"); if (del) { if (arm(del)) { deleteSession(del.dataset.del); openSess = null; toast("Session deleted"); } return; }
    const more = t.closest("[data-more]"); if (more) { histLimit += 20; render(main); return; }
    const sh = t.closest(".sess-h"); if (sh) { const id = sh.parentElement.dataset.sess; openSess = openSess === id ? null : id; render(main); return; }
  });
}
