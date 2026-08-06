import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(root, 'public', 'assets', 'infographics', 'source-package', 'assets');
const outputRoot = path.join(root, 'public', 'assets', 'infographics', 'web');
const quality = 90;

const images = [
  ['hero/hero-team-learning-wide.png', 1600],
  ['problems/problem-visit-uncertainty.png', 900],
  ['problems/problem-manager-consultation-burden.png', 1000],
  ['problems/problem-training-workload.png', 1000],
  ['value/value-first-three-minutes-checklist.png', 1000],
  ['value/value-consultation-branches.png', 1000],
  ['value/value-sbar-report.png', 1000],
  ['value/value-team-standardization.png', 1000],
  ['theme/theme-edema-observation-wide.png', 1600],
  ['final-cta/final-nurse-forward-wide.png', 1600],
  ['offer/offer-scenario-90sec.png', 800],
  ['offer/offer-mini-lecture.png', 800],
  ['offer/offer-clinical-dialogue.png', 800],
  ['offer/offer-one-sheet.png', 800],
  ['offer/offer-branch-questions.png', 800],
  ['offer/offer-manager-kit.png', 800],
  ['offer/experience-one-sheet-preview-wide.png', 1600],
  ['steps/step-consultation.png', 1000],
  ['steps/step-team-learning.png', 1000],
  ['steps/step-review-next-proposal.png', 1000]
];

async function listPngs(directory) {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await listPngs(absolute));
    else if (path.extname(entry.name).toLowerCase() === '.png') result.push(absolute);
  }
  return result;
}

const sourcePngs = await listPngs(sourceRoot);
if (sourcePngs.length !== images.length) {
  throw new Error(`Expected ${images.length} source PNGs, found ${sourcePngs.length}.`);
}

let sourceBytes = 0;
let outputBytes = 0;
const rows = [];

for (const [relativeSource, maxWidth] of images) {
  const source = path.join(sourceRoot, ...relativeSource.split('/'));
  const relativeOutput = relativeSource.replace(/\.png$/i, '.webp');
  const output = path.join(outputRoot, ...relativeOutput.split('/'));
  await fs.access(source);
  await fs.mkdir(path.dirname(output), { recursive: true });

  const inputInfo = await sharp(source).metadata();
  await sharp(source)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true, fit: 'inside' })
    .webp({ quality, effort: 6, smartSubsample: true })
    .toFile(output);

  const outputInfo = await sharp(output).metadata();
  const inputStat = await fs.stat(source);
  const outputStat = await fs.stat(output);
  if (!outputInfo.width || !outputInfo.height || outputStat.size === 0) {
    throw new Error(`Invalid WebP output: ${relativeOutput}`);
  }
  if (outputInfo.width > inputInfo.width || outputInfo.height > inputInfo.height) {
    throw new Error(`Output was enlarged: ${relativeOutput}`);
  }
  sourceBytes += inputStat.size;
  outputBytes += outputStat.size;
  rows.push({
    file: relativeOutput,
    source: `${inputInfo.width}x${inputInfo.height}`,
    output: `${outputInfo.width}x${outputInfo.height}`,
    bytes: outputStat.size
  });
}

const reduction = ((1 - outputBytes / sourceBytes) * 100).toFixed(1);
console.table(rows);
console.log(`Converted ${rows.length} PNGs to WebP at quality ${quality}.`);
console.log(`Source: ${sourceBytes} bytes; WebP: ${outputBytes} bytes; reduction: ${reduction}%.`);
