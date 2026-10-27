/**
 * Рисует значок «Кодекса» (шестигранник и оранжевая грань) без внешних программ и пишет PNG/ICO:
 * public/icon-192.png, public/icon-512.png, assets/icon.ico и значки Android.
 * Запуск: node scripts/make-icons.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.join(__dirname, "..");
const INK = [0x16, 0x18, 0x19];
const ACCENT = [0xff, 0x4a, 0x14];
const PANEL = [0xf8, 0xf8, 0xf6];

const scalePoly = (pts, cx, cy, k) => pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
// знак «Грани d20» (LogoC, mC): шестигранник с линиями граней и оранжевой гранью
const HEX = [[32, 5], [54.5, 18], [54.5, 44], [32, 57], [9.5, 44], [9.5, 18]];
const OUTER = scalePoly(HEX, 32, 31, 1.0711); // обводка 3,2
const INNER = scalePoly(HEX, 32, 31, 0.9289);
const TRI = [[32, 15.4], [45.5, 38.8], [18.5, 38.8]];
const TRI_OUT = scalePoly(TRI, 32, 31.0, 1.1155); // обводка 1,8
const TRI_IN = scalePoly(TRI, 32, 31.0, 0.8845);
const LINES = [
  [[32, 15.4], [32, 5]], [[32, 15.4], [54.5, 18]], [[32, 15.4], [9.5, 18]],
  [[45.5, 38.8], [54.5, 18]], [[45.5, 38.8], [54.5, 44]], [[45.5, 38.8], [32, 57]],
  [[18.5, 38.8], [32, 57]], [[18.5, 38.8], [9.5, 44]], [[18.5, 38.8], [9.5, 18]],
];
const segPoly = ([p, q], w) => {
  const dx = q[0] - p[0], dy = q[1] - p[1];
  const len = Math.hypot(dx, dy);
  const nx = (-dy / len) * (w / 2), ny = (dx / len) * (w / 2);
  return [[p[0] + nx, p[1] + ny], [q[0] + nx, q[1] + ny], [q[0] - nx, q[1] - ny], [p[0] - nx, p[1] - ny]];
};
const LINE_POLYS = LINES.map((l) => segPoly(l, 1.8));

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** size: сторона в пикселях; mark: доля стороны, занятая знаком; bg: цвет подложки или null (прозрачно); radius: скругление подложки в долях. */
function render(size, { mark = 0.8, bg = PANEL, radius = 0.22 } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const S = 4;
  const k = (size * mark) / 64;
  const off = (size - 64 * k) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const fx = x + (sx + 0.5) / S;
          const fy = y + (sy + 0.5) / S;
          const ux = (fx - off) / k;
          const uy = (fy - off) / k;
          let col = null;
          if (inside(TRI_IN, ux, uy)) col = ACCENT;
          else if (inside(TRI_OUT, ux, uy) || (inside(OUTER, ux, uy) && !inside(INNER, ux, uy)) || LINE_POLYS.some((p) => inside(p, ux, uy))) col = INK;
          else if (bg) {
            const rr = radius * size;
            const cx = Math.min(Math.max(fx, rr), size - rr);
            const cy = Math.min(Math.max(fy, rr), size - rr);
            if ((fx - cx) ** 2 + (fy - cy) ** 2 <= rr * rr) col = bg;
          }
          if (col) {
            r += col[0]; g += col[1]; b += col[2]; a += 255;
          }
        }
      }
      const n = S * S;
      const i = (y * size + x) * 4;
      const cov = a / 255;
      px[i] = cov ? Math.round(r / cov) : 0;
      px[i + 1] = cov ? Math.round(g / cov) : 0;
      px[i + 2] = cov ? Math.round(b / cov) : 0;
      px[i + 3] = Math.round(a / n);
    }
  }
  return px;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};

function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head[8] = 8;
  head[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", head), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

function ico(sizes) {
  const images = sizes.map((s) => png(s, render(s)));
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach((img, i) => {
    const s = sizes[i];
    const e = 6 + i * 16;
    head[e] = s >= 256 ? 0 : s;
    head[e + 1] = s >= 256 ? 0 : s;
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(img.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += img.length;
  });
  return Buffer.concat([head, ...images]);
}

const write = (rel, data) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  console.log(rel);
};

write("public/icon-192.png", png(192, render(192)));
write("public/icon-512.png", png(512, render(512)));
const icon = ico([16, 32, 48, 64, 128, 256]);
write("assets/icon.ico", icon);
write("public/icon.ico", icon);

const res = "android/app/src/main/res";
const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [dpi, s] of Object.entries(legacy)) {
  write(`${res}/mipmap-${dpi}/ic_launcher.png`, png(s, render(s)));
  write(`${res}/mipmap-${dpi}/ic_launcher_round.png`, png(s, render(s, { radius: 0.5 })));
  // адаптивный значок: слой 108dp, знак внутри безопасной зоны (66dp)
  const f = Math.round((s * 108) / 48);
  write(`${res}/mipmap-${dpi}/ic_launcher_foreground.png`, png(f, render(f, { mark: 0.54, bg: null })));
}
