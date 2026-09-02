// Generates the PWA icons (PNG) with no dependencies: a plate-blue barbell on graphite.
// Run: node tools/make-icons.js
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, paint) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = paint(x, y, size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const INK = [43, 92, 230], BLUE = [255, 255, 255], BLUE2 = [219, 231, 255], PLATE = [255, 255, 255];
const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// Barbell drawn in normalized coordinates (0..1). Rounded rects with soft edges.
function inRR(x, y, cx, cy, w, h, r) {
  const dx = Math.max(Math.abs(x - cx) - (w / 2 - r), 0), dy = Math.max(Math.abs(y - cy) - (h / 2 - r), 0);
  return Math.hypot(dx, dy) - r; // <=0 inside
}
function paintIcon(x, y, size, { maskable = false, rounded = true }) {
  const u = (x + 0.5) / size, v = (y + 0.5) / size;
  const px = 1 / size;
  // background: rounded square unless maskable (full bleed)
  let bgA = 1;
  if (!maskable && rounded) { const d = inRR(u, v, 0.5, 0.5, 1, 1, 0.22); bgA = Math.max(0, Math.min(1, -d / px)); if (bgA <= 0) return [0, 0, 0, 0]; }
  const grad = lerp(INK, [30, 73, 200], v);
  let col = grad;
  const s = maskable ? 0.72 : 0.84; // barbell scale
  const parts = [
    { cx: 0.5, cy: 0.5, w: 0.66 * s, h: 0.085 * s, r: 0.04 * s, c: PLATE },     // bar
    { cx: 0.5 - 0.235 * s, cy: 0.5, w: 0.085 * s, h: 0.46 * s, r: 0.03 * s, c: BLUE },  // inner plate L
    { cx: 0.5 + 0.235 * s, cy: 0.5, w: 0.085 * s, h: 0.46 * s, r: 0.03 * s, c: BLUE },  // inner plate R
    { cx: 0.5 - 0.335 * s, cy: 0.5, w: 0.07 * s, h: 0.34 * s, r: 0.025 * s, c: BLUE2 }, // outer plate L
    { cx: 0.5 + 0.335 * s, cy: 0.5, w: 0.07 * s, h: 0.34 * s, r: 0.025 * s, c: BLUE2 }, // outer plate R
  ];
  for (const p of parts) {
    const d = inRR(u, v, p.cx, p.cy, p.w, p.h, p.r);
    const a = Math.max(0, Math.min(1, -d / px));
    if (a > 0) col = lerp(col, p.c, a);
  }
  return [col[0], col[1], col[2], Math.round(bgA * 255)];
}

const out = path.join(__dirname, "..", "img");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "icon-192.png"), png(192, (x, y, s) => paintIcon(x, y, s, {})));
fs.writeFileSync(path.join(out, "icon-512.png"), png(512, (x, y, s) => paintIcon(x, y, s, {})));
fs.writeFileSync(path.join(out, "icon-512-maskable.png"), png(512, (x, y, s) => paintIcon(x, y, s, { maskable: true })));
fs.writeFileSync(path.join(out, "apple-touch-icon.png"), png(180, (x, y, s) => paintIcon(x, y, s, { maskable: true })));
console.log("icons written to", out);
