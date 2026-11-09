// Usage: node render.mjs [--stills f1,f2] <letters...>
import http from "http";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { createRequire } from "module";
const here = path.dirname(new URL(import.meta.url).pathname);
const dep = here;
const require_ = createRequire(path.join(dep, "package.json"));
const { chromium } = require_("playwright");
const ffmpegBin = require_("ffmpeg-static");

const args = process.argv.slice(2);
const poses = path.join(here, "out/poses");
let rest = args,
  stills = null;
if (rest[0] === "--stills") {
  stills = rest[1].split(",").map((s) => s.trim());
  rest = rest.slice(2);
}
const out = path.join(here, stills ? "out/stills" : "out/videos");
fs.mkdirSync(out, { recursive: true });

const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".glb": "model/gltf-binary",
  ".json": "application/json",
};
const roots = {
  "/three/": path.join(dep, "node_modules/three/"),
  "/hand/": path.join(dep, "node_modules/@webxr-input-profiles/assets/dist/profiles/generic-hand/"),
};
const srv = http.createServer((req, res) => {
  const u = req.url.split("?")[0];
  let f = u === "/" ? path.join(here, "page.html") : null;
  for (const [k, r] of Object.entries(roots))
    if (u.startsWith(k)) f = path.join(r, u.slice(k.length));
  if (!f || !fs.existsSync(f)) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { "content-type": mime[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const port = srv.address().port;

const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
function ff(args, input) {
  return new Promise((res, rej) => {
    const p = spawn(ffmpegBin, args, { stdio: [input ? "pipe" : "ignore", "ignore", "pipe"] });
    let e = "";
    p.stderr.on("data", (d) => (e = (e + d).slice(-1500)));
    p.on("close", (c) => (c ? rej(new Error(e)) : res()));
    if (input) input(p.stdin);
  });
}
for (const letter of rest) {
  const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
  page.on("pageerror", (e) => console.error("pageerror", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.error("console", m.text());
  });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction("window.ready === true", null, { timeout: 60000 });
  const tl = JSON.parse(fs.readFileSync(path.join(poses, `${letter}.json`)));
  const n = await page.evaluate((t) => window.setup(t), tl);
  const t0 = Date.now();
  if (stills) {
    for (const s of stills) {
      const i = Math.min(n - 1, Math.round(parseFloat(s) * (s.includes(".") ? n : 1)));
      await page.evaluate((k) => window.draw(k), i);
      await page.screenshot({
        path: path.join(out, `${letter}-${String(i).padStart(3, "0")}.png`),
      });
    }
  } else {
    const mp4 = path.join(out, `${letter}.mp4`);
    const frameDir = fs.mkdtempSync(path.join(out, `tmp-${letter}-`));
    for (let i = 0; i < n; i++) {
      await page.evaluate((k) => window.draw(k), i);
      await page.screenshot({ path: path.join(frameDir, `${String(i).padStart(4, "0")}.png`) });
    }
    const input = ["-y", "-framerate", "30", "-i", path.join(frameDir, "%04d.png")];
    await ff([
      ...input,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "20",
      "-preset",
      "slow",
      "-movflags",
      "+faststart",
      mp4,
    ]);
    await ff([
      ...input,
      "-c:v",
      "libvpx-vp9",
      "-b:v",
      "0",
      "-crf",
      "34",
      "-row-mt",
      "1",
      "-pix_fmt",
      "yuv420p",
      path.join(out, `${letter}.webm`),
    ]);
    fs.rmSync(frameDir, { recursive: true });
    console.log(letter, "mp4", (fs.statSync(mp4).size / 1024) | 0, "KB");
  }
  console.log(letter, n, "frames", Date.now() - t0, "ms");
  await page.close();
}
await browser.close();
srv.close();
