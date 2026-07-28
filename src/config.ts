import fs from 'node:fs';
import path from 'node:path';

export type OutputFormat = 'webp' | 'avif' | 'jpeg' | 'png';

export interface WebimgConfig {
  input?: string;
  output?: string;
  recursive?: boolean;
  formats?: OutputFormat[];
  quality?: number;
  resize?: number | null;
  maxWidth?: number | null;
  responsive?: number[]; // densities like [1,2,3]
  suffix?: string;
  keepMetadata?: boolean;
  keepOriginal?: boolean;
  suppRef?: boolean;
  include?: string[];
  exclude?: string[];
  cache?: boolean;
  dryRun?: boolean;
  backup?: boolean;
  backupDir?: string;
  clean?: boolean;
  concurrency?: number;
}

export const DEFAULT_CONFIG: Required<WebimgConfig> = {
  input: '.',
  output: '',
  recursive: false,
  formats: ['webp'],
  quality: 80,
  resize: null,
  maxWidth: null,
  responsive: [],
  suffix: '',
  keepMetadata: false,
  keepOriginal: true,
  suppRef: false,
  include: [],
  exclude: [],
  cache: true,
  dryRun: false,
  backup: false,
  backupDir: '.webimg-backup',
  clean: false,
  concurrency: 0,
};

const CONFIG_FILES = ['webimg.config.json', '.webimgrc.json', '.webimgrc'];

export function loadConfig(cwd = process.cwd()): WebimgConfig {
  for (const name of CONFIG_FILES) {
    const p = path.join(cwd, name);
    if (fs.existsSync(p)) {
      try {
        const value: unknown = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw new Error(`${name} doit contenir un objet JSON`);
        }
        return value as WebimgConfig;
      } catch (e) {
        throw new Error(`Invalid ${name}: ${(e as Error).message}`);
      }
    }
  }
  return {};
}

export function mergeConfig(...sources: WebimgConfig[]): Required<WebimgConfig> {
  const cfg = Object.assign({}, DEFAULT_CONFIG, ...sources) as Required<WebimgConfig>;
  if (typeof cfg.input !== 'string' || !cfg.input) throw new Error('input invalide');
  if (typeof cfg.output !== 'string') throw new Error('output invalide');
  if (typeof cfg.quality !== 'number' || !Number.isInteger(cfg.quality) || cfg.quality < 1 || cfg.quality > 100) {
    throw new Error('Qualité invalide (1-100)');
  }
  if (!Array.isArray(cfg.formats) || cfg.formats.length === 0 || cfg.formats.some((f) => !['webp', 'avif', 'jpeg', 'png'].includes(f))) {
    throw new Error('formats invalides');
  }
  if (cfg.resize !== null && (!Number.isInteger(cfg.resize) || cfg.resize <= 0)) throw new Error('resize invalide');
  if (cfg.maxWidth !== null && (!Number.isInteger(cfg.maxWidth) || cfg.maxWidth <= 0)) throw new Error('maxWidth invalide');
  if (!Array.isArray(cfg.responsive) || cfg.responsive.some((n) => !Number.isInteger(n) || n <= 0)) throw new Error('responsive invalide');
  for (const key of ['recursive', 'keepMetadata', 'keepOriginal', 'suppRef', 'cache', 'dryRun', 'backup', 'clean'] as const) {
    if (typeof cfg[key] !== 'boolean') throw new Error(`${key} invalide`);
  }
  for (const key of ['include', 'exclude'] as const) {
    if (!Array.isArray(cfg[key]) || cfg[key].some((v) => typeof v !== 'string')) throw new Error(`${key} invalide`);
  }
  if (typeof cfg.suffix !== 'string') throw new Error('suffix invalide');
  if (typeof cfg.backupDir !== 'string' || !cfg.backupDir) throw new Error('backupDir invalide');
  if (typeof cfg.concurrency !== 'number' || !Number.isInteger(cfg.concurrency) || cfg.concurrency < 0) {
    throw new Error('concurrency invalide (entier positif ou 0 pour automatique)');
  }
  return cfg;
}
