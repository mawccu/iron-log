import { S, PROGRAM, setProfile, wipeAll, exportJSON, todayISO, fmtDate } from "../store.js";
import { SLOT_LABEL, SLOT_CYCLE } from "../program.js";
import { cloud, signIn, signUp, signOut, syncNow, resetPassword } from "../cloud.js";
import { esc, icon, toast, arm, download, imgUrl } from "../ui.js";

let authMode = "login";
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function renderSub(sub) { sub.innerHTML = ""; }

export function render(main) {
  let html = "";

  /* account */
  html += '<section class="box"><div class="sec-head"><h3>Account</h3><span class="cstate" data-s="' + cloud.status + '"><i></i>' + statusLabel() + "</span></div>";
  if (!cloud.enabled) {
    html += '<p class="fine">Running in <b>local mode</b>: your log lives in this browser only. Add the Supabase keys in <code>js/config.js</code> and run <code>setup.sql</code> to turn on accounts and cross-device sync.</p>';
  } else if (cloud.status === "loading") {
    html += '<p class="fine">Connecting&hellip;</p>';
  } else if (!cloud.user) {
    html += '<div class="seg wide"><button class="' + (authMode === "login" ? "on" : "") + '" data-mode="login">Log in</button><button class="' + (authMode === "signup" ? "on" : "") + '" data-mode="signup">Create account</button></div>' +
      '<form class="authform" id="authForm">' +
        (authMode === "signup" ? '<input class="txt" name="name" placeholder="Your name" autocomplete="name" value="' + esc(S.profile.display_name) + '">' : "") +
        '<input class="txt" name="email" type="email" placeholder="Email" autocomplete="email" required>' +
        '<input class="txt" name="password" type="password" placeholder="Password (8+ characters)" autocomplete="' + (authMode === "signup" ? "new-password" : "current-password") + '" minlength="8" required>' +
        '<button class="act primary wide big" type="submit">' + (authMode === "signup" ? "Create account" : "Log in") + "</button>" +
        '<p class="authmsg" id="authMsg"></p>' +
        (authMode === "login" ? '<button class="linkbtn" type="button" data-forgot="1">Forgot password?</button>' : '<p class="fine">Everything you have logged in this browser is kept and uploaded to your new account.</p>') +
      "</form>";
  } else {
    html += '<div class="kv"><div><span>Signed in as</span><b class="small">' + esc(cloud.user.email) + '</b></div><div><span>Last sync</span><b>' + (cloud.lastSync ? new Date(cloud.lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "&mdash;") + "</b></div>" +
      '<div><span>Pending</span><b>' + S.pending.length + "</b></div></div>" +
      (cloud.error ? '<p class="authmsg err">' + esc(cloud.error) + "</p>" : "") +
      '<div class="acts"><button class="act" data-sync="1">' + icon("cloud") + 'Sync now</button><button class="act warn" data-logout="1">Log out</button></div>';
  }
  html += "</section>";

  /* profile */
  html += '<section class="box"><div class="sec-head"><h3>You</h3></div>' +
    '<div class="field"><span class="lab">name</span><input class="txt" id="pName" value="' + esc(S.profile.display_name) + '" placeholder="Name shown in the app"></div>' +
    "</section>";

  /* schedule template */
  html += '<section class="box"><div class="sec-head"><h3>Weekly template</h3><span>tap to change</span></div><div class="tmpl">' +
    S.profile.schedule.map((s, i) => '<button class="trow" data-tday="' + i + '"><span class="dw">' + DOW[i] + '</span><span class="tslot ' + (s === "cardio" ? "cardio" : s === "rest" ? "rest" : "lift") + '">' + esc(SLOT_LABEL[s]) + "</span>" + icon("chevR") + "</button>").join("") +
    '</div><p class="fine">The program is 3 lifting days on non-consecutive days plus 2 cardio sessions. Cardio goes on a non-lifting day or after Day B or C, never after Day A.</p></section>';

  /* program reference */
  html += '<section class="box"><div class="sec-head"><h3>Program</h3><span>' + esc(PROGRAM.name) + "</span></div>" +
    '<div class="progdays">' + PROGRAM.days.map(d => '<div class="pd"><b>' + d.id + "</b><span>" + esc(d.focus) + "</span><small>" + d.exercises.length + " exercises &middot; " + d.exercises.reduce((a, e) => a + e.sets, 0) + " sets</small></div>").join("") + "</div>" +
    '<ul class="rules">' + PROGRAM.principles.map(p => "<li>" + esc(p) + "</li>").join("") + "<li>Cardio: " + esc(PROGRAM.cardio.name) + ", " + PROGRAM.cardio.minutes + " min at HR " + PROGRAM.cardio.hr + ". " + esc(PROGRAM.cardio.rule) + "</li><li>Daily: " + esc(PROGRAM.nutrition.protein) + ", " + esc(PROGRAM.nutrition.creatine) + ".</li></ul></section>";

  /* data */
  html += '<section class="box"><div class="sec-head"><h3>Data</h3></div>' +
    '<div class="acts"><button class="act" data-export="1">' + icon("download") + 'Export JSON</button><button class="act warn" data-wipe="1" data-arm="Tap again to erase">' + icon("trash") + "Clear local data</button></div>" +
    '<p class="fine">Export downloads every session and daily entry as a file. Clear removes the data from this browser only' + (cloud.user ? "; the copy in your account stays" : "") + ".</p></section>";

  html += '<p class="fine center">Iron Log &middot; built for one program, one phone, zero taps wasted.</p>';
  main.innerHTML = html;
}

function statusLabel() {
  return { local: "Local only", loading: "Connecting", "signed-out": "Signed out", syncing: "Syncing", synced: "Synced", offline: "Offline · " + S.pending.length + " pending", error: "Sync error" }[cloud.status] || cloud.status;
}

export function bind(main) {
  main.addEventListener("click", async e => {
    const t = e.target;
    const md = t.closest("[data-mode]"); if (md) { authMode = md.dataset.mode; render(main); return; }
    if (t.closest("[data-sync]")) { await syncNow(); toast(cloud.status === "synced" ? "Synced" : "Sync " + cloud.status); return; }
    if (t.closest("[data-logout]")) { await signOut(); toast("Logged out"); render(main); return; }
    const fg = t.closest("[data-forgot]");
    if (fg) {
      const email = main.querySelector('[name="email"]').value.trim();
      if (!email) { toast("Type your email first"); return; }
      try { await resetPassword(email); toast("Reset email sent"); } catch (err) { toast(err.message || "Could not send reset"); }
      return;
    }
    const td = t.closest("[data-tday]");
    if (td) {
      const i = +td.dataset.tday; const schedule = S.profile.schedule.slice();
      schedule[i] = SLOT_CYCLE[(SLOT_CYCLE.indexOf(schedule[i]) + 1) % SLOT_CYCLE.length];
      setProfile({ schedule }); return;
    }
    if (t.closest("[data-export]")) { download("iron-log-" + todayISO() + ".json", exportJSON()); return; }
    const wp = t.closest("[data-wipe]"); if (wp) { if (arm(wp)) { wipeAll(); toast("Local data cleared"); } return; }
  });
  main.addEventListener("change", e => {
    if (e.target.id === "pName") { setProfile({ display_name: e.target.value.trim() }); toast("Saved"); }
  });
  main.addEventListener("submit", async e => {
    if (e.target.id !== "authForm") return;
    e.preventDefault();
    const f = e.target, msg = f.querySelector("#authMsg"), btn = f.querySelector('button[type="submit"]');
    const email = f.email.value.trim(), password = f.password.value;
    btn.disabled = true; msg.textContent = ""; msg.className = "authmsg";
    try {
      if (authMode === "signup") {
        const name = (f.name && f.name.value.trim()) || "";
        const data = await signUp(email, password, name);
        if (data.session) { toast("Welcome, " + (name || "lifter")); }
        else { msg.textContent = "Check your inbox and confirm the email, then log in."; msg.className = "authmsg ok"; authMode = "login"; }
      } else {
        await signIn(email, password);
        toast("Logged in");
      }
    } catch (err) {
      msg.textContent = err.message || "Something went wrong";
      msg.className = "authmsg err";
    } finally { btn.disabled = false; }
  });
}
