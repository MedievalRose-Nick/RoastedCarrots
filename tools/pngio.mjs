import fs from "node:fs"; import zlib from "node:zlib"; export { readPng, png };
function readPng(file) {
  const b = fs.readFileSync(file), idat = [];
  let p = 8, w, h, depth, type, plte, trns;
  while (p < b.length) {
    const len = b.readUInt32BE(p), name = b.toString("latin1", p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (name === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; }
    if (name === "PLTE") plte = d;
    if (name === "tRNS") trns = d;
    if (name === "IDAT") idat.push(d);
    p += len + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), channels = type === 6 ? 4 : 1;
  const bpp = Math.max(1, (channels * depth) >> 3), stride = Math.ceil((w * channels * depth) / 8), px = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)], line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, u = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      const pa = Math.abs(u - c), pb = Math.abs(a - c), pc = Math.abs(a + u - 2 * c);
      line[i] += [0, a, u, (a + u) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? u : c][filter];
    }
    prev = line;
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (type === 6) { line.copy(px, o, x * 4, x * 4 + 4); continue; }
      const bit = x * depth, n = (line[bit >> 3] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
      px[o] = plte[n * 3]; px[o + 1] = plte[n * 3 + 1]; px[o + 2] = plte[n * 3 + 2]; px[o + 3] = trns?.[n] ?? 255;
    }
  }
  return { w, h, px };
}

function png(w, px, h = w) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(zlib.crc32(body), body.length + 4);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6], 8); // 8-bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
