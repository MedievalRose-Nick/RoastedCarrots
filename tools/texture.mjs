import fs from "node:fs"; import { readPng, png } from "./pngio.mjs";
const [src, outDir] = process.argv.slice(2);
const { w, h, px } = readPng(src);
const rnd = (i, s) => { let x = (i * 374761393 + s * 668265263) | 0; x = Math.imul(x ^ (x >>> 13), 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);

// carrot body = orange pixels; find its long axis (PCA) so shading can follow the carrot
const body = [];
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = (y * w + x) * 4; if (px[p + 3] && px[p] > px[p + 1]) body.push([x, y]); }
const mx = body.reduce((s, b) => s + b[0], 0) / body.length, my = body.reduce((s, b) => s + b[1], 0) / body.length;
let sxx = 0, syy = 0, sxy = 0; for (const [x, y] of body) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
const ang = .5 * Math.atan2(2 * sxy, sxx - syy); let ax = [Math.cos(ang), Math.sin(ang)];
if (ax[0] < 0) ax = [-ax[0], -ax[1]]; // points from tip (bottom-left) toward crown (top-right)
const U = ([x, y]) => (x - mx) * ax[0] + (y - my) * ax[1], V = ([x, y]) => -(x - mx) * ax[1] + (y - my) * ax[0];
const us = body.map(U), uMin = Math.min(...us), uMax = Math.max(...us);
const bin = {}; for (const b of body) { const k = Math.round(U(b)); (bin[k] ??= [99, -99]); bin[k][0] = Math.min(bin[k][0], V(b)); bin[k][1] = Math.max(bin[k][1], V(b)); }

const crown = body.reduce((a, b) => U(b) > U(a) ? b : a);
const CHAR = [38, 16, 8], CARAMEL = [150, 52, 12], GLOSS = [255, 226, 170], HERB = [64, 128, 36];
function make(o) {
  const out = Buffer.from(px);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, p = i * 4; if (!px[p + 3]) continue;
    let c = [px[p], px[p + 1], px[p + 2]];
    if (c[1] > c[0]) { // tops: wilted toward yellow-olive; trimmed ones lose their far leaves
      if (o.trim && Math.hypot(x - crown[0], y - crown[1]) > o.trim) { out[p + 3] = 0; continue; }
      const lum = (c[0] + c[1] + c[2]) / 3 / 255; c = o.tops.map(t => Math.min(255, t * (.35 + lum * 1.6)));
      if (rnd(i, 7) < o.topChar) c = mix(c, CHAR, .55);
    } else {
      const u = (U([x, y]) - uMin) / (uMax - uMin);                // 0 tip → 1 crown
      const [lo, hi] = bin[Math.round(U([x, y]))]; const v = hi > lo ? (V([x, y]) - lo) / (hi - lo) * 2 - 1 : 0; // -1..1 across
      c = [Math.min(255, c[0] * 1.08), c[1] * (1 - .2 * o.glaze), c[2] * (1 - .6 * o.glaze)];     // richer orange
      c = mix(c, CARAMEL, Math.max(0, v) * o.shade);                                              // caramel shadow side
      let ch = Math.max(0, (Math.abs(v) - .7) / .3) * o.edge + Math.max(0, 1 - u / .22) * o.tip;  // edges + root tip
      if (o.grill && ((U([x, y]) - uMin) % o.grill) < 1.2 && Math.abs(v) < .95) ch += .65;        // grill stripes
      if (rnd(i, 1) < o.spots) ch += .5;
      c = mix(c, CHAR, Math.min(.9, ch));
      if (v > -.7 && v < -.15 && u > .12 && u < .92 && rnd(Math.round(u * 20), 3) < .75) c = mix(c, GLOSS, o.gloss * (1 - Math.abs(v + .42) * 2.5)); // glaze streak
      if (o.herbs && Math.abs(v) < .6 && rnd(i, 4) < o.herbs) c = rnd(i, 5) < .5 ? HERB : [40, 90, 24];
    }
    out.set(c.map(Math.round), p);
  }
  return out;
}
const variants = {
  "1_glazed":        { glaze: .6, shade: .35, edge: .3,  tip: .35, gloss: .8, tops: [150, 160, 60], topChar: .05, spots: .02 },
  "2_charred_tip":   { glaze: .7, shade: .45, edge: .45, tip: .95, gloss: .5, tops: [170, 160, 70], topChar: .25, spots: .06, trim: 4.5 },
  "3_honey_glazed":  { glaze: 1,  shade: .6,  edge: .5,  tip: .5,  gloss: 1,  tops: [140, 130, 50], topChar: .15, spots: .03 },
  "4_herb_roasted":  { glaze: .6, shade: .4,  edge: .4,  tip: .5,  gloss: .6, tops: [150, 160, 60], topChar: .1,  spots: .04, herbs: .05 },
  "5_grill_marked":  { glaze: .7, shade: .4,  edge: .4,  tip: .6,  gloss: .5, tops: [160, 150, 60], topChar: .3,  spots: .02, grill: 4.5, trim: 4.5 },
};
const sheet = [];
for (const [n, o] of Object.entries(variants)) { const v = make(o); fs.writeFileSync(`${outDir}/${n}.png`, png(w, v, h)); sheet.push(v); }
const Z = 8, W = (sheet.length + 1) * (w * Z + 16), H = h * Z + 16, buf = Buffer.alloc(W * H * 4);
for (let k = 0; k < W * H; k++) buf.set([235, 230, 225, 255], k * 4);
[px, ...sheet].forEach((img, n) => { for (let y = 0; y < h * Z; y++) for (let x = 0; x < w * Z; x++) {
  const q = (((y / Z) | 0) * w + ((x / Z) | 0)) * 4; if (!img[q + 3]) continue;
  buf.set([img[q], img[q + 1], img[q + 2], 255], ((y + 8) * W + n * (w * Z + 16) + 8 + x) * 4);
} });
fs.writeFileSync(`${outDir}/sheet.png`, png(W, buf, H));
