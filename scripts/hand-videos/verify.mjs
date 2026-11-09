// Runs MediaPipe + the project's classifier over rendered frames.
// Usage: node verify.mjs <letters...>
import http from "http";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
const here = path.dirname(new URL(import.meta.url).pathname);
const dep = here,
  mpd = path.join(here, "node_modules/@mediapipe/tasks-vision");
const require_ = createRequire(path.join(dep, "package.json"));
const { chromium } = require_("playwright");
const repo = path.resolve(here, "../.."),
  poses = path.join(here, "out/poses");
const letters = process.argv.slice(2);
const modelDir = path.join(here, "out/model"),
  modelFile = path.join(modelDir, "hand_landmarker.task");
if (!fs.existsSync(modelFile)) {
  fs.mkdirSync(modelDir, { recursive: true });
  const r = await fetch(
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  );
  if (!r.ok) throw new Error("model download failed: " + r.status);
  fs.writeFileSync(modelFile, Buffer.from(await r.arrayBuffer()));
}
const { framesToFeatures } = await import(path.join(repo, "src/lib/landmark-features.mjs"));
const model = JSON.parse(fs.readFileSync(path.join(repo, "public/models/landmark-centroids.json")));
const predict = (feat) => {
  const n = model.prototypes
    .map((p) => ({ l: p.label, d: p.features.reduce((s, v, i) => s + (v - feat[i]) ** 2, 0) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, model.k ?? 3);
  const v = new Map();
  for (const x of n) v.set(x.l, (v.get(x.l) ?? 0) + 1 / (x.d + 1e-9));
  const r = [...v.entries()].sort((a, b) => b[1] - a[1]);
  const t = r.reduce((s, [, x]) => s + x, 0);
  return (
    r.map(([l, x]) => `${l} ${((x / t) * 100).toFixed(0)}%`).join(", ") +
    ` | d=${Math.sqrt(n[0].d).toFixed(2)}`
  );
};
const roots = {
  "/three/": path.join(dep, "node_modules/three/"),
  "/hand/": path.join(dep, "node_modules/@webxr-input-profiles/assets/dist/profiles/generic-hand/"),
  "/mp/": mpd + "/",
  "/model/": modelDir + "/",
};
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".wasm": "application/wasm",
};
const srv = http.createServer((q, a) => {
  const u = q.url.split("?")[0];
  let f =
    u === "/" ? path.join(here, "page.html") : u === "/d" ? path.join(here, "detect.html") : null;
  for (const [k, r] of Object.entries(roots))
    if (u.startsWith(k)) f = path.join(r, u.slice(k.length));
  if (!f || !fs.existsSync(f)) {
    a.writeHead(404);
    return a.end();
  }
  a.writeHead(200, { "content-type": mime[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(a);
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
const det = await browser.newPage({ viewport: { width: 200, height: 200 } });
det.on("pageerror", (e) => console.error("det", e.message));
await det.goto(`http://127.0.0.1:${port}/d`);
await det.waitForFunction("window.ok===true", null, { timeout: 120000 });
for (const letter of letters) {
  const tl = JSON.parse(fs.readFileSync(path.join(poses, `${letter}.json`)));
  const p = await browser.newPage({ viewport: { width: 640, height: 640 } });
  await p.goto(`http://127.0.0.1:${port}/`);
  await p.waitForFunction("window.ready===true");
  await p.evaluate((t) => window.setup(t), tl);
  const shoot = async (i) => {
    await p.evaluate((k) => window.draw(k), i);
    const b = await p.screenshot({ type: "jpeg", quality: 92 });
    return det.evaluate((u) => window.detect(u), "data:image/jpeg;base64," + b.toString("base64"));
  };
  let idxs;
  if (tl.kind === "static") idxs = [46, 52, 58];
  else {
    const m = tl.frames.findIndex(
      (f, i) => i > 31 && f.p[0].some((v, k) => Math.abs(v - tl.frames[31].p[0][k]) > 1e-4),
    );
    const end = tl.frames.length - 36 - 18;
    idxs = [];
    for (let i = Math.max(31, m - 2); i < end; i++) idxs.push(i);
  }
  const frames = [];
  let miss = 0;
  for (const i of idxs) {
    const r = await shoot(i);
    if (r) frames.push({ landmarks: r.lm, handedness: r.h });
    else miss++;
  }
  if (!frames.length) {
    console.log(letter, "MEDIAPIPE NO HAND, of", idxs.length);
    await p.close();
    continue;
  }
  const pad =
    tl.kind === "static"
      ? Array.from({ length: 90 }, () => frames[frames.length >> 1])
      : frames.slice(0, 90);
  console.log(
    letter,
    "detected",
    frames.length,
    "/",
    idxs.length,
    "hand",
    frames[0].handedness,
    "->",
    predict(framesToFeatures(pad)),
  );
  await p.close();
}
await browser.close();
srv.close();
