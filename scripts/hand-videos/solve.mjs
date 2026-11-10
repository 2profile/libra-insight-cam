// Converts captured MediaPipe landmarks into per-frame bone poses for the WebXR generic hand.
// Usage: node solve.mjs <letters...>  (NOSPEC=1 skips the per-letter corrections)
import fs from "fs";
import path from "path";
import * as THREE from "three";
const here = path.dirname(new URL(import.meta.url).pathname);
const { Vector3: V, Quaternion: Q, Matrix4: M } = THREE;

const repo = path.resolve(here, "../..");
const glbPath = path.join(
  here,
  "node_modules/@webxr-input-profiles/assets/dist/profiles/generic-hand/right.glb",
);
const outDir = path.join(here, "out/poses");
const letters = process.argv.slice(2);
const ASPECT = 4 / 3; // best bone-length consistency over the dataset
const FPS = 30;
const DEG = Math.PI / 180;

// ---- rig ----
const b = fs.readFileSync(glbPath);
const gltf = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString());
const BONES = gltf.nodes.slice(0, 25).map((n) => n.name);
const idx = Object.fromEntries(BONES.map((n, i) => [n, i]));
const restP = gltf.nodes.slice(0, 25).map((n) => new V(...n.translation));
const restQ = gltf.nodes.slice(0, 25).map((n) => new Q(...n.rotation).normalize());
const FINGERS = [
  ["index", [5, 6, 7, 8]],
  ["middle", [9, 10, 11, 12]],
  ["ring", [13, 14, 15, 16]],
  ["pinky", [17, 18, 19, 20]],
];
const seg = (f, s) => idx[`${f}-${f === "thumb" ? "" : "finger-"}${s}`.replace("thumb-", "thumb-")];
const CHAIN = {};
for (const [f] of FINGERS)
  CHAIN[f] = [
    "metacarpal",
    "phalanx-proximal",
    "phalanx-intermediate",
    "phalanx-distal",
    "tip",
  ].map((s) => seg(f, s));
CHAIN.thumb = ["metacarpal", "phalanx-proximal", "phalanx-distal", "tip"].map((s) =>
  seg("thumb", s),
);
const PARENT = {};
for (const c of Object.values(CHAIN)) c.forEach((j, i) => (PARENT[j] = i ? c[i - 1] : idx.wrist));
const ORDER = [idx.wrist, ...Object.values(CHAIN).flat()];
const delta = (j) => restQ[PARENT[j]].clone().invert().multiply(restQ[j]);
const offset = (j) =>
  restP[j].clone().sub(restP[PARENT[j]]).applyQuaternion(restQ[PARENT[j]].clone().invert());

function palmFrame(w, i, m, p) {
  const t = i.clone().sub(p).normalize();
  const f0 = m.clone().sub(w).normalize();
  const n = t.clone().cross(f0).normalize();
  const f = n.clone().cross(t).normalize();
  return new M().makeBasis(t, f, n);
}
const prox = (f) => restP[CHAIN[f][1]];
const restFrame = palmFrame(restP[idx.wrist], prox("index"), prox("middle"), prox("pinky"));
const rigPalm = prox("index").distanceTo(prox("pinky"));

// sanity: local -Y must be the palm side (t x f) on this rig
{
  const n = new V().setFromMatrixColumn(restFrame, 2);
  const palm = new V(0, -1, 0).applyQuaternion(restQ[CHAIN.index[1]]);
  const along = new V(0, 0, -1).applyQuaternion(restQ[CHAIN.index[1]]);
  const dir = restP[CHAIN.index[2]].clone().sub(restP[CHAIN.index[1]]).normalize();
  console.log("rig check palm.n", palm.dot(n).toFixed(3), "bone.-Z", along.dot(dir).toFixed(3));
}

// ---- data ----
const toV = (l, flip) => new V((flip ? -1 : 1) * l.x * ASPECT, -l.y, -l.z * ASPECT);
function loadSamples(letter) {
  const dir = path.join(repo, "datasets/approved");
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    if (!f.startsWith(letter + "-") && !f.startsWith(letter + "2-")) continue;
    const d = JSON.parse(fs.readFileSync(path.join(dir, f)));
    for (const s of d.samples) if (s.label === letter) out.push({ ...s, file: f });
  }
  return out;
}
// flip decides chirality per handedness label; chosen by finger-curl test below
function framesOf(sample, flipLabel) {
  return sample.frames.map((fr) => ({
    t: fr.t,
    P: fr.landmarks.map((l) => toV(l, fr.handedness === flipLabel)),
  }));
}
const frameFromP = (P) => palmFrame(P[0], P[5], P[9], P[17]);
function curl(flipLabel, samples) {
  let c = 0,
    n = 0;
  for (const s of samples) {
    const fr = framesOf(s, flipLabel);
    const P = fr[fr.length >> 1].P;
    const nrm = new V().setFromMatrixColumn(frameFromP(P), 2);
    for (const [, [m, , , tip]] of FINGERS) {
      c += P[tip].clone().sub(P[m]).dot(nrm);
      n++;
    }
  }
  return c / n;
}
const curlSamples = loadSamples("S");
const c1 = curl("Left", curlSamples),
  c2 = curl("Right", curlSamples);
const FLIP = c1 > c2 ? "Left" : "Right";
console.log("curl flipLeft", c1.toFixed(3), "flipRight", c2.toFixed(3), "-> flip", FLIP);

// palm-local, palm-width-normalised points
function localize(P) {
  const F = frameFromP(P);
  const inv = F.clone().transpose();
  const s = P[5].distanceTo(P[17]) || 1e-4;
  return { F, L: P.map((p) => p.clone().sub(P[0]).applyMatrix4(inv).divideScalar(s)), s };
}

// ---- solver ----
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const rot = (ax, a) => new Q().setFromAxisAngle(ax, a);
const X = new V(1, 0, 0),
  Y = new V(0, 1, 0);
const stats = { clamped: 0, total: 0 };
function clampCount(x, a, b) {
  stats.total++;
  const c = clamp(x, a, b);
  if (c !== x) stats.clamped++;
  return c;
}
function axes(q) {
  return {
    s: new V(1, 0, 0).applyQuaternion(q),
    p: new V(0, -1, 0).applyQuaternion(q),
    a: new V(0, 0, -1).applyQuaternion(q),
  };
}
// Per-letter corrections for what monocular landmarks cannot see.
const SPEC = {
  L: { closed: ["middle", "ring", "pinky"] },
  // A: conferido com o cartão do alfabeto enviado pelo usuário: polegar estendido para cima, colado ao indicador
  A: {
    closed: ["index", "middle", "ring", "pinky"],
    thumb: "up",
    thumbOver: "index",
    thumbLift: 0.1,
    closedPhi: 92,
  },
  U: {
    closed: ["ring", "pinky"],
    thumb: "front",
    thumbOver: "ring",
    parallel: ["index", "middle"],
  },
  V: { closed: ["ring", "pinky"], thumb: "front", thumbOver: "ring" },
  // W: versão escolhida pelo usuário: mínimo fechado com o polegar por cima
  W: { closed: ["pinky"], thumb: "front", thumbOver: "pinky" },
  S: { closed: ["index", "middle", "ring", "pinky"], thumb: "front", thumbOver: "middle" },
  J: { closed: ["index", "middle", "ring"], thumb: "front", thumbOver: "middle", thumbLock: true },
  // B e C: conferidos com os cartões do alfabeto enviados pelo usuário
  B: {
    straight: ["index", "middle", "ring", "pinky"],
    parallel: ["index", "middle", "ring", "pinky"],
    converge: 0.32,
  },
  C: { parallel: ["index", "middle", "ring", "pinky"], converge: 0.2 },
  // F: conferido com a foto enviada pelo usuário: indicador em gancho tocando o meio do polegar,
  // polegar esticado para cima e para fora
  F: { thumbStraight: true },
};
const cpSeg = (p, a, b) => {
  const ab = b.clone().sub(a);
  const t = clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
  return a.clone().addScaledVector(ab, t);
};
const FINGER_R = 0.0105,
  THUMB_R = 0.0115;
// pushes thumb joints out of the closed fingers, toward the palm-normal side, keeping bone lengths
function resolveThumb(quats, nrm, closed, over, lift) {
  const pos = fk(quats, new V());
  const c = CHAIN.thumb;
  const P = c.map((j) => pos[j].clone());
  const lens = [1, 2, 3].map((i) => P[i].distanceTo(P[i - 1]));
  const caps = [];
  for (const f of closed) {
    const ch = CHAIN[f];
    for (let i = 1; i < 4; i++) caps.push([pos[ch[i]], pos[ch[i + 1]]]);
  }
  const R = FINGER_R + THUMB_R;
  let pushed = 0;
  if (over) {
    // FABRIK toward the middle of the folded finger, resting on top of it
    const ch = CHAIN[over];
    const goal = lift
      ? pos[ch[2]].clone().addScaledVector(nrm, R).add(lift)
      : pos[ch[2]].clone().lerp(pos[ch[3]], 0.5).addScaledVector(nrm, R);
    const base = P[0].clone();
    for (let it = 0; it < 25; it++) {
      P[3].copy(goal);
      for (let i = 2; i >= 0; i--) {
        const d = P[i]
          .clone()
          .sub(P[i + 1])
          .normalize();
        P[i] = P[i + 1].clone().addScaledVector(d, lens[i]);
      }
      P[0].copy(base);
      for (let i = 1; i <= 3; i++) {
        const d = P[i]
          .clone()
          .sub(P[i - 1])
          .normalize();
        P[i] = P[i - 1].clone().addScaledVector(d, lens[i - 1]);
      }
    }
  }
  for (let it = 0; it < 60; it++) {
    for (let i = 1; i <= 3; i++) {
      let worst = 0;
      for (let s = 0; s <= 4; s++) {
        const q = P[i - 1].clone().lerp(P[i], s / 4);
        for (const [a, b] of caps) {
          const cp = cpSeg(q, a, b);
          const off = q.clone().sub(cp);
          const h = off.dot(nrm);
          const lateral = off.clone().addScaledVector(nrm, -h).length();
          if (lateral < R) {
            const need = Math.sqrt(R * R - lateral * lateral) - h;
            if (need > worst) worst = need;
          }
        }
      }
      if (worst > 1e-5) {
        P[i].addScaledVector(nrm, worst * 0.6);
        if (i > 1) P[i - 1].addScaledVector(nrm, worst * 0.25);
        pushed++;
      }
    }
    for (let i = 1; i <= 3; i++) {
      const d = P[i]
        .clone()
        .sub(P[i - 1])
        .normalize();
      P[i] = P[i - 1].clone().addScaledVector(d, lens[i - 1]);
    }
  }
  return {
    dirs: [1, 2, 3].map((i) =>
      P[i]
        .clone()
        .sub(P[i - 1])
        .normalize(),
    ),
    pushed,
  };
}
function applyThumb(quats, dirs) {
  const c = CHAIN.thumb;
  let parent = quats[idx.wrist];
  dirs.forEach((d, i) => {
    const q0 = parent.clone().multiply(delta(c[i]));
    const cur = new V(0, 0, -1).applyQuaternion(q0);
    quats[c[i]] = new Q().setFromUnitVectors(cur, d).multiply(q0).normalize();
    parent = quats[c[i]];
  });
  quats[c[3]] = quats[c[2]].clone().multiply(delta(c[3]));
}
let currentSpec = {};
// T: world target points; returns world quats for all 25 bones
function solve(T) {
  const quats = Array(25);
  const Fp = frameFromP(T);
  const qPalm = new Q().setFromRotationMatrix(Fp.clone().multiply(restFrame.clone().transpose()));
  quats[idx.wrist] = qPalm.clone().multiply(restQ[idx.wrist]);
  const dir = (a, b) => T[b].clone().sub(T[a]).normalize();
  for (const [f, lm] of FINGERS) {
    const c = CHAIN[f];
    quats[c[0]] = qPalm.clone().multiply(restQ[c[0]]);
    // MCP: 2 DoF
    const q0 = quats[c[0]].clone().multiply(delta(c[1]));
    let e = axes(q0),
      d = dir(lm[0], lm[1]);
    if (currentSpec.parallel?.includes(f)) {
      // same MCP direction for the listed fingers, so they stay side by side
      d = currentSpec.parallel
        .reduce((sum, name) => {
          const m = FINGERS.find(([n]) => n === name)[1];
          return sum.add(dir(m[0], m[1]));
        }, new V())
        .normalize();
      // this rig's knuckles are wider apart than its fingers are thick: converge a little
      // toward the group's centre so neighbouring fingers touch
      const knuckle = (name) => restP[CHAIN[name][1]].clone().applyQuaternion(qPalm);
      const centre = currentSpec.parallel
        .reduce((sum, name) => sum.add(knuckle(name)), new V())
        .divideScalar(currentSpec.parallel.length);
      const len = restP[c[4]].distanceTo(restP[c[1]]);
      d.addScaledVector(centre.sub(knuckle(f)), (currentSpec.converge ?? 0) / len).normalize();
    }
    const isClosed = (currentSpec.closed ?? []).includes(f);
    let alpha = clampCount(Math.asin(clamp(d.dot(e.s), -1, 1)), -22 * DEG, 22 * DEG);
    let phi = clampCount(Math.atan2(d.dot(e.p), d.dot(e.a)), -18 * DEG, 100 * DEG);
    const isStraight = (currentSpec.straight ?? []).includes(f);
    if (isClosed) {
      alpha *= 0.2;
      phi = Math.max(phi, (currentSpec.closedPhi ?? 74) * DEG);
    }
    if (isStraight) phi = Math.min(phi, 4 * DEG);
    quats[c[1]] = q0.clone().multiply(rot(X, -phi)).multiply(rot(Y, -alpha));
    // PIP / DIP: hinge
    for (const [i, a, b, lim] of [
      [2, lm[1], lm[2], 118],
      [3, lm[2], lm[3], 85],
    ]) {
      const qi = quats[c[i - 1]].clone().multiply(delta(c[i]));
      e = axes(qi);
      d = dir(a, b);
      let fl = clampCount(Math.atan2(d.dot(e.p), d.dot(e.a)), -4 * DEG, lim * DEG);
      if (isClosed) fl = Math.max(fl, (i === 2 ? 98 : 52) * DEG);
      if (isStraight) fl = Math.min(fl, 4 * DEG);
      quats[c[i]] = qi.clone().multiply(rot(X, -fl));
    }
    quats[c[4]] = quats[c[3]].clone().multiply(delta(c[4]));
  }
  // thumb: direction matching (no reliable hinge on this joint)
  const c = CHAIN.thumb;
  let parent = qPalm.clone().multiply(restQ[idx.wrist]);
  [
    [1, 2],
    [2, 3],
    [3, 4],
  ].forEach(([a, b], i) => {
    const q0 = parent.clone().multiply(delta(c[i]));
    const cur = new V(0, 0, -1).applyQuaternion(q0);
    // thumbStraight: proximal and distal follow the MCP→tip line, so the thumb stays extended
    const target = currentSpec.thumbStraight && i > 0 ? dir(2, 4) : dir(a, b);
    const swing = new Q().setFromUnitVectors(cur, target);
    quats[c[i]] = swing.multiply(q0).normalize();
    parent = quats[c[i]];
  });
  quats[c[3]] = quats[c[2]].clone().multiply(delta(c[3]));
  if (["front", "side", "up"].includes(currentSpec.thumb)) {
    // front: over the folded fingers (palm normal); side/up: against the index edge of the fist
    const nrm = new V().setFromMatrixColumn(Fp, currentSpec.thumb === "front" ? 2 : 0);
    const lift = currentSpec.thumbLift
      ? new V().setFromMatrixColumn(Fp, 1).multiplyScalar(currentSpec.thumbLift)
      : null;
    const { dirs, pushed } = resolveThumb(
      quats,
      nrm,
      currentSpec.closed,
      currentSpec.thumbOver,
      lift,
    );
    stats.pushed = (stats.pushed ?? 0) + pushed;
    applyThumb(quats, dirs);
  }
  return quats;
}
function fk(quats, wrist) {
  const pos = Array(25);
  pos[idx.wrist] = wrist.clone();
  for (const j of ORDER.slice(1))
    pos[j] = pos[PARENT[j]].clone().add(offset(j).applyQuaternion(quats[PARENT[j]]));
  return pos;
}
// residual: angle between solved bones and observed directions
function residual(quats, T) {
  const pos = fk(quats, new V());
  const out = {};
  const pairs = {
    thumb: [1, 2, 3, 4],
    index: [5, 6, 7, 8],
    middle: [9, 10, 11, 12],
    ring: [13, 14, 15, 16],
    pinky: [17, 18, 19, 20],
  };
  for (const [f, lm] of Object.entries(pairs)) {
    const c = f === "thumb" ? CHAIN.thumb : CHAIN[f].slice(1);
    let sum = 0;
    for (let i = 0; i < 3; i++) {
      const a = pos[c[i + 1]].clone().sub(pos[c[i]]).normalize();
      const b = T[lm[i + 1]].clone().sub(T[lm[i]]).normalize();
      sum += Math.acos(clamp(a.dot(b), -1, 1)) / DEG;
    }
    out[f] = +(sum / 3).toFixed(1);
  }
  return out;
}

// neutral relaxed open hand: fingers up, palm to the viewer
function neutralPose() {
  const F = new M().makeBasis(new V(1, 0, 0), new V(0, 1, 0), new V(0, 0, 1));
  const qPalm = new Q().setFromRotationMatrix(F.multiply(restFrame.clone().transpose()));
  const quats = Array(25);
  quats[idx.wrist] = qPalm.clone().multiply(restQ[idx.wrist]);
  for (const [f] of FINGERS) {
    const c = CHAIN[f];
    quats[c[0]] = qPalm.clone().multiply(restQ[c[0]]);
    for (let i = 1; i < 4; i++) {
      quats[c[i]] = quats[c[i - 1]]
        .clone()
        .multiply(delta(c[i]))
        .multiply(rot(X, -(i === 1 ? 10 : 12) * DEG));
    }
    quats[c[4]] = quats[c[3]].clone().multiply(delta(c[4]));
  }
  const c = CHAIN.thumb;
  let parent = quats[idx.wrist];
  for (let i = 0; i < 4; i++) {
    quats[c[i]] =
      i === 0 ? qPalm.clone().multiply(restQ[c[0]]) : parent.clone().multiply(delta(c[i]));
    parent = quats[c[i]];
  }
  return quats;
}

// ---- representative poses ----
function flat(L) {
  return L.flatMap((p) => [p.x, p.y, p.z]);
}
const d2 = (a, b) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);
function meanFrame(mats) {
  const e = new Array(16).fill(0);
  for (const m of mats) m.elements.forEach((v, i) => (e[i] += v));
  const x = new V(e[0], e[1], e[2]).normalize();
  const y0 = new V(e[4], e[5], e[6]);
  const z = x.clone().cross(y0).normalize();
  return new M().makeBasis(x, z.clone().cross(x).normalize(), z);
}
function staticTarget(letter, K = 7) {
  const samples = loadSamples(letter).map((s) => {
    const fr = framesOf(s, FLIP).map((f) => localize(f.P));
    const L = fr[0].L.map((_, i) =>
      fr.reduce((acc, x) => acc.add(x.L[i]), new V()).divideScalar(fr.length),
    );
    const F = meanFrame(fr.map((x) => x.F));
    const orient = L.map((p) => p.clone().applyMatrix4(F));
    return {
      L,
      F,
      feat: flat(orient),
      who: s.file,
      score: s.frames.reduce((a, f) => a + f.score, 0) / s.frames.length,
    };
  });
  const mean = samples[0].feat.map(
    (_, i) => samples.reduce((a, s) => a + s.feat[i], 0) / samples.length,
  );
  const med = samples.reduce((b, s) => (d2(s.feat, mean) < d2(b.feat, mean) ? s : b));
  const near = [...samples].sort((a, b) => d2(a.feat, med.feat) - d2(b.feat, med.feat)).slice(0, K);
  const L = med.L.map((_, i) =>
    near.reduce((a, s) => a.add(s.L[i]), new V()).divideScalar(near.length),
  );
  const T = L.map((p) => p.clone().applyMatrix4(med.F));
  const who = [...new Set(near.map((s) => s.who))];
  console.log(letter, "samples", samples.length, "medoid", med.who, "blend of", who.join(" "));
  return T;
}

const gauss = (arr, sigma, mix) => {
  const R = Math.ceil(sigma * 3);
  return arr.map((_, i) => {
    let w = 0,
      acc = null;
    for (let k = -R; k <= R; k++) {
      const j = clamp(i + k, 0, arr.length - 1);
      const g = Math.exp(-(k * k) / (2 * sigma * sigma));
      acc = mix(acc, arr[j], g);
      w += g;
    }
    return { acc, w };
  });
};
const smoothV = (arr, sigma) =>
  gauss(arr, sigma, (a, v, g) => (a ?? new V()).addScaledVector(v, g)).map(({ acc, w }) =>
    acc.divideScalar(w),
  );

function motionTarget(letter) {
  const raw = loadSamples(letter).map((s) => ({ s, fr: framesOf(s, FLIP) }));
  const paths = raw.map(({ fr, s }) => {
    const span = 24; // 8 points of pinky/index path relative to start, normalised
    const tip = letter === "Z" ? 8 : 20;
    const scale = fr[0].P[5].distanceTo(fr[0].P[17]);
    const pts = [];
    for (let i = 0; i < span; i++) {
      const p = fr[Math.round((i * (fr.length - 1)) / (span - 1))].P[tip];
      pts.push((p.x - fr[0].P[tip].x) / scale, (p.y - fr[0].P[tip].y) / scale);
    }
    return { fr, s, pts };
  });
  const mean = paths[0].pts.map((_, i) => paths.reduce((a, p) => a + p.pts[i], 0) / paths.length);
  const med = paths.reduce((b, p) => (d2(p.pts, mean) < d2(b.pts, mean) ? p : b));
  console.log(letter, "motion samples", paths.length, "medoid", med.s.id);
  const frames = med.fr;
  const tip = letter === "Z" ? 8 : 20;
  const speed = frames.map((f, i) => (i ? f.P[tip].distanceTo(frames[i - 1].P[tip]) : 0));
  const sm = gauss(speed, 3, (a, v, g) => (a ?? 0) + v * g).map(({ acc, w }) => acc / w);
  const peak = Math.max(...sm);
  let a = sm.findIndex((v) => v > peak * 0.15),
    z = sm.length - 1 - [...sm].reverse().findIndex((v) => v > peak * 0.15);
  a = Math.max(0, a - 4);
  z = Math.min(sm.length - 1, z + 4);
  console.log(letter, "active frames", a, z, "of", frames.length, "peak", peak.toFixed(4));
  const cut = frames.slice(a, z + 1).map((f) => localize(f.P));
  const scale0 = cut[0].s;
  const Ws = smoothV(
    frames.slice(a, z + 1).map((f) => f.P[0].clone().sub(frames[a].P[0]).divideScalar(scale0)),
    2.5,
  );
  const Ls = cut[0].L.map((_, j) =>
    smoothV(
      cut.map((c) => c.L[j].clone()),
      2.5,
    ),
  );
  // smooth orientation through columns
  const col = (k) =>
    smoothV(
      cut.map((c) => new V().setFromMatrixColumn(c.F, k)),
      2.5,
    );
  const c0 = col(0),
    c1 = col(1);
  return cut.map((_, i) => {
    const t = c0[i].clone().normalize();
    const n = t.clone().cross(c1[i]).normalize();
    const F = new M().makeBasis(t, n.clone().cross(t).normalize(), n);
    return {
      T: Ls.map((L) => L[i].clone().applyMatrix4(F)),
      W: Ws[i].clone().multiplyScalar(rigPalm),
    };
  });
}

// ---- timelines ----
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
// Interpolate each bone relative to its parent: with a turned wrist, world-space slerp sends every
// finger along its own path and the hand splays open mid-transition.
function slerpAll(a, b, t) {
  const local = (w, j) => w[PARENT[j]].clone().invert().multiply(w[j]);
  const out = Array(25);
  out[idx.wrist] = a[idx.wrist].clone().slerp(b[idx.wrist], t);
  for (const j of ORDER.slice(1))
    out[j] = out[PARENT[j]]
      .clone()
      .multiply(local(a, j).slerp(local(b, j), t))
      .normalize();
  return out;
}
const ser = (quats, wrist, yaw) => ({
  q: quats.map((q) => q.toArray().map((v) => +v.toFixed(5))),
  p: fk(quats, wrist).map((p) => p.toArray().map((v) => +v.toFixed(5))),
  yaw: +yaw.toFixed(4),
});
const O = new V();
function staticTimeline(letter) {
  const T = staticTarget(letter);
  const pose = solve(T);
  console.log(letter, "residual deg", residual(pose, T));
  const N = neutralPose();
  const fr = [];
  const sec = (s) => Math.round(s * FPS);
  for (let i = 0; i < sec(0.35); i++) fr.push(ser(N, O, 0));
  for (let i = 0; i < sec(0.75); i++)
    fr.push(ser(slerpAll(N, pose, ease(i / (sec(0.75) - 1))), O, 0));
  for (let i = 0; i < sec(0.9); i++) fr.push(ser(pose, O, 0));
  const orb = sec(2.4);
  for (let i = 0; i < orb; i++)
    fr.push(ser(pose, O, Math.sin((i / (orb - 1)) * 2 * Math.PI) * 38 * DEG));
  for (let i = 0; i < sec(0.3); i++) fr.push(ser(pose, O, 0));
  for (let i = 0; i < sec(0.6); i++)
    fr.push(ser(slerpAll(pose, N, ease(i / (sec(0.6) - 1))), O, 0));
  return { letter, kind: "static", bones: BONES, frames: fr };
}
function motionTimeline(letter) {
  const m = motionTarget(letter);
  const poses = m.map((x) => solve(x.T));
  if (currentSpec.thumbLock) {
    // the handshape does not change during the gesture: hold one thumb pose relative to the palm
    const ref = poses[poses.length >> 1];
    const wr = ref[idx.wrist].clone().invert();
    const rel = CHAIN.thumb.map((j) => wr.clone().multiply(ref[j]));
    for (const p of poses)
      CHAIN.thumb.forEach((j, i) => (p[j] = p[idx.wrist].clone().multiply(rel[i])));
  }
  console.log(letter, "residual deg (first frame)", residual(poses[0], m[0].T));
  const N = neutralPose();
  const fr = [];
  const sec = (s) => Math.round(s * FPS);
  for (let i = 0; i < sec(0.35); i++) fr.push(ser(N, O, 0));
  const inN = sec(0.7);
  for (let i = 0; i < inN; i++) fr.push(ser(slerpAll(N, poses[0], ease(i / (inN - 1))), O, 0));
  for (let i = 0; i < sec(0.3); i++) fr.push(ser(poses[0], O, 0));
  poses.forEach((p, i) => fr.push(ser(p, m[i].W, 0)));
  const last = poses[poses.length - 1],
    W = m[m.length - 1].W;
  for (let i = 0; i < sec(0.6); i++) fr.push(ser(last, W, 0));
  const outN = sec(1.2);
  for (let i = 0; i < outN; i++) {
    const u = i / (outN - 1);
    const t = u * u * (3 - 2 * u);
    fr.push(ser(slerpAll(last, N, t), W.clone().lerp(O, t), 0));
  }
  return { letter, kind: "motion", bones: BONES, frames: fr };
}

fs.mkdirSync(outDir, { recursive: true });
for (const l of letters) {
  stats.clamped = stats.total = stats.pushed = 0;
  currentSpec = process.env.NOSPEC ? {} : (SPEC[l] ?? {});
  const tl = ["J", "Z"].includes(l) ? motionTimeline(l) : staticTimeline(l);
  console.log(
    l,
    "frames",
    tl.frames.length,
    "clamped",
    stats.clamped,
    "/",
    stats.total,
    "thumb pushes",
    stats.pushed,
  );
  fs.writeFileSync(path.join(outDir, `${l}.json`), JSON.stringify(tl));
}
