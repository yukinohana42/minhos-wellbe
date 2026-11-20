import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildSite } from './build-site.mjs';
import { root, supportedBasePath } from './site-content.mjs';
import { safePath, sha256, writeTree } from './site-files.mjs';
import { validateOutput } from './validate.mjs';

const repoUrl = 'https://github.com/yukinohana42/minhos-wellbe';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
const mode = process.argv.includes('--review') ? 'review' : 'release';

function sourceState() {
  const head = git('rev-parse', 'HEAD');
  const clean = !git('status', '--porcelain=v1', '--untracked-files=all');
  const listed = git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean);
  const files = [...new Set(listed)].sort();
  if (mode === 'review' && fs.existsSync(path.join(root, '.tmp', 'content', 'review-voices.json'))) {
    files.push('.tmp/content/review-voices.json');
  }
  const inputs = files.map((file) => {
    const absolute = path.join(root, file);
    return file + ' ' + (fs.existsSync(absolute) ? sha256(fs.readFileSync(absolute)) : 'absent');
  });
  return { head, clean, inputDigest: sha256(inputs.join('\n')) };
}

try {
  const origin = git('remote', 'get-url', 'origin');
  if (origin !== repoUrl && origin !== repoUrl + '.git') throw new Error('Source repository does not match the Well be repository.');
  const source = sourceState();
  const result = buildSite({ mode });
  if (result.site.basePath !== supportedBasePath) throw new Error('HP export is restricted to ' + supportedBasePath);
  if (mode === 'release' && !source.clean) throw new Error('公開用exportには検証済みの確定commitが必要です。');
  const verified = await validateOutput(result);
  const finished = sourceState();
  if (source.head !== finished.head || source.clean !== finished.clean || source.inputDigest !== finished.inputDigest) {
    throw new Error('The source changed during export. Verify the updated version first.');
  }
  const tree = new Map();
  const dest = path.join(root, '.tmp');
  const target = mode === 'release' ? 'hp-export' : 'hp-review-export';
  const manifest = {
    repository: repoUrl,
    ...source,
    canonical: result.site.origin + result.site.basePath,
    serviceId: result.site.serviceId,
    mode,
    builtAt: result.now.toISOString(),
    node: process.version,
    npm: process.env.npm_config_user_agent?.split(' ')[0] ?? null,
    verification: { ...verified, publicRelease: mode === 'release' },
    files: []
  };
  for (const [relative, bytes] of [...result.files].sort(([a], [b]) => a.localeCompare(b))) {
    if (!relative.startsWith(supportedBasePath.slice(1))) throw new Error('Export path has left the Well be prefix.');
    safePath(dest, 'public/' + relative);
    const output = 'public/' + relative;
    if (tree.has(output)) throw new Error('Export collision: ' + relative);
    tree.set(output, bytes);
    manifest.files.push({ path: output, bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
  }
  tree.set('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  console.log('Exported ' + mode + ' package at ' + writeTree(dest, target, tree));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
