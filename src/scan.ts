import { globby } from 'globby';
import path from 'node:path';
import { mergeConfig, type WebimgConfig } from './config.js';
import { filterPlannedOutputsFromInputs, isSubpath, resolveInputRoot, resolveOutputRoot, toDisplayPath, toPosixPath } from './paths.js';

export const SUPPORTED_INPUT = ['png', 'jpg', 'jpeg', 'tiff', 'webp', 'avif'];

export async function findImages(
  cwd: string,
  opts: WebimgConfig = {},
): Promise<string[]> {
  const cfg = mergeConfig(opts);
  const inputRoot = resolveInputRoot(cwd, cfg);
  const ext = `{${SUPPORTED_INPUT.join(',')}}`;
  const base = cfg.recursive ? [`**/*.${ext}`] : [`*.${ext}`];
  const patterns = cfg.include.length ? cfg.include : base;
  const ignore = [
    '**/node_modules/**',
    '**/dist/**',
    '**/.git/**',
    ...cfg.exclude,
  ];

  const outputRoot = resolveOutputRoot(cwd, cfg);
  if (outputRoot && isSubpath(inputRoot, outputRoot)) {
    const rel = path.relative(inputRoot, outputRoot);
    if (rel) ignore.push(`${toPosixPath(rel)}/**`);
  }

  const files = await globby(patterns, { cwd: inputRoot, ignore, caseSensitiveMatch: false, absolute: true });
  const normalized = files.map((f) => toDisplayPath(cwd, path.normalize(f)));
  return filterPlannedOutputsFromInputs(normalized, cfg, cwd);
}
