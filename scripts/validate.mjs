import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { buildSite, legalPages } from './build-site.mjs';
import { root, sessionsAt, actionHref, publicHttps } from './site-content.mjs';

const imageFormats = { '.webp': 'webp', '.png': 'png', '.jpg': 'jpeg' };
const outputTypes = new Set(['.html', '.js', '.css', '.png', '.jpg', '.webp', '.svg', '.xml']);
const patterns = [
  [/poc|共同開発パートナー|REPLACE_ME|REPLACE_WITH|example\.(?:com|test)|localhost/i, 'placeholder or internal wording'],
  [/data:image|base64|\/source-package\/|BEGIN [A-Z ]*PRIVATE KEY|client_secret|service_account/, 'private or embedded data'],
  [/minhos-wellbe-homecare-lecture\.web\.app|ogp-edema-program|console\.log/, 'legacy hosting or debug content']
];

const attr = (tag, name) => tag.match(new RegExp('\\s' + name + '="([^"]*)"'))?.[1];
const tags = (source, names) => [...source.matchAll(new RegExp('<(?:' + names + ')\\b[^>]*>', 'gi'))].map(([tag]) => tag);

export async function validateOutput({ site, files, mode, now }) {
  const issues = [];
  const check = (truth, note) => { if (!truth) issues.push(note); };
  const names = ['index.html', ...Object.keys(legalPages)];
  const emitted = new Set();
  const assetInfo = new Map(Object.values(site.assets)
    .flatMap((asset) => [asset, asset.small].filter(Boolean)).map((asset) => [site.basePath.slice(1) + asset.src, asset]));
  const imageSizes = new Map();
  const { next } = sessionsAt(site, now);
  const assetPrefix = site.basePath.slice(1);
  const publicUrl = site.origin + site.basePath;
  const forward = name => site.basePath + name;
  const configuredActions = Object.values(site.actions).filter((action) => action.enabled).map(({ url }) => publicHttps(url, site.origin));

  for (const [name, bytes] of files) {
    const ext = path.extname(name);
    const lower = name.toLowerCase();
    check(name.startsWith(assetPrefix) && outputTypes.has(ext) && !emitted.has(lower), 'Unexpected or colliding output: ' + name);
    emitted.add(lower);
    if (imageFormats[ext]) {
      const declared = assetInfo.get(name);
      check(declared, 'Undeclared image: ' + name);
      const input = sharp(bytes);
      const metadata = await input.metadata();
      await input.raw().toBuffer();
      check(declared && metadata.format === imageFormats[ext] && metadata.width === declared.width && metadata.height === declared.height,
        'Image dimensions or encoding do not match: ' + name);
      imageSizes.set('/' + name, metadata);
      continue;
    }
    const source = String(bytes);
    for (const [pattern, label] of patterns) check(!pattern.test(source), label + ': ' + name);
    if (ext === '.svg') {
      check(/^<svg\b[^>]*viewBox="[^"]+"/i.test(source.trim()) &&
        !/<script\b|<foreignObject\b|(?:href|xlink:href)="https?:|\son\w+=/i.test(source),
      'Unsafe SVG content: ' + name);
    }
    if (ext === '.css') {
      for (const [, sourcePath] of source.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) {
        check(sourcePath.startsWith(site.basePath) && files.has(sourcePath.slice(1)), 'Broken CSS resource: ' + name);
      }
    }
    if (ext === '.js') {
      try { execFileSync(process.execPath, ['--input-type=module', '--check'], { input: source, stdio: 'pipe' }); }
      catch { issues.push('JavaScript syntax error: ' + name); }
    }
  }

  const css = String(files.get(assetPrefix + 'css/styles.css'));
  check(css.includes('prefers-reduced-motion') && css.includes('forced-colors'), 'Accessibility media queries are missing.');
  const legacy = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
  const rc = JSON.parse(fs.readFileSync(path.join(root, '.firebaserc'), 'utf8'));
  check(legacy.hosting?.public === 'public' && legacy.hosting.ignore?.includes('assets/infographics/source-package/**') &&
    rc.projects?.default === 'minhos-wellbe-homecare-lecture', 'Legacy Firebase scope changed.');
  const deploy = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts.deploy;
  check(deploy === 'node scripts/deploy-disabled.mjs', 'The standalone LP deploy entry is enabled.');
  JSON.parse(fs.readFileSync(path.join(root, 'public/schemas/analytics-event.schema.json'), 'utf8'));
  execFileSync(process.execPath, ['--check', path.join(root, 'scripts/process-infographics.mjs')], { stdio: 'pipe' });

  for (const name of names) {
    const source = files.get(assetPrefix + name);
    check(typeof source === 'string', 'Missing generated page: ' + name);
    if (!source) continue;
    const landing = name === 'index.html';
    const expectedUrl = publicUrl + (landing ? '' : name);
    const expectedRobots = landing && mode === 'release' ? 'index, follow' : 'noindex, follow';
    const meta = (key, field = 'name') => tags(source, 'meta').find((tag) => attr(tag, field) === key);
    const canonical = tags(source, 'link').find((tag) => attr(tag, 'rel') === 'canonical');
    const imageUrl = attr(meta('og:image', 'property') || '', 'content') || '';
    const description = attr(meta('description') || '', 'content');
    const ids = [...source.matchAll(/\sid="([a-z0-9_-]+)"/gi)].map(([, id]) => id);
    check(new Set(ids).size === ids.length, 'Duplicate element ID: ' + name);
    check(/<html lang="ja">/.test(source) && /<meta charset="utf-8">/.test(source) &&
      Boolean(meta('viewport')), 'Language, UTF-8 or viewport is missing: ' + name);
    check(tags(source, 'h1').length === 1 && tags(source, 'main').length === 1 &&
      source.includes('class="skip-link" href="#main-content"'), 'Main landmark, h1 or skip link missing: ' + name);
    check(attr(canonical || '', 'href') === expectedUrl && attr(meta('og:url', 'property') || '', 'content') === expectedUrl,
      'Canonical or OGP URL mismatch: ' + name);
    check(Boolean(description) && source.includes('<title>') && attr(meta('robots') || '', 'content') === expectedRobots &&
      imageUrl.startsWith(publicUrl) && imageSizes.has(imageUrl.slice(site.origin.length)), 'Incomplete SEO metadata: ' + name);
    const jsonLd = source.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
    const ld = jsonLd ? JSON.parse(jsonLd[1]) : null;
    check(ld?.['@type'] === 'WebPage' && ld.url === expectedUrl && Boolean(ld.description), 'WebPage metadata mismatch: ' + name);

    for (const tag of tags(source, 'a|img|link|script')) {
      const src = attr(tag, 'src');
      const href = attr(tag, 'href');
      for (const ref of [src, href].filter(Boolean)) {
        if (ref.startsWith('#')) check(ids.includes(ref.slice(1)), 'Unknown anchor ' + ref + ' in ' + name);
        else if (ref === expectedUrl || ref === site.origin + '/' || ref === site.operator?.contactUrl || configuredActions.includes(ref)) continue;
        else check(ref === site.basePath || (ref.startsWith(site.basePath) && files.has(ref.slice(1))),
          'Broken or unapproved URL: ' + name + ' ' + ref);
      }
    }
    const images = tags(source, 'img');
    for (const tag of images) {
      const src = attr(tag, 'src');
      const dimensions = imageSizes.get(src);
      check(Boolean(dimensions) && Number(attr(tag, 'width')) === dimensions.width && Number(attr(tag, 'height')) === dimensions.height &&
        attr(tag, 'alt') !== undefined, 'Image needs matching dimensions and alt: ' + name + ' ' + src);
      if (!tag.includes('class="brand-') && !tag.includes('fetchpriority="high"')) {
        check(attr(tag, 'loading') === 'lazy', 'Below-fold image is not lazy: ' + src);
      }
      const srcset = attr(tag, 'srcset');
      for (const candidate of srcset ? srcset.split(',') : []) {
        const [reference, width] = candidate.trim().split(/\s+/);
        const responsive = imageSizes.get(reference);
        check(responsive && width === responsive.width + 'w' && Boolean(attr(tag, 'sizes')), 'Invalid srcset: ' + src);
      }
    }
    for (const logo of ['wellbe-logo', 'minhos-logo']) {
      check(images.filter((tag) => attr(tag, 'src') === forward(site.assets[logo].src)).length === 2, 'Header/footer logo missing: ' + name);
    }
    const eager = images.filter((tag) => attr(tag, 'loading') === 'eager');
    check(landing ? eager.length === 1 && attr(eager[0], 'fetchpriority') === 'high' : !eager.length, 'Unexpected image loading priority: ' + name);
    check(!source.includes('script7.js') && !source.includes('googletagmanager') && !source.includes('analytics-event.schema'), 'Competing analytics script: ' + name);
    if (!landing) continue;
    for (const target of [...source.matchAll(/aria-labelledby="([^"]+)"/g)].flatMap(([, value]) => value.split(' '))) {
      check(ids.includes(target), 'Unlabelled section: ' + target);
    }
    const ctas = tags(source, 'a').filter((tag) => attr(tag, 'data-cta'));
    for (const kind of ['consultation', 'registration']) {
      const { id } = site.actions[kind];
      const href = actionHref(site, kind, next);
      const matching = ctas.filter((tag) => attr(tag, 'data-cta') === id);
      const locations = kind === 'consultation' ? ['hero', 'education', 'final'] : ['next'];
      check(matching.length === (href ? locations.length : 0), 'CTA placements mismatch: ' + kind);
      if (href) for (const location of locations) {
        const anchor = matching.find((tag) => attr(tag, 'data-cta-loc') === location);
        check(anchor && attr(anchor, 'href') === href && (kind === 'consultation' || attr(anchor, 'data-occurrence-id') === next.id), 'CTA target mismatch: ' + location);
      }
    }
    check(!tags(source, 'p|button|span').some((tag) => attr(tag, 'data-cta')), 'A disabled or non-link CTA is tracked.');
    const details = [...source.matchAll(/<details>\s*<summary>([^<]+)<\/summary>\s*<p>[\s\S]+?<\/p>\s*<\/details>/g)];
    check(details.length > 0 && details.length === tags(source, 'details').length, 'FAQ needs discoverable summaries and answers.');
  }

  const sitemap = files.get(assetPrefix + 'sitemap.xml');
  check(mode === 'review' ? !sitemap : Boolean(sitemap?.includes('<loc>' + publicUrl + '</loc>')), 'Sitemap does not match the mode.');
  const config = String(files.get(assetPrefix + 'js/config.js'));
  check(mode === 'release' || config.includes('"measurementId":null'), 'Review enables analytics.');
  if (issues.length) throw new Error(issues.join('\n'));
  return { pages: names.length, images: imageSizes.size, files: files.size, mode };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const mode = process.argv.includes('--release') ? 'release' : 'review';
  try {
    const result = await validateOutput(buildSite({ mode }));
    console.log('Validation passed: ' + JSON.stringify(result));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
