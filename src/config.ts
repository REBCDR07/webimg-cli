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
  include?: string[];
  exclude?: string[];
  cache?: boolean;
  dryRun?: boolean;
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
  include: [],
  exclude: [],
  cache: true,
  dryRun: false,
};

const CONFIG_FILES = ['webimg.config.json', '.webimgrc.json', '.webimgrc'];

export function loadConfig(cwd = process.cwd()): WebimgConfig {
  for (const name of CONFIG_FILES) {
    const p = path.join(cwd, name);
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf8')) as WebimgConfig;
      } catch (e) {
        throw new Error(`Invalid ${name}: ${(e as Error).message}`);
      }
    }
  }
  return {};
}

export function mergeConfig(...sources: WebimgConfig[]): Required<WebimgConfig> {
  return Object.assign({}, DEFAULT_CONFIG, ...sources) as Required<WebimgConfig>;
}
