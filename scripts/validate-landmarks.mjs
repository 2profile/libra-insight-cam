import fs from "node:fs";
import path from "node:path";

const EXPECTED_FRAMES = 30;
const EXPECTED_LANDMARKS = 21;

function collectJsonFiles(targets) {
  const files = [];

  for (const target of targets) {
    if (!fs.existsSync(target)) {
      console.error(`missing: ${target}`);
      continue;
    }

    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(target)) {
        const file = path.join(target, entry);
        if (file.endsWith(".json")) files.push(file);
      }
    } else if (target.endsWith(".json")) {
      files.push(target);
    }
  }

  return files.sort();
}

function validateFile(file) {
  const errors = [];
  let data;

  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return { file, ok: false, errors: [`invalid json: ${error.message}`] };
  }

  if (!Array.isArray(data.samples)) errors.push("samples missing");
  if (!Array.isArray(data.labels)) errors.push("labels missing");

  const counts = {};
  for (const [sampleIndex, sample] of (data.samples ?? []).entries()) {
    counts[sample.label] = (counts[sample.label] ?? 0) + 1;

    if (!sample.label) errors.push(`sample ${sampleIndex}: label missing`);
    if (!Array.isArray(sample.frames)) {
      errors.push(`sample ${sampleIndex}: frames missing`);
      continue;
    }
    if (sample.frames.length !== EXPECTED_FRAMES) {
      errors.push(
        `sample ${sampleIndex}: expected ${EXPECTED_FRAMES} frames, got ${sample.frames.length}`,
      );
    }

    for (const [frameIndex, frame] of sample.frames.entries()) {
      if (!Array.isArray(frame.landmarks)) {
        errors.push(`sample ${sampleIndex}, frame ${frameIndex}: landmarks missing`);
        continue;
      }
      if (frame.landmarks.length !== EXPECTED_LANDMARKS) {
        errors.push(
          `sample ${sampleIndex}, frame ${frameIndex}: expected ${EXPECTED_LANDMARKS} landmarks, got ${frame.landmarks.length}`,
        );
      }
    }
  }

  return {
    file,
    ok: errors.length === 0,
    labels: Object.keys(counts).sort(),
    samples: data.samples?.length ?? 0,
    counts,
    errors,
  };
}

const targets = process.argv.slice(2);

if (!targets.length) {
  console.error("Usage: npm run validate:landmarks -- datasets/raw [file.json ...]");
  process.exit(1);
}

const files = collectJsonFiles(targets);

if (!files.length) {
  console.error("No JSON files found.");
  process.exit(1);
}

const results = files.map(validateFile);
let failed = 0;

for (const result of results) {
  if (result.ok) {
    console.log(`OK ${result.file}`);
    console.log(`  labels: ${result.labels.join(", ")}`);
    console.log(`  samples: ${result.samples}`);
    console.log(`  counts: ${JSON.stringify(result.counts)}`);
  } else {
    failed += 1;
    console.log(`FAIL ${result.file}`);
    for (const error of result.errors.slice(0, 10)) console.log(`  - ${error}`);
    if (result.errors.length > 10) console.log(`  - ... ${result.errors.length - 10} more`);
  }
}

console.log(`checked: ${results.length}`);
console.log(`failed: ${failed}`);

if (failed) process.exit(1);
