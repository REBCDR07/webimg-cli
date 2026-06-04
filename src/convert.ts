import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConversionCache } from './cache.js';
import { planOutputs, toDisplayPath } from './paths.js';
import type { OutputFormat, WebimgConfig } from './config.js';

export interface ConvertResult {
  source: string;
  output: string;
  format: OutputFormat;
  density: number;
  status: 'ok' | 'skipped' | 'cached' | 'dryrun' | 'error';
  beforeSize: number;
  afterSize: number;
  error?: string;
}

async function applyFormat(
  pipeline: sharp.Sharp,
  format: OutputFormat,
  quality: number,
): Promise<sharp.Sharp> {
  switch (format) {
    case 'webp':
      return pipeline.webp({ quality });
    case 'avif':
      return pipeline.avif({ quality });
    case 'jpeg':
      return pipeline.jpeg({ quality, mozjpeg: true });
    case 'png':
      return pipeline.png({ quality, compressionLevel: 9 });
  }
}

export async function convertFile(
  source: string,
  cfg: Required<WebimgConfig>,
  cache: ConversionCache,
  cwd: string,
): Promise<ConvertResult[]> {
  const sourcePath = path.resolve(cwd, source);
  const displaySource = toDisplayPath(cwd, sourcePath);
  const outputs = planOutputs(sourcePath, cfg, cwd);
  const outPaths = outputs.map((o) => o.output);
  const optionsHash = ConversionCache.optionsHash(cfg);

  if (cache.isUpToDate(sourcePath, outPaths, optionsHash)) {
    const beforeSize = fs.statSync(sourcePath).size;
    return outputs.map((o) => ({
      source: displaySource,
      output: toDisplayPath(cwd, o.output),
      format: o.format,
      density: o.density,
      status: 'cached' as const,
      beforeSize,
      afterSize: fs.existsSync(o.output) ? fs.statSync(o.output).size : 0,
    }));
  }

  const beforeSize = fs.statSync(sourcePath).size;
  const overwriteKnownOutputs = cache.hasEntry(sourcePath, outPaths);
  const results: ConvertResult[] = [];

  for (const out of outputs) {
    const sameAsSource = path.resolve(out.output) === sourcePath;

    if (sameAsSource) {
      results.push({
        source: displaySource,
        output: toDisplayPath(cwd, out.output),
        format: out.format,
        density: out.density,
        status: 'error',
        beforeSize,
        afterSize: 0,
        error: 'Le chemin de sortie est identique au fichier source. Utilisez --suffix ou --output.',
      });
      continue;
    }

    if (
      fs.existsSync(out.output) &&
      !overwriteKnownOutputs &&
      !cfg.dryRun
    ) {
      results.push({
        source: displaySource,
        output: toDisplayPath(cwd, out.output),
        format: out.format,
        density: out.density,
        status: 'skipped',
        beforeSize,
        afterSize: fs.statSync(out.output).size,
      });
      continue;
    }

    if (cfg.dryRun) {
      results.push({
        source: displaySource,
        output: toDisplayPath(cwd, out.output),
        format: out.format,
        density: out.density,
        status: 'dryrun',
        beforeSize,
        afterSize: 0,
      });
      continue;
    }

    try {
      fs.mkdirSync(path.dirname(out.output), { recursive: true });
      let p = sharp(sourcePath);
      const meta = await p.metadata();

      let targetWidth = out.width;
      if (cfg.maxWidth && (!targetWidth || targetWidth > cfg.maxWidth)) {
        targetWidth = cfg.maxWidth;
      }
      if (targetWidth && meta.width && targetWidth < meta.width) {
        p = p.resize({ width: targetWidth, withoutEnlargement: true });
      }
      if (cfg.keepMetadata) {
        p = p.withMetadata();
      }
      p = await applyFormat(p, out.format, cfg.quality);

      const tmp = out.output + '.tmp';
      await p.toFile(tmp);
      fs.renameSync(tmp, out.output);

      results.push({
        source: displaySource,
        output: toDisplayPath(cwd, out.output),
        format: out.format,
        density: out.density,
        status: 'ok',
        beforeSize,
        afterSize: fs.statSync(out.output).size,
      });
    } catch (err) {
      try { fs.unlinkSync(out.output + '.tmp'); } catch { /* ignore */ }
      results.push({
        source: displaySource,
        output: toDisplayPath(cwd, out.output),
        format: out.format,
        density: out.density,
        status: 'error',
        beforeSize,
        afterSize: 0,
        error: (err as Error).message,
      });
    }
  }

  if (!cfg.dryRun && results.every((r) => r.status === 'ok')) {
    cache.record(sourcePath, outPaths, optionsHash);
  }

  if (!cfg.keepOriginal && !cfg.dryRun && results.every((r) => r.status === 'ok')) {
    try { fs.unlinkSync(sourcePath); } catch { /* ignore */ }
  }

  return results;
}

export async function runParallel(
  files: string[],
  cfg: Required<WebimgConfig>,
  cwd: string,
  onProgress?: (done: number, total: number) => void,
): Promise<ConvertResult[]> {
  const cache = new ConversionCache(cwd, cfg.cache);
  const concurrency = Math.max(1, Math.min(files.length, os.cpus().length));
  const all: ConvertResult[] = [];
  let index = 0;
  let done = 0;

  const workers = Array.from({ length: concurrency }, async () => {
    while (index < files.length) {
      const i = index++;
      const res = await convertFile(files[i], cfg, cache, cwd);
      all.push(...res);
      done++;
      onProgress?.(done, files.length);
    }
  });
  await Promise.all(workers);
  cache.save();
  return all;
}
