import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';

export const root = path.resolve(import.meta.dirname, '..');
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const validator = new Ajv({ allErrors: true });
const validSite = validator.compile(read('content/site.schema.json'));
const validVoice = validator.compile({ $ref: '#/definitions/voice', definitions: validSite.schema.definitions });

export const consentKey = 'wellbe_analytics_consent_v1';
export const supportedBasePath = '/wellbe/';
const jstOffsetMs = 9 * 60 * 60 * 1000;
const reservedEndpoints = new Set([
  'https://forms.gle/auGg94P3SyB6JTW56',
  'https://forms.gle/zxLSa1pdgJCzaJTx7',
  'https://docs.google.com/forms/d/e/1FAIpQLScPm_N79X7NAjD1vDwLU30t_0H6VfmiOVX5reyqTlF0EFe-Gg/viewform'
]);
const officialLogoHashes = {
  'wellbe-logo': '60b9f3c7171e756920a47803f3b3fb17601644b62dbaffcf73d25604a9c23045',
  'minhos-logo': 'c87558c347c01f5e37a018d50a3a0d1b12142f4086cd0100399dfe57d6ab3767'
};

export function dayInTokyo(now) {
  return new Date(now.valueOf() + jstOffsetMs).toISOString().slice(0, 10);
}

function validDate(value) {
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function publicHttps(value, origin) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash ||
        url.hostname === 'localhost' || !url.hostname.includes('.') || /^[0-9.]+$/.test(url.hostname)) return null;
    const normal = url.origin + decodeURIComponent(url.pathname).replace(/\/+$/, '');
    if (reservedEndpoints.has(normal) || url.hostname === 'zoom.us' || url.hostname.endsWith('.zoom.us') ||
        (url.origin === origin && !url.pathname.startsWith(supportedBasePath))) return null;
    return url.href.replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function sessionsAt(site, now) {
  const today = dayInTokyo(now);
  const visible = site.occurrences.filter((item) => item.public);
  const upcoming = visible.filter((item) => item.status === 'scheduled' && item.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '99:00').localeCompare(b.startTime ?? '99:00'));
  const held = visible.filter((item) => item.status === 'held' && item.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));
  return { today, next: upcoming[0], held };
}

export function actionHref(site, kind, next) {
  const action = site.actions[kind];
  if (!action.enabled || (kind === 'registration' && (!next || next.id !== action.occurrenceId))) return null;
  return publicHttps(action.url, site.origin);
}

export function validateContent(site) {
  if (!validSite(site)) {
    const details = validSite.errors.map(({ instancePath, message }) => (instancePath || '/') + ' ' + message);
    throw new Error('content/site.json: ' + details.join('; '));
  }
  const ids = new Set();
  const dates = [site.confirmedOn];
  for (const item of [...site.occurrences, ...site.voices, ...site.hosts]) {
    if (ids.has(item.id)) throw new Error('Duplicate content ID: ' + item.id);
    ids.add(item.id);
    if (item.confirmedOn) dates.push(item.confirmedOn, item.date);
  }
  if (!dates.every(validDate)) throw new Error('A calendar date is invalid.');
  for (const voice of site.voices) {
    if (!voice.approved || !site.occurrences.some((item) => item.id === voice.occurrenceId && item.public && item.status === 'held')) {
      throw new Error('Tracked quotes must be approved and refer to a public past session.');
    }
  }
  const registration = site.actions.registration;
  if (registration.occurrenceId && !site.occurrences.some((item) => item.id === registration.occurrenceId)) {
    throw new Error('Registration refers to an unknown occurrence.');
  }
  for (const [kind, action] of Object.entries(site.actions)) {
    if ((action.enabled && !action.url) || (action.url && !publicHttps(action.url, site.origin))) {
      throw new Error(kind + ' needs a dedicated public HTTPS URL.');
    }
  }
  const consult = publicHttps(site.actions.consultation.url, site.origin);
  if (consult && consult === publicHttps(registration.url, site.origin)) {
    throw new Error('The two actions must have distinct destinations.');
  }
  if (site.operator && site.operator.contactUrl !== null && !publicHttps(site.operator.contactUrl, site.origin)) {
    throw new Error('Invalid contact URL.');
  }
  if (site.analytics.enabled && !site.analytics.measurementId) throw new Error('GA4 is enabled without a measurement ID.');
  for (const host of site.hosts) {
    if (host.photo && !site.assets[host.photo]) throw new Error('Unknown host photo: ' + host.id);
  }
  const material = site.education.materialAsset;
  if ((site.education.status === 'available' && !material) || (material && !site.assets[material])) {
    throw new Error('The education material needs a declared asset.');
  }
  const sources = new Set();
  for (const asset of Object.values(site.assets)) {
    for (const item of [asset, asset.small].filter(Boolean)) {
      if (sources.has(item.src)) throw new Error('Duplicate asset: ' + item.src);
      sources.add(item.src);
    }
    if (asset.small && (asset.small.width >= asset.width || asset.small.width * asset.height !== asset.width * asset.small.height)) {
      throw new Error('Responsive image dimensions do not match: ' + asset.src);
    }
  }
  for (const [id, hash] of Object.entries(officialLogoHashes)) {
    if (site.assets[id].sha256 !== hash || !site.assets[id].approved) throw new Error('Use the supplied original logo: ' + id);
  }
  return site;
}

export function releaseIssues(site, now) {
  const { next } = sessionsAt(site, now);
  const issues = [];
  if (site.basePath !== supportedBasePath || site.origin !== 'https://minhos-management.jp') issues.push('公開先');
  if (!actionHref(site, 'consultation')) issues.push('事業所の導入相談窓口');
  if (next && !actionHref(site, 'registration', next)) issues.push('次回の個人参加登録窓口');
  if (!site.operator) issues.push('運営者');
  if (site.hosts.some((host) => !host.approved || (host.photo && !site.assets[host.photo].approved))) issues.push('主催者の紹介・写真の掲載確認');
  if (site.education.status === 'available' && !site.assets[site.education.materialAsset]?.approved) issues.push('教材の掲載確認');
  for (const key of ['team-live', 'home-listening', 'physician-report', 'new-staff']) {
    if (!site.assets[key].approved) issues.push('挿絵の掲載確認: ' + key);
  }
  return issues;
}

export function readSite() {
  return validateContent(read('content/site.json'));
}

export function readReviewVoices() {
  const local = '.tmp/content/review-voices.json';
  if (!fs.existsSync(path.join(root, local))) return [];
  const voices = read(local);
  if (!Array.isArray(voices) || voices.length > 100 || voices.some((voice) => !validVoice(voice) || voice.approved)) {
    throw new Error('Review quotes are limited to the local, unapproved excerpt records.');
  }
  return voices;
}
