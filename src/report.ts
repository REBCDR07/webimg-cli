import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import type { ConvertResult } from './convert.js';

export function formatBytes(bytes: number): string {
  const sign = bytes < 0 ? '-' : '';
  const abs = Math.abs(bytes);
  if (abs < 1024) return `${sign}${abs} B`;
  if (abs < 1024 * 1024) return `${sign}${(abs / 1024).toFixed(1)} KB`;
  return `${sign}${(abs / 1024 / 1024).toFixed(2)} MB`;
}

function formatGain(beforeSize: number, afterSize: number, precision = 0): string {
  if (!beforeSize) return '—';
  const savedPercent = ((beforeSize - afterSize) / beforeSize) * 100;
  const sign = savedPercent >= 0 ? '-' : '+';
  return `${sign}${Math.abs(savedPercent).toFixed(precision)}%`;
}

export interface ReportSummary {
  total: number;
  ok: number;
  skipped: number;
  cached: number;
  errors: number;
  dryrun: number;
  totalBefore: number;
  totalAfter: number;
  savedBytes: number;
  savedPercent: number;
  results: ConvertResult[];
}

export function summarize(results: ConvertResult[]): ReportSummary {
  const completed = results.filter((r) => r.status === 'ok' || r.status === 'cached' || r.status === 'skipped');
  const ok = results.filter((r) => r.status === 'ok');
  const beforeBySource = new Map<string, number>();
  for (const r of completed) {
    if (!beforeBySource.has(r.source)) beforeBySource.set(r.source, r.beforeSize);
  }
  const totalBefore = [...beforeBySource.values()].reduce((s, n) => s + n, 0);
  const totalAfter = completed.reduce((s, r) => s + r.afterSize, 0);
  const saved = totalBefore - totalAfter;
  return {
    total: results.length,
    ok: ok.length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    cached: results.filter((r) => r.status === 'cached').length,
    errors: results.filter((r) => r.status === 'error').length,
    dryrun: results.filter((r) => r.status === 'dryrun').length,
    totalBefore,
    totalAfter,
    savedBytes: saved,
    savedPercent: totalBefore > 0 ? (saved / totalBefore) * 100 : 0,
    results,
  };
}

export function printReport(s: ReportSummary): void {
  console.log(`\n📊 ${chalk.bold('Rapport')}`);
  console.log('─'.repeat(78));
  const completed = s.results.filter((r) => r.status === 'ok' || r.status === 'cached' || r.status === 'skipped');
  if (completed.length > 0) {
    console.log(
      chalk.bold(
        'Source'.padEnd(34) + 'Format'.padEnd(8) + 'Avant'.padEnd(12) + 'Après'.padEnd(12) + 'Gain',
      ),
    );
    for (const r of completed) {
      const gain = formatGain(r.beforeSize, r.afterSize);
      const name = r.source.length > 32 ? '…' + r.source.slice(-31) : r.source;
      console.log(
        name.padEnd(34) +
          `${r.format}${r.density > 1 ? '@' + r.density + 'x' : ''}`.padEnd(8) +
          formatBytes(r.beforeSize).padEnd(12) +
          formatBytes(r.afterSize).padEnd(12) +
          chalk.green(gain),
      );
    }
    console.log('─'.repeat(78));
    console.log(
      chalk.bold('TOTAL'.padEnd(42)) +
        formatBytes(s.totalBefore).padEnd(12) +
        formatBytes(s.totalAfter).padEnd(12) +
        chalk.green.bold(formatGain(s.totalBefore, s.totalAfter, 1)),
    );
    console.log(`💾 Économie : ${chalk.green.bold(formatBytes(s.savedBytes))}`);
  }
  console.log('');
  if (s.ok) console.log(`✅ Converties : ${chalk.green(s.ok)}`);
  if (s.cached) console.log(`⚡ Depuis le cache : ${chalk.cyan(s.cached)}`);
  if (s.skipped) console.log(`⏭️  Ignorées (existantes) : ${chalk.yellow(s.skipped)}`);
  if (s.dryrun) console.log(`🔍 Dry-run : ${chalk.blue(s.dryrun)} sortie(s) planifiée(s)`);
  if (s.errors) {
    console.log(`❌ Erreurs : ${chalk.red(s.errors)}`);
    s.results
      .filter((r) => r.status === 'error')
      .forEach((e) => console.log(`   ${chalk.red('•')} ${e.source} → ${e.error}`));
  }
}

export function writeJsonReport(p: string, s: ReportSummary): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(s, null, 2));
}

export function writeMarkdownReport(p: string, s: ReportSummary): void {
  const lines = [
    '# webimg-cli report',
    '',
    `- Converties: **${s.ok}**`,
    `- Depuis cache: ${s.cached}`,
    `- Ignorées: ${s.skipped}`,
    `- Erreurs: ${s.errors}`,
    `- Total avant: ${formatBytes(s.totalBefore)}`,
    `- Total après: ${formatBytes(s.totalAfter)}`,
    `- Économie: **${formatBytes(s.savedBytes)} (-${s.savedPercent.toFixed(1)}%)**`,
    '',
    '| Source | Format | Avant | Après | Gain |',
    '|---|---|---|---|---|',
    ...s.results
      .filter((r) => r.status === 'ok' || r.status === 'cached' || r.status === 'skipped')
      .map((r) => {
        const gain = formatGain(r.beforeSize, r.afterSize);
        return `| ${r.source} | ${r.format}${r.density > 1 ? '@' + r.density + 'x' : ''} | ${formatBytes(r.beforeSize)} | ${formatBytes(r.afterSize)} | ${gain} |`;
      }),
    '',
  ];
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, lines.join('\n'));
}
