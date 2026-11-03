// Zips packs/ into addon/RoastedCarrots.mcaddon. `--deploy` also copies the packs into Minecraft's dev pack folders.
import fs from "node:fs"; import path from "node:path"; import zlib from "node:zlib";
const ROOT = path.resolve(import.meta.dirname, "..");
function zip(files) {
  const parts = [], central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const n = Buffer.from(name), z = zlib.deflateRawSync(data), crc = zlib.crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(33, 12); // 1980-01-01, the earliest valid DOS date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(z.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(n.length, 26);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt16LE(33, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(z.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(n.length, 28);
    dir.writeUInt32LE(offset, 42);
    parts.push(local, n, z);
    central.push(dir, n);
    offset += 30 + n.length + z.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}
const files = [];
const walk = (dir, prefix) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
  const p = path.join(dir, e.name), n = `${prefix}/${e.name}`;
  e.isDirectory() ? walk(p, n) : files.push({ name: n, data: fs.readFileSync(p) });
} };
for (const k of ["BP", "RP"]) walk(path.join(ROOT, "packs", k), `RoastedCarrots_${k}`);
fs.mkdirSync(path.join(ROOT, "addon"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "addon", "RoastedCarrots.mcaddon"), zip(files));
console.log("wrote addon/RoastedCarrots.mcaddon");

if (process.argv.includes("--deploy")) {
  const mojang = [
    path.join(process.env.APPDATA ?? "", "Minecraft Bedrock", "Users", "Shared", "games", "com.mojang"),
    path.join(process.env.LOCALAPPDATA ?? "", "Packages", "Microsoft.MinecraftUWP_8wekyb3d8bbwe", "LocalState", "games", "com.mojang"),
  ].find(fs.existsSync);
  if (!mojang) throw new Error("Couldn't find Minecraft's com.mojang folder");
  for (const [k, dir] of [["BP", "development_behavior_packs"], ["RP", "development_resource_packs"]]) {
    const dest = path.join(mojang, dir, `RoastedCarrots_${k}`);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(path.join(ROOT, "packs", k), dest, { recursive: true });
    console.log("deployed", dest);
  }
}
