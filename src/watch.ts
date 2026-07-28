import chokidar from 'chokidar';
import chalk from 'chalk';
import path from 'node:path';
import { ConversionCache } from './cache.js';
import { convertFile } from './convert.js';
import { findImages, SUPPORTED_INPUT } from './scan.js';
import { isSubpath, resolveInputRoot, resolveOutputRoot, toPosixPath } from './paths.js';
import type { WebimgConfig } from './config.js';

export function startWatch(cwd: string, cfg: Required<WebimgConfig>): void {
  const ext = SUPPORTED_INPUT.join('|');
  const re = new RegExp(`\\.(${ext})$`, 'i');
  const cache = new ConversionCache(cwd, cfg.cache);
  const ignored = ['**/node_modules/**', '**/dist/**', '**/.git/**', ...cfg.exclude];
  const inputRoot = resolveInputRoot(cwd, cfg);
  const outputRoot = resolveOutputRoot(cwd, cfg);
  if (outputRoot && isSubpath(inputRoot, outputRoot)) {
    const relFromCwd = path.relative(cwd, outputRoot);
    if (relFromCwd) ignored.push(`${toPosixPath(relFromCwd)}/**`);
  }

  const watcher = chokidar.watch(cfg.input, {
    cwd,
    ignored,
    ignoreInitial: false,
    persistent: true,
    depth: cfg.recursive ? undefined : 0,
  });

  console.log(chalk.blue(`👀 Surveillance de ${path.resolve(cwd, cfg.input)}...`));

  const pending = new Set<string>();
  let running = false;
  const handle = async (file: string) => {
    if (!re.test(file)) return;
    if (pending.has(file)) return;
    pending.add(file);
    if (running) return;
    running = true;
    try {
      while (pending.size) {
        const next = pending.values().next().value as string;
        pending.delete(next);
        await processFile(next);
      }
    } finally {
      running = false;
    }
  };
  const processFile = async (file: string) => {
    const sourcePath = path.resolve(cwd, file);
    const eligible = await findImages(cwd, cfg);
    if (!eligible.some((candidate) => path.resolve(cwd, candidate) === sourcePath)) return;

    const results = await convertFile(sourcePath, cfg, cache, cwd);
    cache.save();
    const ok = results.filter((r) => r.status === 'ok');
    if (ok.length) {
      console.log(chalk.green(`✓ ${file} → ${ok.map((r) => path.basename(r.output)).join(', ')}`));
    }
    results.filter((r) => r.status === 'error').forEach((r) => {
      console.log(chalk.red(`✗ ${file}: ${r.error}`));
    });
  };

  watcher.on('add', handle).on('change', handle);
  process.on('SIGINT', () => {
    watcher.close();
    process.exit(0);
  });
}
