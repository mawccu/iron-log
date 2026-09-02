// Canvas charts: single-series line with crosshair tooltip, and a bar chart.
// One hue per chart; text in ink tokens; recessive grid.

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function setup(cv) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = cv.clientWidth || 320, h = cv.clientHeight || 180;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function niceTicks(min, max, n = 4) {
  if (max === min) { max = min + 1; }
  const span = max - min, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const cand = [1, 2, 2.5, 5, 10].map(x => x * mag);
  const step = cand.find(s => span / s <= n) || cand[cand.length - 1];
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const out = []; for (let v = lo; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return { ticks: out, lo, hi };
}

/**
 * lineChart(canvas, points, opts)
 * points: [{x: label string, y: number, tip?: string}]
 */
export function lineChart(cv, points, opts = {}) {
  const wrap = cv.parentElement;
  let tip = wrap.querySelector(".ctip");
  if (!tip) { tip = document.createElement("div"); tip.className = "ctip"; tip.hidden = true; wrap.appendChild(tip); }
  const color = opts.color || css("--chart") || "#3B8BEB";
  const ink = css("--text") || "#EDEEF2", dim = css("--dim") || "#6E7688", line = css("--line") || "#272C37";
  const font = "500 11px " + (css("--body") || "system-ui");
  const numFont = "600 11px " + (css("--display") || "system-ui");
  let geo = null;

  function draw(hover = -1) {
    const { ctx, w, h } = setup(cv);
    ctx.clearRect(0, 0, w, h);
    const padL = 38, padR = 14, padT = 14, padB = 24;
    const iw = w - padL - padR, ih = h - padT - padB;
    if (!points.length) {
      ctx.fillStyle = dim; ctx.font = font; ctx.textAlign = "center";
      ctx.fillText(opts.empty || "No data yet", w / 2, h / 2); return;
    }
    const ys = points.map(p => p.y);
    let min = Math.min(...ys), max = Math.max(...ys);
    const padY = (max - min) * 0.15 || Math.max(1, Math.abs(max) * 0.1);
    const { ticks, lo, hi } = niceTicks(min - padY, max + padY, 4);
    const X = i => padL + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
    const Y = v => padT + ih - ((v - lo) / (hi - lo)) * ih;

    // grid + y labels
    ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.fillStyle = dim; ctx.font = numFont; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (const t of ticks) { const y = Y(t); ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke(); ctx.fillText(opts.fmt ? opts.fmt(t) : String(t), padL - 8, y); }
    // x labels (first, last, and a middle if room)
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.font = font;
    const xi = points.length > 2 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : points.map((_, i) => i);
    for (const i of [...new Set(xi)]) ctx.fillText(points[i].x, X(i), h - 7);

    // area fill
    if (points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(X(0), Y(points[0].y));
      points.forEach((p, i) => ctx.lineTo(X(i), Y(p.y)));
      ctx.lineTo(X(points.length - 1), padT + ih); ctx.lineTo(X(0), padT + ih); ctx.closePath();
      ctx.fillStyle = color; ctx.globalAlpha = 0.10; ctx.fill(); ctx.globalAlpha = 1;
      // line
      ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(X(i), Y(p.y)) : ctx.moveTo(X(i), Y(p.y)));
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
    }
    // markers: endpoint emphasized, others small
    points.forEach((p, i) => {
      const last = i === points.length - 1, hov = i === hover;
      const r = last || hov ? 5 : 3.5;
      ctx.beginPath(); ctx.arc(X(i), Y(p.y), r, 0, Math.PI * 2);
      ctx.fillStyle = css("--card") || "#FFFFFF"; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke();
      if (last || hov) { ctx.beginPath(); ctx.arc(X(i), Y(p.y), 2, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
    });
    // endpoint direct label
    const lp = points[points.length - 1];
    ctx.font = numFont; ctx.fillStyle = ink; ctx.textAlign = "right"; ctx.textBaseline = "bottom";
    ctx.fillText(opts.fmt ? opts.fmt(lp.y) : String(lp.y), X(points.length - 1) - 8, Y(lp.y) - 6);
    // crosshair
    if (hover >= 0) {
      ctx.strokeStyle = dim; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(hover), padT); ctx.lineTo(X(hover), padT + ih); ctx.stroke(); ctx.setLineDash([]);
    }
    geo = { X, Y, padL, iw };
  }

  function onMove(e) {
    if (!geo || !points.length) return;
    const rect = cv.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    let best = 0, bd = Infinity;
    points.forEach((_, i) => { const d = Math.abs(geo.X(i) - x); if (d < bd) { bd = d; best = i; } });
    draw(best);
    const p = points[best];
    tip.innerHTML = "<b>" + (opts.fmt ? opts.fmt(p.y) : p.y) + "</b>" + (p.tip ? "<span>" + p.tip + "</span>" : "") + "<i>" + p.x + "</i>";
    tip.hidden = false;
    const tx = Math.min(Math.max(geo.X(best) - tip.offsetWidth / 2, 4), rect.width - tip.offsetWidth - 4);
    tip.style.left = tx + "px";
    tip.style.top = Math.max(2, geo.Y(p.y) - tip.offsetHeight - 14) + "px";
  }
  function onLeave() { tip.hidden = true; draw(-1); }
  cv.onpointermove = onMove; cv.onpointerdown = onMove; cv.onpointerleave = onLeave;
  cv.ontouchstart = e => { onMove(e); }; cv.ontouchmove = e => { onMove(e); e.preventDefault(); };
  draw(-1);
  return { redraw: () => draw(-1) };
}

/**
 * barChart(canvas, bars, opts) bars: [{x: label, y: number, tip?}]
 */
export function barChart(cv, bars, opts = {}) {
  const wrap = cv.parentElement;
  let tip = wrap.querySelector(".ctip");
  if (!tip) { tip = document.createElement("div"); tip.className = "ctip"; tip.hidden = true; wrap.appendChild(tip); }
  const color = opts.color || css("--chart") || "#3B8BEB";
  const ink = css("--text") || "#EDEEF2", dim = css("--dim") || "#6E7688", line = css("--line") || "#272C37";
  const font = "500 11px " + (css("--body") || "system-ui");
  const numFont = "600 11px " + (css("--display") || "system-ui");
  let rects = [];

  function draw(hover = -1) {
    const { ctx, w, h } = setup(cv);
    ctx.clearRect(0, 0, w, h);
    const padL = 38, padR = 10, padT = 14, padB = 24;
    const iw = w - padL - padR, ih = h - padT - padB;
    const max = Math.max(1, ...bars.map(b => b.y));
    const { ticks, hi } = niceTicks(0, max * 1.1, 3);
    const Y = v => padT + ih - (v / hi) * ih;
    ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.fillStyle = dim; ctx.font = numFont; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (const t of ticks) { const y = Y(t); ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke(); ctx.fillText(opts.fmt ? opts.fmt(t) : String(t), padL - 8, y); }
    const n = bars.length, gap = 2, slot = iw / n, bw = Math.min(28, slot - gap * 2);
    rects = [];
    bars.forEach((b, i) => {
      const x = padL + slot * i + (slot - bw) / 2, y = Y(b.y), bh = padT + ih - y;
      rects.push({ x, y, w: bw, h: bh });
      ctx.fillStyle = color; ctx.globalAlpha = hover < 0 || hover === i ? 1 : 0.45;
      if (bh > 0) { roundTop(ctx, x, y, bw, bh, 4); ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = dim; ctx.font = font; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText(b.x, x + bw / 2, h - 7);
      if (b.mark) { ctx.fillStyle = ink; ctx.font = numFont; ctx.textBaseline = "bottom"; ctx.fillText(b.mark, x + bw / 2, y - 4); }
    });
    // baseline
    ctx.strokeStyle = dim; ctx.beginPath(); ctx.moveTo(padL, padT + ih + 0.5); ctx.lineTo(w - padR, padT + ih + 0.5); ctx.stroke();
  }
  function roundTop(ctx, x, y, w, h, r) {
    r = Math.min(r, h, w / 2);
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h); ctx.closePath();
  }
  function onMove(e) {
    const rect = cv.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    let i = rects.findIndex(r => x >= r.x - 4 && x <= r.x + r.w + 4);
    if (i < 0) { onLeave(); return; }
    draw(i);
    const b = bars[i];
    tip.innerHTML = "<b>" + (opts.fmt ? opts.fmt(b.y) : b.y) + "</b>" + (b.tip ? "<span>" + b.tip + "</span>" : "") + "<i>" + b.x + "</i>";
    tip.hidden = false;
    const r = rects[i];
    tip.style.left = Math.min(Math.max(r.x + r.w / 2 - tip.offsetWidth / 2, 4), rect.width - tip.offsetWidth - 4) + "px";
    tip.style.top = Math.max(2, r.y - tip.offsetHeight - 10) + "px";
  }
  function onLeave() { tip.hidden = true; draw(-1); }
  cv.onpointermove = onMove; cv.onpointerdown = onMove; cv.onpointerleave = onLeave;
  cv.ontouchstart = onMove; cv.ontouchmove = e => { onMove(e); e.preventDefault(); };
  draw(-1);
  return { redraw: () => draw(-1) };
}
