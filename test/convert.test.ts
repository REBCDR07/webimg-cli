import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runParallel } from '../src/convert.js';
import { mergeConfig } from '../src/config.js';
import { findImages } from '../src/scan.js';
import { summarize } from '../src/report.js';

let tmpDir: string;

async function createPng(fileName: string, width = 200): Promise<void> {
  await sharp({
    create: { width, height: 200, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toFile(path.join(tmpDir, fileName));
}

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webimg-test-'));
  await createPng('red.png');
});

afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* Sharp may release handles asynchronously on Windows. */ }
});

describe('webimg-cli', () => {
  it('rejects invalid configuration values', () => {
    assert.throws(() => mergeConfig({ quality: 0 }), /Qualité invalide/);
    assert.throws(() => mergeConfig({ formats: [] }), /formats invalides/);
    assert.throws(() => mergeConfig({ resize: 0 }), /resize invalide/);
  });
  it('finds input images', async () => {
    const cfg = mergeConfig({ cache: false });
    const files = await findImages(tmpDir, cfg);

    assert.deepEqual(files, ['red.png']);
  });

  it('uses the configured input directory and writes output relative to it', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.renameSync(path.join(tmpDir, 'red.png'), path.join(tmpDir, 'src', 'red.png'));
    await createPng('ignored.png');

    const cfg = mergeConfig({ input: 'src', output: 'public/img', formats: ['webp'], cache: false });
    const files = await findImages(tmpDir, cfg);
    const results = await runParallel(files, cfg, tmpDir);

    assert.deepEqual(files, ['src/red.png']);
    assert.equal(results.filter((r) => r.status === 'ok').length, 1);
    assert.equal(fs.existsSync(path.join(tmpDir, 'public/img/red.webp')), true);
    assert.equal(fs.existsSync(path.join(tmpDir, 'public/img/src/red.webp')), false);
  });

  it('converts a PNG to WebP', async () => {
    const cfg = mergeConfig({ formats: ['webp'], quality: 70, cache: false });
    const files = await findImages(tmpDir, cfg);
    const results = await runParallel(files, cfg, tmpDir);
    const ok = results.filter((r) => r.status === 'ok');

    assert.equal(ok.length, 1);
    assert.ok(ok[0].afterSize > 0);
    assert.equal(fs.existsSync(path.join(tmpDir, 'red.webp')), true);
  });

  it('does not rescan generated outputs as inputs', async () => {
    const firstCfg = mergeConfig({ formats: ['webp'], quality: 70, cache: false });
    const firstFiles = await findImages(tmpDir, firstCfg);
    await runParallel(firstFiles, firstCfg, tmpDir);

    const responsiveCfg = mergeConfig({
      formats: ['webp'],
      quality: 70,
      responsive: [1, 2],
      resize: 100,
      suffix: '.r',
      cache: false,
    });
    const files = await findImages(tmpDir, responsiveCfg);
    const results = await runParallel(files, responsiveCfg, tmpDir);

    assert.deepEqual(files, ['red.png']);
    assert.equal(results.filter((r) => r.status === 'ok').length, 2);
    assert.equal(fs.existsSync(path.join(tmpDir, 'red.r@1x.webp')), true);
    assert.equal(fs.existsSync(path.join(tmpDir, 'red.r@2x.webp')), true);
  });

  it('invalidates cache entries when conversion options change', async () => {
    const firstCfg = mergeConfig({ formats: ['webp'], quality: 90 });
    await runParallel(await findImages(tmpDir, firstCfg), firstCfg, tmpDir);

    const secondCfg = mergeConfig({ formats: ['webp'], quality: 20 });
    const results = await runParallel(await findImages(tmpDir, secondCfg), secondCfg, tmpDir);

    assert.equal(results.filter((r) => r.status === 'ok').length, 1);
    assert.equal(results.some((r) => r.status === 'cached' || r.status === 'skipped'), false);
  });

  it('strips metadata unless keepMetadata is enabled', async () => {
    fs.rmSync(path.join(tmpDir, 'red.png'));
    await sharp({
      create: { width: 80, height: 80, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'secret' } } })
      .toFile(path.join(tmpDir, 'meta.jpg'));

    const cfg = mergeConfig({ formats: ['webp'], cache: false });
    await runParallel(await findImages(tmpDir, cfg), cfg, tmpDir);

    const inputMeta = await sharp(path.join(tmpDir, 'meta.jpg')).metadata();
    const outputMeta = await sharp(path.join(tmpDir, 'meta.webp')).metadata();

    assert.notEqual(inputMeta.exif, undefined);
    assert.equal(outputMeta.exif, undefined);
  });

  it('refuses to write output over the source file', async () => {
    fs.rmSync(path.join(tmpDir, 'red.png'));
    await sharp({
      create: { width: 80, height: 80, channels: 3, background: { r: 0, g: 255, b: 0 } },
    })
      .webp()
      .toFile(path.join(tmpDir, 'same.webp'));

    const cfg = mergeConfig({ formats: ['webp'], cache: false });
    const results = await runParallel(await findImages(tmpDir, cfg), cfg, tmpDir);

    assert.equal(results.length, 1);
    assert.equal(results[0].status, 'error');
    assert.equal(fs.existsSync(path.join(tmpDir, 'same.webp')), true);
  });

  it('supprime les references scannees uniquement apres conversion reussie', async () => {
    const cfg = mergeConfig({ formats: ['webp'], suppRef: true, cache: false });
    const files = await findImages(tmpDir, cfg);
    const results = await runParallel(files, cfg, tmpDir);

    assert.equal(results.every((r) => r.status === 'ok'), true);
    assert.equal(fs.existsSync(path.join(tmpDir, 'red.png')), false);
    assert.equal(fs.existsSync(path.join(tmpDir, 'red.webp')), true);
  });

  it('sauvegarde la source avant suppression quand le backup est active', async () => {
    const cfg = mergeConfig({ formats: ['webp'], suppRef: true, backup: true, backupDir: 'backup', cache: false });
    await runParallel(await findImages(tmpDir, cfg), cfg, tmpDir);
    assert.equal(fs.existsSync(path.join(tmpDir, 'red.png')), false);
    assert.equal(fs.existsSync(path.join(tmpDir, 'backup', 'red.png')), true);
  });

  it('supprime la source si les sorties existent deja', async () => {
    const firstCfg = mergeConfig({ formats: ['webp'], cache: false });
    await runParallel(await findImages(tmpDir, firstCfg), firstCfg, tmpDir);
    const secondCfg = mergeConfig({ formats: ['webp'], suppRef: true, cache: false });
    const results = await runParallel(await findImages(tmpDir, secondCfg), secondCfg, tmpDir);

    assert.equal(results.every((r) => r.status === 'skipped'), true);
    assert.equal(fs.existsSync(path.join(tmpDir, 'red.png')), false);
  });

  it('conserve la reference en cas d echec de conversion', async () => {
    const cfg = mergeConfig({ formats: ['webp'], suppRef: true, cache: false });
    const files = await findImages(tmpDir, cfg);
    const results = await runParallel(files, { ...cfg, quality: 0 }, tmpDir);

    assert.equal(results.some((r) => r.status === 'error'), true);
    assert.equal(fs.existsSync(path.join(tmpDir, 'red.png')), true);
  });

  it('reports cached and skipped outputs in totals', () => {
    const summary = summarize([
      { source: 'red.png', output: 'red.webp', format: 'webp', density: 1, status: 'cached', beforeSize: 100, afterSize: 40 },
      { source: 'other.png', output: 'other.webp', format: 'webp', density: 1, status: 'skipped', beforeSize: 200, afterSize: 80 },
    ]);
    assert.equal(summary.cached, 1);
    assert.equal(summary.skipped, 1);
    assert.equal(summary.totalBefore, 300);
    assert.equal(summary.totalAfter, 120);
  });

  it('counts each source once in report totals for multi-output conversions', () => {
    const summary = summarize([
      { source: 'red.png', output: 'red.webp', format: 'webp', density: 1, status: 'ok', beforeSize: 100, afterSize: 40 },
      { source: 'red.png', output: 'red.avif', format: 'avif', density: 1, status: 'ok', beforeSize: 100, afterSize: 30 },
    ]);

    assert.equal(summary.totalBefore, 100);
    assert.equal(summary.totalAfter, 70);
    assert.equal(summary.savedBytes, 30);
  });
});
