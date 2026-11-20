import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { renderSite } from './build-site.mjs';
import { actionHref, dayInTokyo, publicHttps, readSite, sessionsAt, validateContent } from './site-content.mjs';
import { safePath } from './site-files.mjs';
import { createTracker, clickParams } from '../public/js/analytics.js';

const asOf = new Date('2026-11-20T01:00:00Z');
const startOfEventDay = new Date('2026-12-22T15:00:00Z');
const endOfEventDay = new Date('2026-12-23T15:00:00Z');
const dateOnly = new Date('2026-12-22T14:59:59Z');

test('JST selects the next public scheduled session and keeps a date-only past session', () => {
  const site = localSource();
  const sessions = sessionsAt(site, dateOnly);
  assert.equal(sessions.today, '2026-12-22');
  assert.equal(sessions.next.id, 'clinical-reasoning-intro');
  assert.equal(sessions.held[0].startTime, null);
  assert.equal(dayInTokyo(startOfEventDay), '2026-12-23');
  const onDay = renderSite(site, { now: startOfEventDay }).files.get('wellbe/index.html');
  assert.match(onDay, /本日の勉強会/);
  assert.match(onDay, /datetime="2026-12-23T21:00:00\+09:00"/);
  assert.match(onDay, /datetime="2026-10-15"/);
  const study = renderSite(actionsForFixture(site), { now: startOfEventDay }).files.get('wellbe/study/index.html');
  assert.match(study, /data-next-heading>本日の勉強会/);
  assert.match(study, /datetime="2026-12-23T21:00:00\+09:00"/);
  assert.equal([...study.matchAll(/data-cta="wellbe_study_next_register" data-cta-loc="([^"]+)"/g)].map((match) => match[1]).join(','), 'hero,guide');
  assert.doesNotMatch(study, /data-cta="wellbe_consult"/);
});

test('an elapsed scheduled session stays out of history and registration', () => {
  const site = actionsForFixture(localSource());
  const { next, held, today } = sessionsAt(site, endOfEventDay);
  assert.equal(today, '2026-12-24');
  assert.equal(next, undefined);
  assert.deepEqual(held.map((item) => item.id), ['edema-first']);
  const { files } = renderSite(site, { now: endOfEventDay });
  const output = files.get('wellbe/index.html');
  assert.match(output, /次回の開催は決まり次第ご案内します/);
  assert.doesNotMatch(output, /data-cta="wellbe_next_register"/);
  assert.doesNotMatch(output, /臨床推論入門/);
  const study = files.get('wellbe/study/index.html');
  assert.match(study, /次回の開催は決まり次第ご案内します/);
  assert.doesNotMatch(study, /data-cta="wellbe_study_next_register"|臨床推論入門/);
});

test('postponed, cancelled and private events never become the next event', () => {
  const site = actionsForFixture(localSource());
  const next = sessionsAt(site, asOf).next;
  next.status = 'postponed';
  const study = renderSite(site, { now: asOf }).files.get('wellbe/study/index.html');
  assert.match(study, /の開催は延期となりました。/);
  assert.doesNotMatch(study, /data-cta="wellbe_study_next_register"/);
  site.occurrences.push(
    { ...next, id: 'cancelled', status: 'cancelled' },
    { ...next, id: 'private', status: 'scheduled', public: false },
    { ...next, id: 'later', date: '2027-01-25', status: 'scheduled' },
    { ...next, id: 'earlier', date: '2027-01-24', status: 'scheduled' }
  );
  const upcoming = sessionsAt(site, asOf).next;
  assert.equal(upcoming.id, 'earlier');
  assert.equal(actionHref(site, 'registration', upcoming), null);
});

test('unknown forms have no links or CTA parameters and site cannot release', () => {
  const site = localSource();
  const review = renderSite(site, { now: asOf });
  assert.match(review.files.get('wellbe/index.html'), /導入相談は受付準備中です/);
  assert.match(review.files.get('wellbe/index.html'), /個人参加の登録受付は準備中です/);
  assert.doesNotMatch(review.files.get('wellbe/index.html'), /data-cta="/);
  assert.match(review.files.get('wellbe/js/config.js'), /"measurementId":null/);
  assert.throws(() => renderSite(site, { mode: 'release', now: asOf }), /公開確認待ち/);
  assert.ok([...review.files.keys()].every((name) => name.startsWith('wellbe/')));
  assert.equal(review.files.has('wellbe/sitemap.xml'), false);
});

test('input rejects non-dedicated forms, shared links, unknown event IDs and invalid dates', () => {
  const site = localSource();
  for (const url of [
    'http://forms.example.test/request',
    'https://forms.gle/auGg94P3SyB6JTW56',
    'https://us06web.zoom.us/j/0000',
    'https://forms.example.test/?email=alice',
    'https://name:password@forms.example.test/new',
    'https://minhos-management.jp/line/'
  ]) assert.equal(publicHttps(url, site.origin), null);
  const same = actionsForFixture(localSource());
  same.actions.registration.url = same.actions.consultation.url;
  assert.throws(() => validateContent(same), /distinct destinations/);
  site.actions.registration.occurrenceId = 'missing';
  assert.throws(() => validateContent(site), /unknown occurrence/);
  site.actions.registration.occurrenceId = 'clinical-reasoning-intro';
  site.occurrences[0].date = '2026-02-30';
  assert.throws(() => validateContent(site), /date is invalid/);
});

test('release uses enabled links and approved material only, independently of review quotes', () => {
  const site = actionsForFixture(localSource());
  const draftQuote = { id: 'example-quote', occurrenceId: 'edema-first', quote: '<draft-quote>', approved: false };
  const approvedQuote = { id: 'approved-quote', occurrenceId: 'edema-first', quote: '公開用の感想', approved: true };
  const priorDraft = { ...approvedQuote, quote: '<prior-draft>', approved: false };
  site.voices = [approvedQuote];
  site.hosts.forEach((host) => {
    host.approved = true;
    if (host.photo) site.assets[host.photo].approved = true;
  });
  site.operator = { name: 'テスト運営', contactUrl: 'https://forms.example.test/operation' };
  const review = renderSite(site, { now: asOf, reviewVoices: [draftQuote, priorDraft] });
  assert.match(review.files.get('wellbe/index.html'), /&lt;draft-quote&gt;/);
  assert.doesNotMatch(review.files.get('wellbe/index.html'), /prior-draft/);
  const release = renderSite(site, { mode: 'release', now: asOf, reviewVoices: [draftQuote, priorDraft] });
  const index = release.files.get('wellbe/index.html');
  const study = release.files.get('wellbe/study/index.html');
  assert.match(index, /name="robots" content="index, follow"/);
  assert.match(index, /href="https:\/\/forms\.example\.test\/operation"[^>]*>テスト運営へのお問い合わせ/);
  assert.match(index, /data-cta="wellbe_next_register"[^>]+data-occurrence-id="clinical-reasoning-intro"/);
  assert.equal((index.match(/data-cta="wellbe_consult"/g) || []).length, 3);
  for (const page of [index, study]) {
    assert.match(page, /<blockquote[^>]*><p>公開用の感想<\/p><\/blockquote>/);
    assert.doesNotMatch(page, /draft-quote|prior-draft/);
  }
  assert.doesNotMatch(index, /^[ \t]+$/m);
  assert.match(release.files.get('wellbe/sitemap.xml'), /https:\/\/minhos-management.jp\/wellbe\//);
  const tracked = structuredClone(site);
  tracked.voices.push(draftQuote);
  assert.throws(() => validateContent(tracked), /must be approved/);
});

test('release displays the operator and pending inquiries with both form links active', () => {
  const site = actionsForFixture(localSource());
  site.hosts.forEach((host) => {
    host.approved = true;
    if (host.photo) site.assets[host.photo].approved = true;
  });
  site.operator = { name: '事業所A・事業所B', contactUrl: null };
  const release = renderSite(site, { mode: 'release', now: asOf });
  for (const name of ['index.html', 'privacy.html', 'terms.html', 'medical-disclaimer.html']) {
    const page = release.files.get('wellbe/' + name);
    assert.match(page, /運営　事業所A・事業所B/);
    assert.match(page, /<p>お問い合わせは準備中です。<\/p>/);
    assert.doesNotMatch(page, /href="(?:null|undefined)"/);
  }
  const index = release.files.get('wellbe/index.html');
  assert.ok(index.includes('href="' + site.actions.consultation.url + '"'));
  assert.ok(index.includes('href="' + site.actions.registration.url + '"'));
});

test('output paths cannot escape the generated directory', () => {
  for (const file of ['../other', '/wellbe/index.html', 'C:/other', 'wellbe/../other', 'wellbe\\x']) {
    assert.throws(() => safePath(os.tmpdir(), file), /Unsafe relative path/);
  }
  assert.equal(safePath(os.tmpdir(), 'wellbe/index.html'), path.join(os.tmpdir(), 'wellbe', 'index.html'));
});

const settings = {
  basePath: '/wellbe/',
  origin: 'https://minhos-management.jp',
  mode: 'release',
  measurementId: 'G-000000TEST',
  ctaLabels: { wellbe_consult: '導入相談', wellbe_next_register: '参加登録' }
};
const landing = new URL('https://minhos-management.jp/wellbe/?name=unwanted#queryvalue');
function anchor(cta, loc, target, occurrenceId = '') {
  return {
    tagName: 'A',
    href: 'https://docs.google.com/forms/d/e/private-looking-id/viewform?key=no#fragment',
    getAttribute: () => null,
    dataset: { cta, ctaLoc: loc, targetType: target, occurrenceId, lpSlug: 'wellbe' }
  };
}

test('analytics only connects after opt-in on the release LP and sends one sanitized event per CTA', () => {
  const events = [];
  let connectCount = 0;
  let enabled = true;
  const connect = () => {
    connectCount++;
    return { send: (name, value) => events.push({ name, value }), setEnabled: (value) => { enabled = value; } };
  };
  const consultation = anchor('wellbe_consult', 'hero', 'consultation_form');
  const registration = anchor('wellbe_next_register', 'next', 'lecture_registration', 'clinical-reasoning-intro');
  for (const [config, location] of [
    [{ ...settings, mode: 'review' }, landing],
    [{ ...settings, measurementId: null }, landing],
    [settings, new URL('http://127.0.0.1:4173/wellbe/')],
    [settings, new URL('https://preview.web.app/wellbe/')],
    [settings, new URL('https://minhos-management.jp/wellbe/privacy.html')]
  ]) {
    const disabled = createTracker(config, location, connect);
    disabled.consent(true);
    disabled.click(consultation);
  }
  const tracker = createTracker(settings, landing, connect);
  tracker.click(consultation);
  tracker.consent(false);
  assert.equal(connectCount, 0);
  tracker.consent(true);
  tracker.consent(true);
  tracker.click(consultation);
  tracker.click(registration);
  tracker.click({ ...registration, hidden: true });
  tracker.click({ ...consultation, tagName: 'P' });
  tracker.consent(false);
  assert.equal(enabled, false);
  tracker.click(consultation);
  assert.equal(connectCount, 1);
  assert.deepEqual(events.map(({ name }) => name), ['page_view', 'lp_cta_click', 'lp_cta_click']);
  assert.equal(events[2].value.occurrence_id, 'clinical-reasoning-intro');
  assert.equal(events[1].value.target_path, '/forms/');
  assert.doesNotMatch(JSON.stringify(events), /\?|private-looking|queryvalue|fragment|unwanted/);
  assert.equal(clickParams(settings, anchor('wellbe_next_register', 'next', 'lecture_registration')), null);
});

test('current source remains schema-valid', () => assert.equal(readSite().basePath, '/wellbe/'));

export function localSource() {
  const site = readSite();
  site.actions.consultation = { ...site.actions.consultation, url: null, enabled: false };
  site.actions.registration = { ...site.actions.registration, url: null, enabled: false };
  site.occurrences = [
    { id: 'edema-first', title: '浮腫', date: '2026-10-15', startTime: null, status: 'held', number: 1, confirmedOn: '2026-11-20', public: true, summary: null },
    { id: 'clinical-reasoning-intro', title: '臨床推論入門', date: '2026-12-23', startTime: '21:00', status: 'scheduled', number: null, confirmedOn: '2026-11-20', public: true, summary: null }
  ];
  site.actions.registration.occurrenceId = 'clinical-reasoning-intro';
  site.operator = null;
  site.voices = [];
  site.analytics = { enabled: false, measurementId: null };
  site.education.status = 'planned';
  return site;
}

export function actionsForFixture(site) {
  site.actions.consultation.url = 'https://forms.example.test/consult';
  site.actions.consultation.enabled = true;
  site.actions.registration.url = 'https://forms.example.test/attend';
  site.actions.registration.enabled = true;
  return site;
}
