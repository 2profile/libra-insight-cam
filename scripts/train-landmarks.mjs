import fs from "node:fs";
import path from "node:path";

const SAMPLE_FRAMES = 30;
const OUTPUT_PATH = "public/models/landmark-centroids.json";

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function normalizeLandmarks(landmarks) {
  const wrist = landmarks[0];
  const scale = Math.max(distance(landmarks[5], landmarks[17]), 0.0001);
  return landmarks.flatMap((point) => [
    (point.x - wrist.x) / scale,
    (point.y - wrist.y) / scale,
    (point.z - wrist.z) / scale,
  ]);
}

function sampleToFeatures(sample) {
  const frames = sample.frames.slice(0, SAMPLE_FRAMES);
  const vectors = frames.map((frame) => normalizeLandmarks(frame.landmarks));
  const size = vectors[0].length;
  return Array.from({ length: size }, (_, index) => {
    const total = vectors.reduce((sum, vector) => sum + vector[index], 0);
    return total / vectors.length;
  });
}

function squaredDistance(a, b) {
  return a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0);
}

function predict(model, features) {
  const scores = model.labels.map((label) => ({
    label,
    distance: squaredDistance(features, model.centroids[label]),
  }));
  scores.sort((a, b) => a.distance - b.distance);
  return scores[0].label;
}

function meanVector(vectors) {
  const size = vectors[0].length;
  return Array.from({ length: size }, (_, index) => {
    const total = vectors.reduce((sum, vector) => sum + vector[index], 0);
    return total / vectors.length;
  });
}

function loadSamples(files) {
  return files.flatMap((file) => {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return data.samples.map((sample) => ({
      ...sample,
      sourceFile: file,
      features: sampleToFeatures(sample),
    }));
  });
}

function groupByLabel(samples) {
  const groups = new Map();
  for (const sample of samples) {
    const group = groups.get(sample.label) ?? [];
    group.push(sample);
    groups.set(sample.label, group);
  }
  return groups;
}

function splitSamples(samples) {
  const byLabel = groupByLabel(samples);
  const train = [];
  const test = [];

  for (const group of byLabel.values()) {
    group.forEach((sample, index) => {
      if (index % 5 === 0) test.push(sample);
      else train.push(sample);
    });
  }

  return { train, test };
}

function trainCentroids(samples) {
  const byLabel = groupByLabel(samples);
  const labels = [...byLabel.keys()].sort();
  const centroids = Object.fromEntries(
    labels.map((label) => [label, meanVector(byLabel.get(label).map((sample) => sample.features))]),
  );

  return {
    kind: "centroid-landmark-classifier",
    version: 1,
    createdAt: new Date().toISOString(),
    frameCount: SAMPLE_FRAMES,
    featureCount: labels.length ? centroids[labels[0]].length : 0,
    labels,
    centroids,
  };
}

function evaluate(model, samples) {
  const matrix = Object.fromEntries(
    model.labels.map((actual) => [
      actual,
      Object.fromEntries(model.labels.map((predicted) => [predicted, 0])),
    ]),
  );

  let correct = 0;
  for (const sample of samples) {
    const predicted = predict(model, sample.features);
    matrix[sample.label][predicted] += 1;
    if (predicted === sample.label) correct += 1;
  }

  return {
    total: samples.length,
    correct,
    accuracy: samples.length ? correct / samples.length : 0,
    matrix,
  };
}

const files = process.argv.slice(2);

if (files.length < 2) {
  console.error("Usage: npm run train:landmarks -- dataset-a.json dataset-b.json [...]");
  process.exit(1);
}

const samples = loadSamples(files);
const labels = new Set(samples.map((sample) => sample.label));

if (labels.size < 2) {
  console.error("Need at least 2 labels to train a classifier.");
  process.exit(1);
}

const { train, test } = splitSamples(samples);
const model = trainCentroids(train);
const evaluation = evaluate(model, test);

model.metrics = {
  trainSamples: train.length,
  testSamples: test.length,
  testAccuracy: evaluation.accuracy,
  confusionMatrix: evaluation.matrix,
};

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(model, null, 2)}\n`);

console.log(`labels: ${model.labels.join(", ")}`);
console.log(`train: ${train.length}`);
console.log(`test: ${test.length}`);
console.log(`accuracy: ${(evaluation.accuracy * 100).toFixed(1)}%`);
console.log(`model: ${OUTPUT_PATH}`);
