import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const cli = path.join(root, 'dist', 'index.js');

if (!fs.existsSync(cli)) {
  const build = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: root, encoding: 'utf8' });
  if (build.status !== 0) throw new Error(build.stderr || build.stdout);
}

async function fixture(): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webimg-cli-'));
  await sharp({ create: { width: 20, height: 20, channels: 3, background: 'red' } }).png().toFile(path.join(dir, 'input.png'));
  return dir;
}

describe('CLI integration', () => {
  it('converts through the packaged CLI and honors concurrency', async () => {
    const dir = await fixture();
    const result = spawnSync(process.execPath, [cli, 'run', '-i', dir, '-o', path.join(dir, 'out'), '-f', 'webp', '--concurrency', '1'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(dir, 'out', 'input.webp')), true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('cleans an orphaned generated output through the CLI', async () => {
    const dir = await fixture();
    fs.mkdirSync(path.join(dir, 'out'));
    await sharp({ create: { width: 10, height: 10, channels: 3, background: 'blue' } }).webp().toFile(path.join(dir, 'out', 'old.webp'));
    const result = spawnSync(process.execPath, [cli, 'run', '-i', dir, '-o', path.join(dir, 'out'), '-f', 'webp', '--clean'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(dir, 'out', 'old.webp')), false);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
