import path from 'node:path';
import type { OutputFormat, WebimgConfig } from './config.js';

export interface PlannedOutput {
  output: string;
  format: OutputFormat;
  density: number;
  width?: number;
}

export function resolveInputRoot(cwd: string, cfg: Pick<Required<WebimgConfig>, 'input'>): string {
  return path.resolve(cwd, cfg.input || '.');
}

export function resolveOutputRoot(cwd: string, cfg: Pick<Required<WebimgConfig>, 'output'>): string | null {
  return cfg.output ? path.resolve(cwd, cfg.output) : null;
}

export function isSubpath(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function toPosixPath(p: string): string {
  return p.split(path.sep).join('/');
}

export function toDisplayPath(cwd: string, file: string): string {
  const abs = path.resolve(cwd, file);
  const rel = path.relative(cwd, abs);
  if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return path.normalize(rel);
  if (rel === '') return '.';
  return path.normalize(abs);
}

function relativeDirFromInput(sourcePath: string, cwd: string, cfg: Pick<Required<WebimgConfig>, 'input'>): string {
  const sourceDir = path.dirname(sourcePath);
  const inputRoot = resolveInputRoot(cwd, cfg);
  const relFromInput = path.relative(inputRoot, sourceDir);

  if (relFromInput === '') return '';
  if (!relFromInput.startsWith('..') && !path.isAbsolute(relFromInput)) return relFromInput;

  const relFromCwd = path.relative(cwd, sourceDir);
  if (relFromCwd === '' || (!relFromCwd.startsWith('..') && !path.isAbsolute(relFromCwd))) return relFromCwd;

  return '';
}

export function planOutputs(
  source: string,
  cfg: Pick<Required<WebimgConfig>, 'input' | 'output' | 'formats' | 'responsive' | 'resize' | 'suffix'>,
  cwd: string,
): PlannedOutput[] {
  const sourcePath = path.resolve(cwd, source);
  const ext = path.extname(sourcePath);
  const baseName = path.basename(sourcePath, ext);
  const outputRoot = resolveOutputRoot(cwd, cfg);
  const dir = outputRoot ? path.join(outputRoot, relativeDirFromInput(sourcePath, cwd, cfg)) : path.dirname(sourcePath);
  const densities = cfg.responsive.length ? cfg.responsive : [1];

  const results: PlannedOutput[] = [];
  for (const fmt of cfg.formats) {
    for (const d of densities) {
      const dSuffix = densities.length > 1 ? `@${d}x` : '';
      const name = `${baseName}${cfg.suffix}${dSuffix}.${fmt}`;
      results.push({
        output: path.join(dir, name),
        format: fmt,
        density: d,
        width: cfg.resize ? cfg.resize * d : undefined,
      });
    }
  }
  return results;
}

export function filterPlannedOutputsFromInputs(
  files: string[],
  cfg: Pick<Required<WebimgConfig>, 'input' | 'output' | 'formats' | 'responsive' | 'resize' | 'suffix'>,
  cwd: string,
): string[] {
  const inputPaths = files.map((file) => path.resolve(cwd, file));
  const inputSet = new Set(inputPaths);
  const generatedOutputs = new Set<string>();
  const outputFormats = new Set<string>(cfg.formats);
  const groups = new Map<string, string[]>();

  for (const source of inputPaths) {
    const ext = path.extname(source).slice(1).toLowerCase();
    const base = path.basename(source, path.extname(source));
    const key = `${path.dirname(source)}\0${base}`;
    groups.set(key, [...(groups.get(key) ?? []), source]);

    if (outputFormats.has(ext) && /@\d+x$/i.test(base)) generatedOutputs.add(source);

    for (const out of planOutputs(source, cfg, cwd)) {
      const outputPath = path.resolve(cwd, out.output);
      if (outputPath !== source && inputSet.has(outputPath)) generatedOutputs.add(outputPath);
    }
  }

  for (const group of groups.values()) {
    const hasSourceSibling = group.some((file) => !outputFormats.has(path.extname(file).slice(1).toLowerCase()));
    if (!hasSourceSibling) continue;

    for (const file of group) {
      const ext = path.extname(file).slice(1).toLowerCase();
      if (outputFormats.has(ext)) generatedOutputs.add(file);
    }
  }

  return inputPaths.filter((file) => !generatedOutputs.has(file)).map((file) => toDisplayPath(cwd, file));
}
