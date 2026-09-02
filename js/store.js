// Local-first state. Everything the app shows comes from here; cloud.js mirrors
// it to Supabase when the user is signed in. Rows keep the same shape locally
// and in the database so sync is a plain upsert.

import { PROGRAM, dayOf, exerciseByKey, resolveExercise, repLow, repTop, DEFAULT_SCHEDULE } from "./program.js";

const KEY = "ironlog.v2";

export const S = {
  profile: { display_name: "", units: "kg", schedule: DEFAULT_SCHEDULE.slice(), prefs: {}, deloads: {}, updated_at: 0 },
  sessions: [],     // finished sessions
  daily: {},        // date -> daily row
  active: {},       // dayId -> in-progress session (local only)
  pending: [],      // sync queue
  ui: { day: "A", view: "train" },
};

export const bus = new EventTarget();
export const emit = (type = "change", detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));

/* ---------------- persistence ---------------- */
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (p.profile) S.profile = { ...S.profile, ...p.profile };
    if (!Array.isArray(S.profile.schedule) || S.profile.schedule.length !== 7) S.profile.schedule = DEFAULT_SCHEDULE.slice();
    S.sessions = Array.isArray(p.sessions) ? p.sessions : [];
    S.daily = p.daily || {};
    S.active = p.active || {};
    S.pending = Array.isArray(p.pending) ? p.pending : [];
    S.ui = { ...S.ui, ...(p.ui || {}) };
  } catch (e) { console.warn("load failed", e); }
  sortSessions();
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      profile: S.profile, sessions: S.sessions, daily: S.daily, active: S.active, pending: S.pending, ui: S.ui,
    }));
  } catch (e) { console.warn("save failed", e); }
}

function sortSessions() {
  S.sessions.sort((a, b) => (a.date === b.date ? (a.finished_at || "").localeCompare(b.finished_at || "") : a.date.localeCompare(b.date)));
}

/* ---------------- sync queue ---------------- */
export function queue(op, table, row) {
  const id = table === "daily" ? row.date : row.id;
  S.pending = S.pending.filter(p => !(p.table === table && p.id === id));
  S.pending.push({ op, table, id, row, at: Date.now() });
  save();
  emit("sync");
}
export function dequeue(item) {
  S.pending = S.pending.filter(p => p !== item);
  save();
  emit("sync");
}

/* ---------------- helpers ---------------- */
export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); });
}
export const pad = n => String(n).padStart(2, "0");
export function isoOf(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
export function todayISO() { return isoOf(new Date()); }
export function parseISO(iso) { const p = iso.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
export function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoOf(d); }
export function weekStart(iso) { const d = parseISO(iso); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return isoOf(d); } // Monday
export function weekdayIndex(iso) { return (parseISO(iso).getDay() + 6) % 7; }
export function nowISO() { return new Date().toISOString(); }

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(iso, opts = {}) {
  const d = parseISO(iso);
  const s = DOW[(d.getDay() + 6) % 7] + " " + d.getDate() + " " + MON[d.getMonth()];
  return opts.year ? s + " " + d.getFullYear() : s;
}
export function fmtShort(iso) { const d = parseISO(iso); return d.getDate() + " " + MON[d.getMonth()]; }
export function daysAgo(iso) {
  const n = Math.round((parseISO(todayISO()) - parseISO(iso)) / 86400000);
  return n <= 0 ? "today" : n === 1 ? "yesterday" : n + "d ago";
}
export const e1rm = (w, r) => (w > 0 && r > 0 ? w * (1 + r / 30) : 0);
export const round1 = n => Math.round(n * 10) / 10;

/* ---------------- profile ---------------- */
export function setProfile(patch) {
  Object.assign(S.profile, patch, { updated_at: Date.now() });
  save();
  queue("upsert", "profiles", { ...S.profile });
  emit();
}
export function exFor(ex) { return resolveExercise(ex, S.profile.prefs); }
export function toggleVariant(key) {
  const prefs = { ...S.profile.prefs };
  prefs[key] = prefs[key] === "alt" ? "main" : "alt";
  setProfile({ prefs });
}

/* ---------------- active session ---------------- */
export function activeFor(dayId) {
  if (!S.active[dayId]) S.active[dayId] = { started: todayISO(), started_at: nowISO(), sets: {} };
  return S.active[dayId];
}
export function setsFor(dayId, ex) {
  const a = activeFor(dayId);
  if (!a.sets[ex.key] || a.sets[ex.key].length !== ex.sets) {
    const arr = [];
    for (let j = 0; j < ex.sets; j++) arr.push((a.sets[ex.key] && a.sets[ex.key][j]) || { done: false, w: null, r: null });
    a.sets[ex.key] = arr;
  }
  return a.sets[ex.key];
}
export function activeStats(dayId) {
  const d = dayOf(dayId), a = S.active[dayId];
  let total = 0, done = 0, vol = 0;
  d.exercises.forEach(ex => {
    total += ex.sets;
    ((a && a.sets[ex.key]) || []).forEach(s => { if (s.done) { done++; vol += (s.w || 0) * (s.r || 0); } });
  });
  return { total, done, vol, pct: total ? done / total : 0 };
}
export function discardActive(dayId) { delete S.active[dayId]; save(); emit(); }

/* ---------------- history queries ---------------- */
export function entriesFor(key) {
  // [{date, sets:[{w,r}], session}] oldest -> newest
  const out = [];
  for (const s of S.sessions) {
    const sets = (s.sets || []).filter(x => x.key === key);
    if (sets.length) out.push({ date: s.date, sets, session: s });
  }
  return out;
}
export function lastEntry(key) { const e = entriesFor(key); return e.length ? e[e.length - 1] : null; }
export function bestFor(key) {
  let bw = 0, be = 0, bwDate = null, beDate = null;
  for (const e of entriesFor(key)) for (const s of e.sets) {
    if ((s.w || 0) > bw) { bw = s.w; bwDate = e.date; }
    const x = e1rm(s.w, s.r);
    if (x > be) { be = x; beDate = e.date; }
  }
  return { weight: bw, weightDate: bwDate, e1rm: be, e1rmDate: beDate };
}
export function progressed(ex) {
  // Double progression: top of range on every set, two sessions running.
  const hits = entriesFor(ex.key).slice(-2);
  if (hits.length < 2) return false;
  const top = repTop(exFor(ex).reps);
  return hits.every(h => h.sets.length >= ex.sets && h.sets.every(s => (s.r || 0) >= top));
}
export function prefill(dayId, ex, j) {
  const arr = setsFor(dayId, ex);
  for (let p = j - 1; p >= 0; p--) if (arr[p].done) return { w: arr[p].w, r: arr[p].r };
  const last = lastEntry(ex.key);
  if (last) { const src = last.sets[j] || last.sets[last.sets.length - 1]; return { w: src.w, r: src.r }; }
  return { w: null, r: repLow(exFor(ex).reps) };
}

/* ---------------- finish ---------------- */
export function finishSession(dayId, notes = "") {
  const a = S.active[dayId];
  if (!a) return null;
  const d = dayOf(dayId);
  const before = {};
  d.exercises.forEach(ex => { before[ex.key] = bestFor(ex.key); });
  const sets = [];
  let vol = 0;
  d.exercises.forEach(ex => {
    const rx = exFor(ex);
    (a.sets[ex.key] || []).forEach((s, i) => {
      if (!s.done) return;
      const row = { key: ex.key, i, w: s.w || 0, r: s.r == null ? repLow(rx.reps) : s.r, variant: rx.variant };
      sets.push(row);
      vol += row.w * row.r;
    });
  });
  if (!sets.length) return null;
  const date = a.started || todayISO();
  const session = {
    id: uuid(), date, day: dayId, started_at: a.started_at || nowISO(), finished_at: nowISO(),
    sets, volume: Math.round(vol), set_count: sets.length, notes, updated_at: Date.now(),
  };
  S.sessions.push(session);
  sortSessions();
  delete S.active[dayId];
  // PR detection
  const prs = [];
  d.exercises.forEach(ex => {
    const b = before[ex.key], n = bestFor(ex.key);
    if (n.weight > b.weight && b.weight > 0) prs.push({ key: ex.key, type: "weight", from: b.weight, to: n.weight });
    else if (n.e1rm > b.e1rm && b.e1rm > 0) prs.push({ key: ex.key, type: "e1rm", from: round1(b.e1rm), to: round1(n.e1rm) });
  });
  save();
  queue("upsert", "sessions", session);
  emit();
  return { session, prs };
}
export function deleteSession(id) {
  S.sessions = S.sessions.filter(s => s.id !== id);
  save();
  queue("delete", "sessions", { id });
  emit();
}

/* ---------------- daily ---------------- */
export function getDaily(date) {
  return S.daily[date] || { date, protein: false, creatine: false, cardio_min: 0, cardio_hr: null, bodyweight: null, done: null, notes: "", updated_at: 0 };
}
export function setDaily(date, patch) {
  const row = { ...getDaily(date), ...patch, date, updated_at: Date.now() };
  S.daily[date] = row;
  save();
  queue("upsert", "daily", row);
  emit();
}

/* ---------------- schedule ---------------- */
export function slotFor(date) { return S.profile.schedule[weekdayIndex(date)] || "rest"; }
export function sessionsOn(date) { return S.sessions.filter(s => s.date === date); }
export function slotDone(date, slot = slotFor(date)) {
  const d = getDaily(date);
  if (d.done === true) return true;
  if (d.done === false) return false;
  if (slot === "rest") return false;
  if (slot === "cardio") return (d.cardio_min || 0) > 0;
  return sessionsOn(date).some(s => s.day === slot);
}
export function dayStatus(date) {
  // richer than slotDone: what actually happened
  const lifts = sessionsOn(date).map(s => s.day);
  const d = getDaily(date);
  return { lifts, cardio: (d.cardio_min || 0) > 0, protein: !!d.protein, creatine: !!d.creatine, any: lifts.length > 0 || (d.cardio_min || 0) > 0 };
}
export function suggestDay() {
  const today = todayISO();
  const slot = slotFor(today);
  if (["A", "B", "C"].includes(slot) && !slotDone(today, slot)) return slot;
  const last = [...S.sessions].reverse()[0];
  if (!last) return "A";
  const order = ["A", "B", "C"];
  return order[(order.indexOf(last.day) + 1) % 3];
}
export function weekKeyOf(date) { return weekStart(date); }
export function sessionsInWeek(wk) { const end = addDays(wk, 6); return S.sessions.filter(s => s.date >= wk && s.date <= end); }
export function cardioInWeek(wk) {
  let n = 0; for (let i = 0; i < 7; i++) { const d = getDaily(addDays(wk, i)); if ((d.cardio_min || 0) > 0) n++; }
  return n;
}
export function streakWeeks() {
  // consecutive weeks (ending this or last week) with >= 3 sessions
  let wk = weekStart(todayISO()), n = 0;
  if (sessionsInWeek(wk).length < 3) wk = addDays(wk, -7);
  while (sessionsInWeek(wk).length >= 3) { n++; wk = addDays(wk, -7); if (n > 520) break; }
  return n;
}
export function weeksSinceDeload() {
  // weeks of >= 3 sessions since the last deload-flagged week
  let wk = weekStart(todayISO()), n = 0;
  for (let i = 0; i < 52; i++) {
    if (S.profile.deloads[wk]) break;
    if (sessionsInWeek(wk).length >= 3) n++;
    else if (i > 0 && sessionsInWeek(wk).length === 0) break;
    wk = addDays(wk, -7);
  }
  return n;
}
export function isDeloadWeek(date = todayISO()) { return !!S.profile.deloads[weekStart(date)]; }
export function toggleDeload(wk) {
  const deloads = { ...S.profile.deloads };
  if (deloads[wk]) delete deloads[wk]; else deloads[wk] = true;
  setProfile({ deloads });
}

/* ---------------- aggregate stats ---------------- */
export function totals() {
  const vol = S.sessions.reduce((a, s) => a + (s.volume || 0), 0);
  const sets = S.sessions.reduce((a, s) => a + (s.set_count || 0), 0);
  return { sessions: S.sessions.length, volume: vol, sets };
}
export function weeklyVolume(nWeeks = 8) {
  const out = [];
  let wk = weekStart(todayISO());
  for (let i = 0; i < nWeeks; i++) {
    const ss = sessionsInWeek(wk);
    out.unshift({ week: wk, volume: ss.reduce((a, s) => a + (s.volume || 0), 0), sessions: ss.length, cardio: cardioInWeek(wk) });
    wk = addDays(wk, -7);
  }
  return out;
}
export function bodyweightSeries() {
  return Object.values(S.daily).filter(d => d.bodyweight > 0).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({ date: d.date, y: d.bodyweight }));
}
export function exerciseSeries(key) {
  return entriesFor(key).map(e => {
    const top = e.sets.reduce((m, s) => Math.max(m, s.w || 0), 0);
    const best = e.sets.reduce((m, s) => Math.max(m, e1rm(s.w, s.r)), 0);
    return { date: e.date, top, e1rm: round1(best), reps: e.sets.map(s => s.r).join("/"), sets: e.sets };
  });
}
export function allPRs() {
  const out = [];
  for (const d of PROGRAM.days) for (const ex of d.exercises) {
    const b = bestFor(ex.key);
    if (b.weight > 0) out.push({ key: ex.key, name: exFor(ex).name, ...b });
  }
  return out.sort((a, b) => b.e1rm - a.e1rm);
}

/* ---------------- cloud merge ---------------- */
export function mergeFromCloud({ profile, sessions, daily }) {
  const pendingDel = new Set(S.pending.filter(p => p.op === "delete").map(p => p.table + ":" + p.id));
  if (profile) {
    if ((profile.updated_at || 0) > (S.profile.updated_at || 0)) {
      S.profile = { ...S.profile, ...profile, schedule: profile.schedule || S.profile.schedule, prefs: profile.prefs || {}, deloads: profile.deloads || {} };
    } else if ((S.profile.updated_at || 0) > (profile.updated_at || 0)) queue("upsert", "profiles", { ...S.profile });
  } else queue("upsert", "profiles", { ...S.profile });

  const cloudIds = new Set();
  for (const row of sessions || []) {
    cloudIds.add(row.id);
    if (pendingDel.has("sessions:" + row.id)) continue;
    const i = S.sessions.findIndex(s => s.id === row.id);
    if (i < 0) S.sessions.push(row);
    else if ((row.updated_at || 0) > (S.sessions[i].updated_at || 0)) S.sessions[i] = row;
  }
  for (const s of S.sessions) if (!cloudIds.has(s.id) && !S.pending.some(p => p.table === "sessions" && p.id === s.id)) queue("upsert", "sessions", s);
  sortSessions();

  const cloudDates = new Set();
  for (const row of daily || []) {
    cloudDates.add(row.date);
    const loc = S.daily[row.date];
    if (!loc || (row.updated_at || 0) > (loc.updated_at || 0)) S.daily[row.date] = row;
  }
  for (const d of Object.values(S.daily)) if (!cloudDates.has(d.date) && !S.pending.some(p => p.table === "daily" && p.id === d.date)) queue("upsert", "daily", d);
  save();
  emit();
}

export function wipeAll() {
  S.sessions = []; S.daily = {}; S.active = {}; S.pending = [];
  S.profile = { display_name: S.profile.display_name, units: "kg", schedule: DEFAULT_SCHEDULE.slice(), prefs: {}, deloads: {}, updated_at: Date.now() };
  save();
  emit();
}

export function exportJSON() {
  return JSON.stringify({ exported: nowISO(), profile: S.profile, sessions: S.sessions, daily: S.daily }, null, 2);
}

export { PROGRAM, dayOf, exerciseByKey, repLow, repTop };
