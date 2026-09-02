// Supabase mirror. Local state is the source of truth for the UI; this module
// pushes queued writes and pulls the user's rows on sign-in.

import { CONFIG } from "./config.js";
import { S, bus, emit, save, dequeue, mergeFromCloud } from "./store.js";

export const cloud = {
  enabled: !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY),
  client: null,
  user: null,
  status: "local",   // local | loading | signed-out | syncing | synced | offline | error
  error: null,
  lastSync: null,
};

function setStatus(status, error = null) {
  cloud.status = status; cloud.error = error;
  emit("cloud");
}

export async function initCloud() {
  if (!cloud.enabled) return;
  setStatus("loading");
  try {
    const mod = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    cloud.client = mod.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    const { data } = await cloud.client.auth.getSession();
    cloud.user = data.session?.user || null;
    cloud.client.auth.onAuthStateChange((_ev, session) => {
      const was = cloud.user?.id;
      cloud.user = session?.user || null;
      if (cloud.user && cloud.user.id !== was) syncNow();
      if (!cloud.user) setStatus("signed-out");
    });
    if (cloud.user) await syncNow(); else setStatus("signed-out");
  } catch (e) {
    console.warn("cloud init failed", e);
    setStatus("error", "Could not load Supabase client");
  }
  window.addEventListener("online", () => { if (cloud.user) flush(); });
  bus.addEventListener("sync", () => { if (cloud.user && cloud.status !== "syncing") flush(); });
}

export async function signUp(email, password, display_name) {
  const { data, error } = await cloud.client.auth.signUp({ email, password, options: { data: { display_name } } });
  if (error) throw error;
  if (display_name && !S.profile.display_name) { S.profile.display_name = display_name; S.profile.updated_at = Date.now(); save(); }
  return data; // data.session is null when email confirmation is required
}
export async function signIn(email, password) {
  const { data, error } = await cloud.client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
export async function signOut() {
  await cloud.client.auth.signOut();
  cloud.user = null;
  setStatus("signed-out");
}
export async function resetPassword(email) {
  const { error } = await cloud.client.auth.resetPasswordForEmail(email, { redirectTo: location.href.split("#")[0] });
  if (error) throw error;
}

export async function syncNow() {
  if (!cloud.client || !cloud.user) return;
  setStatus("syncing");
  try {
    await flush(true);
    await pull();
    await flush(true); // merge may have queued local-only rows
    cloud.lastSync = Date.now();
    setStatus(S.pending.length ? "offline" : "synced");
  } catch (e) {
    console.warn("sync failed", e);
    setStatus(navigator.onLine ? "error" : "offline", e.message || String(e));
  }
}

async function pull() {
  const c = cloud.client, uid = cloud.user.id;
  const [p, s, d] = await Promise.all([
    c.from("profiles").select("*").eq("id", uid).maybeSingle(),
    c.from("sessions").select("*").eq("user_id", uid),
    c.from("daily").select("*").eq("user_id", uid),
  ]);
  for (const r of [p, s, d]) if (r.error) throw r.error;
  const profile = p.data ? {
    display_name: p.data.display_name || "", units: p.data.units || "kg", schedule: p.data.schedule,
    prefs: p.data.prefs || {}, deloads: p.data.deloads || {}, updated_at: Number(p.data.updated_at) || 0,
  } : null;
  const sessions = (s.data || []).map(r => ({
    id: r.id, date: r.date, day: r.day, started_at: r.started_at, finished_at: r.finished_at,
    sets: r.sets || [], volume: Number(r.volume) || 0, set_count: r.set_count || 0, notes: r.notes || "", updated_at: Number(r.updated_at) || 0,
  }));
  const daily = (d.data || []).map(r => ({
    date: r.date, protein: !!r.protein, creatine: !!r.creatine, cardio_min: r.cardio_min || 0, cardio_hr: r.cardio_hr,
    bodyweight: r.bodyweight == null ? null : Number(r.bodyweight), done: r.done, notes: r.notes || "", updated_at: Number(r.updated_at) || 0,
  }));
  mergeFromCloud({ profile, sessions, daily });
}

let flushing = false;
export async function flush(quiet = false) {
  if (!cloud.client || !cloud.user || flushing) return;
  if (!S.pending.length) { if (!quiet) setStatus("synced"); return; }
  flushing = true;
  if (!quiet) setStatus("syncing");
  const uid = cloud.user.id;
  try {
    for (const item of [...S.pending]) {
      const c = cloud.client;
      let res;
      if (item.table === "profiles") {
        const r = item.row;
        res = await c.from("profiles").upsert({ id: uid, display_name: r.display_name, units: r.units, schedule: r.schedule, prefs: r.prefs, deloads: r.deloads, updated_at: r.updated_at });
      } else if (item.table === "sessions") {
        res = item.op === "delete"
          ? await c.from("sessions").delete().eq("id", item.id).eq("user_id", uid)
          : await c.from("sessions").upsert({ ...item.row, user_id: uid });
      } else if (item.table === "daily") {
        res = item.op === "delete"
          ? await c.from("daily").delete().eq("date", item.id).eq("user_id", uid)
          : await c.from("daily").upsert({ ...item.row, user_id: uid }, { onConflict: "user_id,date" });
      }
      if (res && res.error) throw res.error;
      dequeue(item);
    }
    cloud.lastSync = Date.now();
    if (!quiet) setStatus("synced");
  } catch (e) {
    console.warn("flush failed", e);
    if (!quiet) setStatus(navigator.onLine ? "error" : "offline", e.message || String(e));
    else throw e;
  } finally { flushing = false; }
}
