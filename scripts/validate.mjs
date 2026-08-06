import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const publicRoot = path.join(root, 'public');
const infographicRoot = path.join(publicRoot, 'assets', 'infographics');
const sourceAssetRoot = path.join(infographicRoot, 'source-package', 'assets');
const webAssetRoot = path.join(infographicRoot, 'web');
const productionOrigin = 'https://minhos-wellbe-homecare-lecture.web.app/';
const ctaLabel = '浮腫レクチャーの導入を相談する';

const infographicNames = [
  'hero/hero-team-learning-wide',
  'problems/problem-visit-uncertainty',
  'problems/problem-manager-consultation-burden',
  'problems/problem-training-workload',
  'value/value-first-three-minutes-checklist',
  'value/value-consultation-branches',
  'value/value-sbar-report',
  'value/value-team-standardization',
  'theme/theme-edema-observation-wide',
  'final-cta/final-nurse-forward-wide',
  'offer/offer-scenario-90sec',
  'offer/offer-mini-lecture',
  'offer/offer-clinical-dialogue',
  'offer/offer-one-sheet',
  'offer/offer-branch-questions',
  'offer/offer-manager-kit',
  'offer/experience-one-sheet-preview-wide',
  'steps/step-consultation',
  'steps/step-team-learning',
  'steps/step-review-next-proposal'
];
const webPaths = infographicNames.map((name) => `/assets/infographics/web/${name}.webp`);
const required = [
  'firebase.json', '.firebaserc', 'public/index.html', 'public/css/tokens.css', 'public/css/styles.css',
  'public/js/config.js', 'public/js/app.js', 'public/js/analytics.js',
  'public/assets/logo/minhos-logo.png',
  'public/assets/logo/wellbe-official-logo.jpg',
  'public/assets/photos/creator-ito-kenta.webp', 'public/assets/photos/creator-nagai-yuki.webp',
  'public/assets/photos/ogp-edema-program.png',
  'public/assets/infographics/web/target/target-office-team-meeting-wide.png',
  'docs/infographics/PLACEMENT_GUIDE.md', 'docs/infographics/placement-map.csv',
  ...webPaths.map((asset) => `public${asset}`)
];

let failures = 0;
const fail = (message) => { console.error(`FAIL: ${message}`); failures += 1; };
for (const file of required) if (!fs.existsSync(path.join(root, file))) fail(`missing ${file}`);

const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolute = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(absolute) : [absolute];
});
const publicFiles = walk(publicRoot);
const hasLocalSourcePackage = fs.existsSync(sourceAssetRoot);
const sourcePngs = hasLocalSourcePackage ? walk(sourceAssetRoot).filter((file) => path.extname(file).toLowerCase() === '.png') : [];
const webWebps = walk(webAssetRoot).filter((file) => path.extname(file).toLowerCase() === '.webp');
if (hasLocalSourcePackage && sourcePngs.length !== 20) fail(`expected 20 local source PNGs, found ${sourcePngs.length}`);
if (webWebps.length !== 20) fail(`expected 20 WebPs, found ${webWebps.length}`);

const targetImage = path.join(webAssetRoot, 'target', 'target-office-team-meeting-wide.png');
const wellbeLogo = path.join(publicRoot, 'assets', 'logo', 'wellbe-official-logo.jpg');
try {
  const metadata = await sharp(targetImage).metadata();
  if (metadata.format !== 'png' || metadata.width !== 1672 || metadata.height !== 941) fail('target office image must be the supplied 1672 x 941 PNG');
} catch { fail('target office image cannot be decoded'); }
try {
  const metadata = await sharp(wellbeLogo).metadata();
  if (metadata.format !== 'jpeg' || metadata.width !== 2000 || metadata.height !== 1498) fail('official Well be logo must retain its supplied dimensions');
  const hash = createHash('sha256').update(fs.readFileSync(wellbeLogo)).digest('hex').toUpperCase();
  if (hash !== '60B9F3C7171E756920A47803F3B3FB17601644B62DBAFFCF73D25604A9C23045') fail('official Well be logo bytes were modified');
} catch { fail('official Well be logo cannot be decoded'); }

for (const [files, expectedFormat, label] of [[sourcePngs, 'png', 'source PNG'], [webWebps, 'webp', 'WebP']]) {
  for (const file of files) {
    const stat = fs.statSync(file);
    if (stat.size === 0) { fail(`${label} is empty: ${path.relative(root, file)}`); continue; }
    try {
      const metadata = await sharp(file).metadata();
      if (metadata.format !== expectedFormat || !metadata.width || !metadata.height) fail(`${label} has invalid metadata: ${path.relative(root, file)}`);
    } catch {
      fail(`${label} cannot be decoded: ${path.relative(root, file)}`);
    }
  }
}

const html = fs.readFileSync(path.join(publicRoot, 'index.html'), 'utf8');
const config = fs.readFileSync(path.join(publicRoot, 'js', 'config.js'), 'utf8');
const analytics = fs.readFileSync(path.join(publicRoot, 'js', 'analytics.js'), 'utf8');
const app = fs.readFileSync(path.join(publicRoot, 'js', 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(publicRoot, 'css', 'tokens.css'), 'utf8') + fs.readFileSync(path.join(publicRoot, 'css', 'styles.css'), 'utf8');

if ((html.match(/<h1\b/gi) || []).length !== 1) fail('index.html must contain exactly one H1');
if ((html.match(/<main\b/gi) || []).length !== 1) fail('index.html must contain exactly one main');
if (!/<a[^>]+class="[^"]*skip-link[^"]*"[^>]+href="#main-content"/.test(html)) fail('skip link is missing');
if (!styles.includes('prefers-reduced-motion')) fail('prefers-reduced-motion support is missing');
if (!styles.includes('forced-colors')) fail('forced-colors support is missing');

for (const expected of [
  `<link rel="canonical" href="${productionOrigin}">`,
  `<meta property="og:url" content="${productionOrigin}">`,
  `<meta property="og:image" content="${productionOrigin}assets/photos/ogp-edema-program.png">`,
  `canonicalOrigin: '${productionOrigin}'`
]) if (!(html + config).includes(expected)) fail(`missing production URL setting: ${expected}`);

for (const expected of ['lp_homecare_edema_program_2026', 'homecare_edema_program_2026', 'consult_edema_program', 'visual_reference_v2']) {
  if (!(html + config + analytics).includes(expected)) fail(`stable analytics ID missing: ${expected}`);
}

for (const name of ['伊藤 健大', '永井 友基']) {
  if ((html.match(new RegExp(name, 'g')) || []).length !== 2) fail(`${name} must appear exactly in heading and image alt`);
}
for (const image of ['creator-ito-kenta.webp', 'creator-nagai-yuki.webp']) {
  if ((html.match(new RegExp(image, 'g')) || []).length !== 1) fail(`${image} must appear once`);
}
for (const phrase of ['二人でつくる理由', '訪問したら、浮腫が強くなっていた', '導入相談フォームは現在準備中です。']) {
  if (!html.includes(phrase) && !app.includes(phrase)) fail(`required copy missing: ${phrase}`);
}

const ctaAnchors = [...html.matchAll(/<a\b[^>]*class="[^"]*js-application-link[^"]*"[^>]*>([^<]+)<\/a>/g)];
if (ctaAnchors.length !== 5) fail(`expected 5 primary CTA placements, found ${ctaAnchors.length}`);
for (const match of ctaAnchors) if (match[1].trim() !== ctaLabel) fail(`CTA label is not unified: ${match[1].trim()}`);

const faqButtons = [...html.matchAll(/<button\b[^>]*aria-expanded="false"[^>]*aria-controls="faq-panel-[1-5]"/g)];
if (faqButtons.length !== 5) fail(`expected 5 FAQ buttons with aria-expanded, found ${faqButtons.length}`);
if ((html.match(/class="faq-panel"[^>]*role="region"/g) || []).length !== 5) fail('every FAQ needs a labelled region panel');

const textExtensions = new Set(['.css', '.html', '.js', '.json', '.svg', '.txt', '.xml', '.md', '.csv']);
const forbiddenPatterns = [
  [/poc/i, 'internal experiment term'],
  [/共同開発パートナー/, 'internal partner term'],
  [/REPLACE_ME|REPLACE_WITH|example\.com|localhost/i, 'production placeholder'],
  [/data:image|base64/i, 'embedded image data']
];
for (const file of publicFiles.filter((candidate) => textExtensions.has(path.extname(candidate).toLowerCase()))) {
  const source = fs.readFileSync(file, 'utf8');
  for (const [pattern, label] of forbiddenPatterns) if (pattern.test(source)) fail(`${label} remains in ${path.relative(root, file)}`);
}

for (const jsFile of ['public/js/config.js', 'public/js/app.js', 'public/js/analytics.js', 'scripts/process-infographics.mjs']) {
  try { execFileSync(process.execPath, ['--check', path.join(root, jsFile)], { stdio: 'pipe' }); }
  catch { fail(`JavaScript syntax error: ${jsFile}`); }
}
try { JSON.parse(fs.readFileSync(path.join(publicRoot, 'schemas', 'analytics-event.schema.json'), 'utf8')); }
catch { fail('analytics-event.schema.json is invalid JSON'); }

for (const svg of publicFiles.filter((file) => path.extname(file).toLowerCase() === '.svg')) {
  const source = fs.readFileSync(svg, 'utf8');
  const relative = path.relative(root, svg);
  if (!/^<svg\b[^>]*viewBox="[^"]+"/i.test(source.trim())) fail(`${relative} has no root viewBox`);
  if (/<script\b|<foreignObject\b|(?:href|xlink:href)="https?:|data:image|base64/i.test(source)) fail(`${relative} contains forbidden SVG content`);
}

for (const htmlFile of publicFiles.filter((file) => path.extname(file).toLowerCase() === '.html')) {
  const source = fs.readFileSync(htmlFile, 'utf8');
  for (const match of source.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const reference = match[1];
    if (/^(?:https?:|#|mailto:|tel:)/i.test(reference)) continue;
    const clean = reference.split(/[?#]/)[0];
    const target = clean.startsWith('/') ? path.join(publicRoot, clean.slice(1)) : path.resolve(path.dirname(htmlFile), clean);
    if (!fs.existsSync(target)) fail(`broken local reference in ${path.relative(root, htmlFile)}: ${reference}`);
  }
}

for (const asset of webPaths) {
  const occurrences = (html.match(new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  const expected = asset.includes('/hero/') ? 2 : 1;
  if (occurrences !== expected) fail(`${asset} must appear ${expected} time(s), found ${occurrences}`);
}
if ((html.match(/\/assets\/logo\/wellbe-official-logo\.jpg/g) || []).length !== 2) fail('official Well be logo must appear in Header and Footer');
if (html.includes('wellbe-wordmark') || html.includes('<span>Well be</span>')) fail('provisional Well be wordmark remains visible');
if ((html.match(/\/assets\/infographics\/web\/target\/target-office-team-meeting-wide\.png/g) || []).length !== 1) fail('new target office image must appear once');
if (html.includes('target-small-team-meeting-wide.svg')) fail('old target illustration reference remains');
if (html.includes('/assets/infographics/source-package/')) fail('HTML must not reference source-package');

const imageTags = [...html.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);
for (const tag of imageTags) {
  if (!/\bwidth="\d+"/.test(tag) || !/\bheight="\d+"/.test(tag)) fail(`image lacks intrinsic dimensions: ${tag.slice(0, 100)}`);
  if (!/\balt="[^"]*"/.test(tag)) fail(`image lacks alt: ${tag.slice(0, 100)}`);
  if (/src="https?:|src="data:/i.test(tag)) fail('page image must be a local external file');
}
const heroTag = imageTags.find((tag) => tag.includes('/web/hero/hero-team-learning-wide.webp')) || '';
if (!/loading="eager"/.test(heroTag) || !/fetchpriority="high"/.test(heroTag)) fail('Hero LCP image must be eager and high priority');
if ((html.match(/loading="eager"/g) || []).length !== 1) fail('Hero must be the only eager image');
for (const tag of imageTags.filter((item) => item !== heroTag && !item.includes('class="site-brand__logo'))) {
  if (!/loading="lazy"/.test(tag)) fail(`below-fold image must be lazy-loaded: ${tag.slice(0, 100)}`);
}

const rootInfographicFiles = fs.readdirSync(infographicRoot, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name);
if (rootInfographicFiles.length !== 0) {
  fail(`unexpected legacy files remain in public/assets/infographics: ${rootInfographicFiles.join(', ')}`);
}

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
if (firebaseConfig.hosting?.public !== 'public' || firebaseConfig.hosting?.cleanUrls !== true || firebaseConfig.hosting?.trailingSlash !== false) fail('Firebase Hosting must use public, cleanUrls=true, trailingSlash=false');
if (!firebaseConfig.hosting?.ignore?.includes('assets/infographics/source-package/**')) fail('source-package must be excluded from Firebase Hosting');
const rc = JSON.parse(fs.readFileSync(path.join(root, '.firebaserc'), 'utf8'));
if (rc.projects?.default !== 'minhos-wellbe-homecare-lecture') fail('.firebaserc points to the wrong project');

if (failures) {
  console.error(`\nValidation failed with ${failures} issue(s).`);
  process.exit(1);
}
const sourcePackageStatus = hasLocalSourcePackage ? '20 local source PNGs' : 'local source package intentionally absent';
console.log(`Validation passed: ${sourcePackageStatus}, 20 optimized WebPs, supplied target PNG, official Well be logo, structure, accessibility, local assets, and Firebase scope are valid.`);
