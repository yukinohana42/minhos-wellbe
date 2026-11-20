import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

export function safePath(directory, relative) {
  if (typeof relative !== 'string' || !/^[a-z0-9_-]+(?:[.][a-z0-9_-]+)*(?:\/[a-z0-9_-]+(?:[.][a-z0-9_-]+)*)*$/i.test(relative)) {
    throw new Error('Unsafe relative path: ' + relative);
  }
  let current = directory;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) {
      throw new Error('Symbolic links are outside the site contract: ' + relative);
    }
  }
  return current;
}

// Write the complete tree before replacing a generated directory. The previous
// tree is retained locally so a failed or concurrent write never consumes it.
export function writeTree(workspace, name, files) {
  fs.mkdirSync(workspace, { recursive: true });
  if (fs.lstatSync(workspace).isSymbolicLink()) throw new Error('The generated workspace must be a local directory.');
  const target = safePath(workspace, name);
  if (fs.existsSync(target) && !fs.existsSync(path.join(target, '.wellbe-output'))) {
    throw new Error('Refusing to replace an unrecognized directory: ' + target);
  }
  const stage = fs.mkdtempSync(path.join(workspace, name + '-'));
  for (const [relative, bytes] of files) {
    const file = safePath(stage, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes, { flag: 'wx' });
  }
  fs.writeFileSync(path.join(stage, '.wellbe-output'), 'Generated from the Well be LP\n', { flag: 'wx' });
  let backup;
  if (fs.existsSync(target)) {
    backup = path.join(workspace, '.wellbe-previous-' + path.basename(stage));
    fs.renameSync(target, backup);
  }
  try {
    fs.renameSync(stage, target);
  } catch (error) {
    if (backup && !fs.existsSync(target)) fs.renameSync(backup, target);
    throw error;
  }
  return target;
}
