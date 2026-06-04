import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import cliProgress from 'cli-progress';
import path from 'node:path';
import fs from 'node:fs';
import { findImages } from './scan.js';
import { runParallel } from './convert.js';
import { loadConfig, mergeConfig, DEFAULT_CONFIG, type WebimgConfig, type OutputFormat } from './config.js';
import { summarize, printReport, writeJsonReport, writeMarkdownReport, formatBytes } from './report.js';
import { startWatch } from './watch.js';

const SUPPORTED_OUTPUT: OutputFormat[] = ['webp', 'avif', 'jpeg', 'png'];

function parseFormats(v: string): OutputFormat[] {
  const list = v.split(',').map((s) => s.trim().toLowerCase()) as OutputFormat[];
  for (const f of list) {
    if (!SUPPORTED_OUTPUT.includes(f)) throw new Error(`Format invalide: ${f}`);
  }
  return list;
}

function parseDensities(v: string): number[] {
  return v.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => n > 0);
}

function cliOptionsToConfig(opts: Record<string, unknown>): WebimgConfig {
  const cfg: WebimgConfig = {};
  if (opts.input) cfg.input = String(opts.input);
  if (opts.format) cfg.formats = parseFormats(String(opts.format));
  if (opts.quality !== undefined) cfg.quality = parseInt(String(opts.quality), 10);
  if (opts.recursive !== undefined) cfg.recursive = Boolean(opts.recursive);
  if (opts.output) cfg.output = String(opts.output);
  if (opts.suffix !== undefined) cfg.suffix = String(opts.suffix);
  if (opts.resize) cfg.resize = parseInt(String(opts.resize), 10);
  if (opts.maxWidth) cfg.maxWidth = parseInt(String(opts.maxWidth), 10);
  if (opts.responsive) cfg.responsive = parseDensities(String(opts.responsive));
  if (opts.keepMetadata) cfg.keepMetadata = true;
  if (opts.replace) cfg.keepOriginal = false;
  if (opts.dryRun) cfg.dryRun = true;
  if (opts.cache === false || opts.noCache) cfg.cache = false;
  if (opts.include) cfg.include = String(opts.include).split(',');
  if (opts.exclude) cfg.exclude = String(opts.exclude).split(',');
  return cfg;
}

async function executeRun(cfg: ReturnType<typeof mergeConfig>, cwd: string, reportPath?: string) {
  const images = await findImages(cwd, cfg);
  if (images.length === 0) {
    console.log(chalk.yellow('ℹ️  Aucune image trouvée.'));
    return;
  }
  console.log(chalk.green(`📸 ${images.length} image(s) trouvée(s)`));
  console.log(chalk.gray(`   formats: ${cfg.formats.join(', ')} | qualité: ${cfg.quality}${cfg.dryRun ? ' | DRY-RUN' : ''}`));

  const bar = new cliProgress.SingleBar(
    { format: 'Conversion |{bar}| {percentage}% | {value}/{total}', clearOnComplete: false },
    cliProgress.Presets.shades_classic,
  );
  bar.start(images.length, 0);
  const results = await runParallel(images, cfg, cwd, (done) => bar.update(done));
  bar.stop();

  const summary = summarize(results);
  printReport(summary);

  if (reportPath) {
    if (reportPath.endsWith('.md')) writeMarkdownReport(reportPath, summary);
    else writeJsonReport(reportPath, summary);
    console.log(chalk.gray(`\n📝 Rapport écrit: ${reportPath}`));
  }
}

const program = new Command();
program
  .name('webimg')
  .version('2.0.0')
  .description('CLI ultra-rapide pour optimiser, convertir et générer des images web (WebP/AVIF).');

program
  .command('scan')
  .description('Scanne le dossier et affiche un résumé des images trouvées')
  .option('-i, --input <dir>', 'Dossier à scanner')
  .option('-r, --recursive', 'Scanner récursivement')
  .option('--include <patterns>', 'Patterns glob (séparés par virgule)')
  .option('--exclude <patterns>', 'Patterns à exclure')
  .action(async (opts) => {
    const cwd = process.cwd();
    const cfg = mergeConfig(loadConfig(cwd), cliOptionsToConfig(opts));
    const spinner = ora('Recherche des images...').start();
    const images = await findImages(cwd, cfg);
    spinner.stop();
    if (!images.length) {
      console.log(chalk.yellow('ℹ️  Aucune image trouvée.'));
      return;
    }
    const total = images.reduce((s, f) => s + fs.statSync(f).size, 0);
    console.log(chalk.green(`📸 ${images.length} image(s) — ${formatBytes(total)} au total\n`));
    const byExt: Record<string, number> = {};
    for (const f of images) {
      const e = path.extname(f).slice(1).toLowerCase();
      byExt[e] = (byExt[e] || 0) + 1;
    }
    Object.entries(byExt).forEach(([e, n]) => console.log(`  .${e.padEnd(6)} ${n}`));
  });

program
  .command('run')
  .description('Lance la conversion (mode CI/CD, pas de questions)')
  .option('-i, --input <dir>', 'Dossier à scanner')
  .option('-f, --format <types>', 'Formats (webp,avif,jpeg,png) — séparés par virgule')
  .option('-q, --quality <number>', 'Qualité 1-100')
  .option('-r, --recursive', 'Scanner récursivement')
  .option('-o, --output <dir>', 'Dossier de sortie (préserve l\'arborescence)')
  .option('-s, --suffix <str>', 'Suffixe ajouté au nom de fichier')
  .option('--resize <width>', 'Largeur cible en px (le 1x pour --responsive)')
  .option('--max-width <px>', 'Largeur maximale (ne fait rien si plus petit)')
  .option('--responsive <densities>', 'Densités (ex: 1,2,3) — génère @1x @2x @3x')
  .option('--keep-metadata', 'Conserver les métadonnées EXIF')
  .option('--replace', 'Supprimer le fichier source après conversion')
  .option('--dry-run', 'Simulation sans écriture')
  .option('--no-cache', 'Désactiver le cache de hash')
  .option('--include <patterns>', 'Patterns glob (séparés par virgule)')
  .option('--exclude <patterns>', 'Patterns à exclure')
  .option('--report <path>', 'Écrire un rapport (.json ou .md)')
  .option('--watch', 'Mode surveillance (re-convertit en continu)')
  .action(async (opts) => {
    const cwd = process.cwd();
    try {
      const cfg = mergeConfig(loadConfig(cwd), cliOptionsToConfig(opts));
      if (cfg.quality < 1 || cfg.quality > 100) {
        console.error(chalk.red('Qualité invalide (1-100)'));
        process.exit(1);
      }
      if (opts.watch) {
        startWatch(cwd, cfg);
        return;
      }
      await executeRun(cfg, cwd, opts.report as string | undefined);
    } catch (e) {
      console.error(chalk.red(`Erreur: ${(e as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Crée un fichier webimg.config.json par défaut')
  .action(() => {
    const p = path.join(process.cwd(), 'webimg.config.json');
    if (fs.existsSync(p)) {
      console.log(chalk.yellow('webimg.config.json existe déjà.'));
      return;
    }
    fs.writeFileSync(p, JSON.stringify(DEFAULT_CONFIG, null, 2));
    console.log(chalk.green(`✓ Créé: ${p}`));
  });

// Default interactive command
program.action(async () => {
  console.log(chalk.blue.bold('\n🚀 WebImg CLI\n'));
  const cwd = process.cwd();
  const fileCfg = loadConfig(cwd);

  const { recursive } = await inquirer.prompt([
    { type: 'confirm', name: 'recursive', message: 'Scanner aussi les sous-dossiers ?', default: fileCfg.recursive ?? false },
  ]);
  const baseCfg = mergeConfig(fileCfg, { recursive });

  const spinner = ora('Recherche...').start();
  const images = await findImages(cwd, baseCfg);
  spinner.stop();
  if (!images.length) {
    console.log(chalk.yellow('ℹ️  Aucune image trouvée.'));
    return;
  }
  const total = images.reduce((s, f) => s + fs.statSync(f).size, 0);
  console.log(chalk.green(`📸 ${images.length} image(s) — ${formatBytes(total)}\n`));

  const { proceed } = await inquirer.prompt([
    { type: 'confirm', name: 'proceed', message: 'Lancer la conversion ?', default: true },
  ]);
  if (!proceed) return;

  const answers = await inquirer.prompt([
    { type: 'checkbox', name: 'formats', message: 'Format(s) :', choices: SUPPORTED_OUTPUT, default: fileCfg.formats ?? ['webp'] },
    { type: 'number', name: 'quality', message: 'Qualité (1-100) :', default: fileCfg.quality ?? 80 },
    { type: 'confirm', name: 'responsive', message: 'Générer des variantes responsive (@1x @2x) ?', default: false },
    { type: 'confirm', name: 'stripMeta', message: 'Supprimer les métadonnées EXIF ?', default: true },
  ]);

  const cfg = mergeConfig(fileCfg, {
    recursive,
    formats: answers.formats,
    quality: answers.quality,
    responsive: answers.responsive ? [1, 2] : [],
    keepMetadata: !answers.stripMeta,
  });

  await executeRun(cfg, cwd);
});

program.parseAsync(process.argv).catch((e) => {
  console.error(chalk.red(e.message));
  process.exit(1);
});
