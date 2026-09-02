# Iron Log

A phone-first training log for a 3-day full-body program. Built to be used mid-set, one-handed, under gym lights.

**Train** · tap a set to log it (pre-filled from last time), the rest timer takes over the bottom of the screen, a photo and form cues for every exercise, alternative exercises one tap away, double-progression "add weight" flags.

**Week** · today's card with a big Start button, the weekly schedule (3 lifts + 2 cardio, editable per weekday), done marks, cardio and bodyweight logging, protein and creatine habits, deload reminders, a 12-week consistency map.

**Progress** · per-exercise charts (top set or estimated 1RM), weekly volume, bodyweight, a records board, and the full session history.

**You** · account, sync status, weekly template, program reference, export.

Installs as a PWA and works offline. Data is local-first; with a Supabase project it syncs across devices behind a real account.

## Run it

It is a static site with no build step. Open `index.html` through any static server (modules need http, not file://):

```
npx serve .
```

## Turn on accounts and sync

1. Create a Supabase project (free tier is fine).
2. In the dashboard open **SQL** and run the whole of `setup.sql` once.
3. In **Authentication → Providers → Email**, turn off *Confirm email* if you want sign-up to work instantly.
4. Copy **Project URL** and **anon public key** from **Project Settings → API** into `js/config.js`.
5. Deploy. Create your account from the **You** tab; whatever you logged before signing in is uploaded to the account.

The anon key is meant to be public. Every table has row-level security keyed to `auth.uid()`, so a user can only ever read or write their own rows.

## Deploy

Any static host works. On GitHub Pages: push to `main`, set Pages to deploy from the root of `main`, done. Bump `VERSION` in `sw.js` and the `?v=` query strings in `index.html` when shipping changes so installed apps refresh.

## Layout

```
index.html            app shell
css/app.css           styles (single dark theme)
js/program.js         the program: days, exercises, targets, rest, photo ids
js/store.js           local-first state, history queries, PRs, schedule logic
js/cloud.js           Supabase auth + sync (upsert queue, pull-merge)
js/timer.js           rest timer, beep/vibrate, wake lock
js/charts.js          canvas line/bar charts with crosshair tooltips
js/views/*.js         Train, Week, Progress, You
img/ex/               exercise photos (two frames each) + _meta.json with cues
setup.sql             database schema + RLS + profile trigger
sw.js, manifest.webmanifest, tools/make-icons.js   PWA bits
```

Exercise photos and instructions come from the public-domain [free-exercise-db](https://github.com/yuhonas/free-exercise-db).
