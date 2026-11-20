import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { actionHref, consentKey, readReviewVoices, readSite, releaseIssues, root, sessionsAt, validateContent } from './site-content.mjs';
import { safePath, sha256, writeTree } from './site-files.mjs';

export const legalPages = {
  'privacy.html': ['プライバシーポリシー', '訪問看護教育サービスで取り扱う情報とアクセス解析について。'],
  'terms.html': ['利用条件', '訪問看護教育サービスと勉強会の利用条件について。'],
  'medical-disclaimer.html': ['医療教育と個別の診療について', '訪問看護の学習資料の位置づけと個別の診療について。']
};
export const studyPage = {
  filename: 'study/index.html',
  path: 'study/',
  slug: 'wellbe-study',
  registrationId: 'wellbe_study_next_register'
};
const studyLead = [
  '訪問先で何を見て、', 'どう考え、', '医師や事業所の管理者に', '何を伝えるか。',
  '訪問看護の事例を', '一緒に考える、', '個人で参加できる', '無料のオンライン勉強会です。'
];
const studyDescription = '訪問看護師が個人で参加できる無料のオンライン勉強会です。訪問看護の事例から臨床推論や医師・事業所の管理者への報告を学べます。開催予定とZoom勉強会の参加方法をご案内します。';
const stylesheetNames = ['tokens.css', 'styles.css', 'legal.css'];
const japaneseWeekday = new Intl.DateTimeFormat('ja-JP', { weekday: 'short', timeZone: 'Asia/Tokyo' });
const html = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const scriptJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
const fill = (name, slots) => fs.readFileSync(safePath(root, 'src/pages/' + name), 'utf8')
  .replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (!Object.hasOwn(slots, key)) throw new Error('Missing template value: ' + key);
    return slots[key];
  })
  .replace(/^[ \t]+(?=\r?$)/gm, '');

function dateParts(session) {
  const [year, month, day] = session.date.split('-').map(Number);
  const weekday = japaneseWeekday.format(new Date(session.date + 'T00:00:00+09:00'));
  const time = session.startTime ? ' ' + session.startTime + '〜（日本時間）' : '';
  return { year, month, day, weekday, label: year + '年' + month + '月' + day + '日（' + weekday + '）' + time };
}

function datetime(session) {
  return session.date + (session.startTime ? 'T' + session.startTime + ':00+09:00' : '');
}

function buildHead(site, filename, title, description, previewImage, mode) {
  const isStudy = filename === studyPage.filename;
  const isLanding = filename === 'index.html' || isStudy;
  const canonical = site.origin + site.basePath + (isLanding ? filename.slice(0, -'index.html'.length) : filename);
  const robots = mode === 'review' || !isLanding ? 'noindex, follow' : 'index, follow';
  const styles = isStudy
    ? ['css/tokens.css', studyPage.path + 'styles.css']
    : (isLanding ? stylesheetNames.slice(0, 2) : stylesheetNames).map((name) => 'css/' + name);
  const lines = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="referrer" content="no-referrer">',
    '<meta name="theme-color" content="' + (isStudy ? '#fbf8f0' : '#ffffff') + '">',
    '<title>' + html(title) + '</title>',
    '<meta name="description" content="' + html(description) + '">',
    '<meta name="robots" content="' + robots + '">',
    '<link rel="canonical" href="' + html(canonical) + '">',
    '<meta property="og:locale" content="ja_JP">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Well be × みんほす！">',
    '<meta property="og:title" content="' + html(title) + '">',
    '<meta property="og:description" content="' + html(description) + '">',
    '<meta property="og:url" content="' + html(canonical) + '">',
    '<meta property="og:image" content="' + html(site.origin + site.basePath + previewImage.src) + '">',
    '<meta property="og:image:width" content="' + previewImage.width + '">',
    '<meta property="og:image:height" content="' + previewImage.height + '">',
    '<meta property="og:image:alt" content="' + html(previewImage.alt) + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<link rel="icon" type="image/png" href="' + html(site.basePath + site.assets['minhos-logo'].src) + '">'
  ];
  for (const name of styles) {
    lines.push('<link rel="stylesheet" href="' + site.basePath + name + '">');
  }
  lines.push('<script type="application/ld+json">' + scriptJson({
    '@context': 'https://schema.org', '@type': 'WebPage', url: canonical, name: title, description, inLanguage: 'ja'
  }) + '</script>');
  return lines.join('\n  ');
}

function contact(site) {
  if (!site.operator?.contactUrl) return 'お問い合わせは準備中です。';
  return '<a href="' + html(site.operator.contactUrl) + '" rel="noreferrer">' + html(site.operator.name) + 'へのお問い合わせ</a>';
}

function actions(site, kind, placement, next, study = false) {
  const action = site.actions[kind];
  const href = actionHref(site, kind, next);
  const variant = kind === 'registration' ? ' action-register' : '';
  if (!href) {
    if (study) return '';
    const status = kind === 'registration' ? '個人参加の登録受付は準備中です' : '導入相談は受付準備中です';
    return '<p class="action-status' + variant + '">' + status + '</p>';
  }
  const occurrence = kind === 'registration' ? ' data-occurrence-id="' + html(next.id) + '"' : '';
  const target = kind === 'registration' ? 'lecture_registration' : 'consultation_form';
  const id = study ? studyPage.registrationId : action.id;
  const slug = study ? studyPage.slug : 'wellbe';
  const className = study ? 'study-registration' : 'action-link' + variant;
  return '<a class="' + className + '" href="' + html(href) + '" rel="noreferrer"' +
    ' data-cta="' + id + '" data-cta-loc="' + placement + '" data-target-type="' + target +
    '" data-lp-slug="' + slug + '"' + occurrence + '>' + html(action.label) + '</a>';
}

function nextSession(site, { next, today }) {
  const empty = '<div class="next-missing"' + (next ? ' hidden' : '') + '>' +
    '<h2 id="' + (next ? 'next-fallback-heading' : 'next-heading') + '">次回の勉強会</h2><p>次回の開催は決まり次第ご案内します。</p></div>';
  if (!next) return empty;
  const values = dateParts(next);
  return '<div class="next-event" data-event-date="' + next.date + '">' +
    '<time class="next-date" datetime="' + datetime(next) + '">' +
    '<span class="visually-hidden">' + values.label + '</span>' +
    '<span class="date-year" aria-hidden="true">' + values.year + '年</span>' +
    '<span class="date-number" aria-hidden="true">' + values.month + '<span>.</span>' + values.day + '</span>' +
    '<span class="date-time" aria-hidden="true">（' + values.weekday + '）' +
      (next.startTime ? next.startTime + '〜 <span>日本時間</span>' : '開始時刻は後日ご案内') + '</span>' +
    '</time><div class="next-copy"><h2 id="next-heading" class="next-heading" data-next-heading>' +
    (next.date === today ? '本日の勉強会' : '次回の勉強会') + '</h2>' +
    '<p class="next-topic">' + html(next.title) + '</p>' +
    '<p class="next-meta">オンライン<span aria-hidden="true">／</span><span class="visually-hidden">、</span>参加無料</p>' +
    '</div><div class="next-action">' + actions(site, 'registration', 'next', next) + '</div></div>' + empty;
}

function studyNextSession(site, { next, today }) {
  const registration = site.actions.registration;
  const changes = { postponed: '延期', cancelled: '中止' };
  const changed = !next && site.occurrences.find((item) =>
    item.id === registration.occurrenceId && item.public && item.date >= today && Object.hasOwn(changes, item.status));
  const notice = (changed ? '「' + changed.title + '」の開催は' + changes[changed.status] + 'となりました。' : '') +
    '次回の開催は決まり次第ご案内します。';
  const fallback = '<div class="study-shell next-missing"' + (next ? ' hidden' : '') + '>' +
    '<h2 id="next-fallback-heading">次回の勉強会</h2><p>' + html(notice) + '</p></div>';
  if (!next) return fallback;
  const date = dateParts(next);
  const heading = next.date === today ? '本日の勉強会' : '次回の勉強会';
  return '<div class="study-shell study-next-event" data-event-date="' + next.date + '">' +
    '<h2 id="next-heading" data-next-heading>' + heading + '</h2>' +
    '<time datetime="' + datetime(next) + '">' +
    '<span class="study-visually-hidden">' + html(date.label + (next.startTime ? '' : ' 開始時刻は後日ご案内します。')) + '</span>' +
    '<span aria-hidden="true" class="study-date-year">' + date.year + '年</span>' +
    '<span aria-hidden="true" class="study-date-number">' + date.month + '<span>.</span>' + date.day + '</span>' +
    '<span aria-hidden="true" class="study-date-time">（' + date.weekday + '）' + (next.startTime ? next.startTime + '〜' : '時刻は後日') + '</span>' +
    (next.startTime ? '<span aria-hidden="true" class="study-date-zone">日本時間</span>' : '') +
    '</time><p class="study-next-topic">' + html(next.title) + '</p>' +
    '<p class="study-next-format">無料・オンライン</p>' +
    (!actionHref(site, 'registration', next) ? '<p class="study-next-format">参加フォームは準備中です。</p>' : '') +
    '</div>' + fallback;
}

function pastSessions(held) {
  if (!held.length) return '<p class="no-history">開催後にこちらでご紹介します。</p>';
  return '<ul class="history-list">' + held.map((session) => {
    const date = dateParts(session);
    return '<li class="history-row"><div class="history-date">' +
      (session.number ? '<span>第' + session.number + '回</span>' : '') +
      '<time datetime="' + datetime(session) + '">' + date.label + '</time></div>' +
      '<div><h3>' + html(session.title) + '</h3>' +
      (session.summary ? '<p>' + html(session.summary) + '</p>' : '') + '</div></li>';
  }).join('\n      ') + '</ul>';
}

function testimonials(held, voices) {
  const sections = held.flatMap((session) => {
    const excerpts = voices.filter((voice) => voice.occurrenceId === session.id);
    if (!excerpts.length) return [];
    const [feature, ...others] = excerpts;
    const title = (session.number ? '第' + session.number + '回' : '') + '「' + session.title + '」に参加した方の声';
    const quote = (item, className) => '<blockquote class="' + className + '"><p>' + html(item.quote) + '</p></blockquote>';
    return ['<section class="voices-section" aria-labelledby="voices-' + session.id + '"><div class="shell voices-inner">' +
      '<h2 id="voices-' + session.id + '">' + html(title) + '</h2>' +
      (excerpts.some((item) => !item.approved) ? '<p class="review-note">掲載確認中の抜粋</p>' : '') +
      '<div class="voices-layout">' + quote(feature, 'quote-feature') +
      (others.length ? '<div class="quote-list">' + others.map((item) => quote(item, 'quote-short')).join('') + '</div>' : '') +
      '</div></div></section>'];
  });
  return sections.join('\n');
}

function footer(site, brand, year, extraLink = '') {
  const links = Object.entries(legalPages).map(([file, [label]]) =>
    '<a href="' + site.basePath + file + '">' + label + '</a>').join('\n      ');
  return '<footer class="site-footer"><div class="shell footer-inner"><div class="footer-brand">' + brand +
    (site.operator ? '<p>運営　' + html(site.operator.name) + '</p>' : '') +
    '<p>© ' + year + ' Well be × みんほす！</p></div>' +
    '<nav class="footer-links" aria-label="サイト情報">' + extraLink + links +
    '<a href="' + html(site.origin) + '/">みんほす！ホームページ</a>' +
    '<button class="text-button" type="button" id="cookie-settings" hidden>Cookie設定</button>' +
    (site.operator?.contactUrl ? contact(site) : '') + '</nav></div></footer>';
}

const consent = '<aside class="consent-notice" id="consent-notice" aria-label="アクセス解析" hidden>' +
  '<p>同意いただいた場合に、ページの利用状況を計測します。</p>' +
  '<button type="button" class="text-button" id="consent-open">Cookie設定を開く</button></aside>' +
  '<dialog class="cookie-dialog" id="cookie-dialog" aria-labelledby="cookie-title">' +
  '<h2 id="cookie-title">Cookie設定</h2><p id="cookie-description"></p>' +
  '<div class="dialog-actions"><button type="button" data-consent="accepted" hidden>アクセス解析に同意する</button>' +
  '<button type="button" data-consent="declined" hidden>同意しない</button>' +
  '<form method="dialog"><button type="submit" autofocus>閉じる</button></form></div></dialog>';

export function renderSite(site, { mode = 'review', now = new Date(), reviewVoices = [] } = {}) {
  validateContent(site);
  if (!['review', 'release'].includes(mode)) throw new Error('Unknown build mode.');
  if (mode === 'release') {
    const issues = releaseIssues(site, now);
    if (issues.length) throw new Error('公開確認待ち — ' + issues.join('、'));
  }
  const files = new Map();
  const basePath = site.basePath;
  const studyPath = basePath + studyPage.path;
  const prefix = basePath.slice(1);
  const put = (name, bytes) => {
    if (files.has(prefix + name)) throw new Error('Output collision: ' + name);
    files.set(prefix + name, bytes);
  };
  function assetSource(data, hash = null) {
    const bytes = fs.readFileSync(safePath(root, 'public/' + data.src));
    if (hash && sha256(bytes) !== hash) throw new Error('Asset hash does not match its original: ' + data.src);
    if (!files.has(prefix + data.src)) put(data.src, bytes);
    return basePath + data.src;
  }
  function image(id, { className = '', sizes = '100vw', priority = false, brandImage = false, alt } = {}) {
    const asset = site.assets[id];
    if (mode === 'release' && !asset.approved) throw new Error('Asset has not been approved: ' + id);
    const src = assetSource(asset, asset.sha256);
    let responsive = '';
    if (asset.small) {
      const small = assetSource(asset.small);
      responsive = ' srcset="' + small + ' ' + asset.small.width + 'w, ' + src + ' ' + asset.width + 'w" sizes="' + sizes + '"';
    }
    const loading = priority ? ' loading="eager" fetchpriority="high"' : brandImage ? '' : ' loading="lazy"';
    return '<img' + (className ? ' class="' + className + '"' : '') + ' src="' + src + '"' + responsive +
      ' width="' + asset.width + '" height="' + asset.height + '" alt="' + html(alt ?? asset.alt) + '" decoding="async"' + loading + '>';
  }
  function heroImage(artworkId, photoId, sizes, caption) {
    if (!site.assets[photoId]?.approved) return image(artworkId, { priority: true, sizes });
    const artwork = site.assets[artworkId];
    // Publish the artwork used by Open Graph and its existing responsive variant.
    assetSource(artwork, artwork.sha256);
    if (artwork.small) assetSource(artwork.small);
    return image(photoId, { priority: true, sizes }) + '<figcaption>' + html(caption) + '</figcaption>';
  }
  const brand = (where, href = basePath) => '<a class="brand" href="' + href + '" aria-label="Well be × みんほす！ サービス紹介">' +
    image('wellbe-logo', { className: 'brand-wellbe', brandImage: where === 'header' }) +
    '<span class="brand-times" aria-hidden="true">×</span>' +
    image('minhos-logo', { className: 'brand-minhos', brandImage: where === 'header' }) + '</a>';
  const sessions = sessionsAt(site, now);
  const footerHTML = footer(site, brand('footer'), sessions.today.slice(0, 4));
  const hosts = site.hosts.map((host) => '<article class="host">' +
    (host.photo ? image(host.photo, { className: 'host-photo', alt: '' }) : '') +
    '<div class="host-copy"><p class="host-organisation">' + html(host.organisation) + '</p>' +
    '<h3>' + html(host.name) + '</h3><p>' + html(host.bio) + '</p></div></article>').join('\n      ');
  const analyticsEnabled = mode === 'release' && site.analytics.enabled;
  const common = {
    BASE: basePath,
    BRAND: brand('header'),
    FOOTER: footerHTML,
    CONSENT: consent,
    FREE_NOTICE: html(site.freeNotice),
    CONTACT: contact(site),
    PRIVACY_ANALYTICS: analyticsEnabled
      ? '同意いただいた場合のみ、ページ閲覧と相談・参加登録の案内リンクの利用状況を計測します。ページのURLパラメータや申込内容は送信しません。設定はフッターの「Cookie設定」で変更できます。'
      : '現在、このページではアクセス解析を行っていません。'
  };
  const previewImage = site.assets['team-live'];
  const leadLines = site.description.split('\n');
  const learningFlow = fill('learning-flow.html', {}).trim();
  const businessVoices = [...site.voices];
  if (mode === 'review') {
    const approvedIds = new Set(site.voices.map(({ id }) => id));
    businessVoices.push(...reviewVoices.filter(({ id }) => !approvedIds.has(id)));
  }
  put('index.html', fill('index.html', {
    ...common,
    HEAD: buildHead(site, 'index.html', site.title, site.metaDescription ?? leadLines.join(' '), previewImage, mode),
    STUDY_PATH: studyPath,
    HEADING: site.heading.map((line) => '<span>' + html(line) + '</span>').join('\n          '),
    DESCRIPTION: leadLines.map(html).join('<br>\n'),
    CONSULT_HERO: actions(site, 'consultation', 'hero'),
    HERO_IMAGE: heroImage('team-live', 'wellbe-staff-photo',
      '(min-width: 1276px) 670px, (min-width: 860px) 54vw, (min-width: 700px) 44vw, calc(100vw - 40px)',
      'Well beの事業所で、画面を確認するスタッフ'),
    NEXT_SESSION: nextSession(site, sessions),
    LEARNING_FLOW: learningFlow,
    HOME_IMAGE: image('home-listening', { sizes: '(min-width: 1376px) 635px, (min-width: 700px) 47vw, 44vw' }),
    REPORT_IMAGE: image('physician-report', { sizes: '(min-width: 1376px) 541px, (min-width: 700px) 40vw, 44vw' }),
    EDUCATION_IMAGE: site.education.status === 'available'
      ? image(site.education.materialAsset)
      : image('new-staff', { sizes: '(min-width: 1276px) 600px, (min-width: 860px) 50vw, calc(100vw - 40px)' }),
    EDUCATION_TITLE: html(site.education.title),
    EDUCATION_DESCRIPTION: html(site.education.description),
    CONSULT_EDUCATION: actions(site, 'consultation', 'education'),
    PAST_SESSIONS: pastSessions(sessions.held),
    PARTICIPANT_VOICES: testimonials(sessions.held, businessVoices),
    HOSTS: hosts,
    FAQ_MATERIAL: site.education.status === 'available'
      ? '事業所での教育用教材については、導入相談の際にご案内します。'
      : '新入職者向けの教育セットは準備中です。提供内容が決まり次第ご案内します。',
    CONSULT_FINAL: actions(site, 'consultation', 'final')
  }));
  put(studyPage.filename, fill('study.html', {
    BASE: basePath,
    HEAD: buildHead(site, studyPage.filename, '訪問看護師のための無料オンライン勉強会｜Well be × みんほす！',
      studyDescription, site.assets['study-home-visit'], mode),
    DESCRIPTION: studyLead.map(html).join('<wbr>'),
    BRAND: brand('header', studyPath),
    FOOTER: footer(site, brand('footer', studyPath), sessions.today.slice(0, 4),
      '<a class="study-business-link" href="' + basePath + '">訪問看護ステーションの新人教育・導入相談</a>'),
    HERO_IMAGE: heroImage('study-home-visit', 'wellbe-visit-photo',
      '(min-width: 1380px) 650px, (min-width: 900px) 48vw, calc(100vw - 36px)',
      'Well beの訪問看護のひとコマ'),
    LEARNING_FLOW: learningFlow,
    ONLINE_IMAGE: image('study-online', { sizes: '(min-width: 1380px) 640px, (min-width: 900px) 49vw, calc(100vw - 36px)' }),
    REGISTER_HERO: actions(site, 'registration', 'hero', sessions.next, true),
    REGISTER_GUIDE: actions(site, 'registration', 'guide', sessions.next, true),
    NEXT_LABEL: sessions.next ? 'next-heading' : 'next-fallback-heading',
    NEXT_SESSION: studyNextSession(site, sessions),
    PAST_SESSIONS: pastSessions(sessions.held),
    PARTICIPANT_VOICES: testimonials(sessions.held, site.voices),
    HOSTS: hosts
  }));
  for (const [filename, [label, description]] of Object.entries(legalPages)) {
    put(filename, fill('legal-layout.html', {
      ...common,
      HEAD: buildHead(site, filename, label + '｜Well be × みんほす！', description, previewImage, mode),
      LEGAL_BODY: fill(filename, common)
    }));
  }
  for (const item of stylesheetNames.map((name) => 'css/' + name).concat(['js/app.js', 'js/analytics.js'])) {
    put(item, fs.readFileSync(safePath(path.join(root, 'public'), item)));
  }
  const studyStyles = studyPage.path + 'styles.css';
  put(studyStyles, fs.readFileSync(safePath(root, 'public/' + studyStyles)));
  put('js/config.js', 'export const config = Object.freeze(' + scriptJson({
    mode,
    origin: site.origin,
    basePath,
    serviceId: site.serviceId,
    consentKey,
    measurementId: analyticsEnabled ? site.analytics.measurementId : null,
    ctaLabels: Object.fromEntries(Object.values(site.actions).map(({ id, label }) => [id, label]))
  }) + ');\n');
  if (mode === 'release') {
    const entries = [basePath, studyPath].map((url) => '  <url><loc>' + html(site.origin + url) +
      '</loc><lastmod>' + site.confirmedOn + '</lastmod></url>');
    put('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + entries.join('\n') + '\n</urlset>\n');
  }
  return { site, mode, now, files };
}

export function buildSite({ mode = 'review', now = new Date() } = {}) {
  const site = readSite();
  const reviewVoices = mode === 'review' ? readReviewVoices() : [];
  return renderSite(site, { mode, now, reviewVoices });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const mode = process.argv.includes('--release') ? 'release' : 'review';
  const result = buildSite({ mode });
  const workspace = path.join(root, '.tmp');
  const tree = new Map([...result.files].map(([key, value]) => ['public/' + key, value]));
  tree.set('build.json', JSON.stringify({ mode, asOf: result.now.toISOString(), basePath: result.site.basePath }, null, 2) + '\n');
  const location = writeTree(workspace, mode === 'release' ? 'site-release' : 'site', tree);
  console.log('Built ' + result.files.size + ' ' + mode + ' files at ' + location);
}
