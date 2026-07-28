import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { WebimgConfig } from './config.js';

interface CacheEntry {
  hash: string;
  outputs: string[];
  optionsHash?: string;
  mtime: number;
}

const CACHE_FILE = '.webimg-cache.json';

export class ConversionCache {
  private data: Record<string, CacheEntry> = {};
  private file: string;
  private enabled: boolean;
  private cwd: string;

  constructor(cwd: string, enabled = true) {
    this.cwd = cwd;
    this.file = path.join(cwd, CACHE_FILE);
    this.enabled = enabled;
    if (enabled && fs.existsSync(this.file)) {
      try {
        this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      } catch {
        this.data = {};
      }
    }
  }

  static hashFile(filePath: string): string {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha1').update(buf).digest('hex');
  }

  static optionsHash(cfg: Required<WebimgConfig>): string {
    const payload = {
      version: 1,
      formats: cfg.formats,
      quality: cfg.quality,
      resize: cfg.resize,
      maxWidth: cfg.maxWidth,
      responsive: cfg.responsive,
      suffix: cfg.suffix,
      keepMetadata: cfg.keepMetadata,
    };
    return crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');
  }

  private key(filePath: string): string {
    const abs = path.resolve(this.cwd, filePath);
    const rel = path.relative(this.cwd, abs);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return path.normalize(rel);
    return path.normalize(abs);
  }

  private absolute(filePath: string): string {
    return path.resolve(this.cwd, filePath);
  }

  hasEntry(file: string, outputs: string[]): boolean {
    if (!this.enabled) return false;
    const entry = this.data[this.key(file)];
    if (!entry) return false;
    const normalizedOutputs = outputs.map((o) => this.key(o));
    return normalizedOutputs.every((o) => entry.outputs.includes(o));
  }

  isUpToDate(file: string, outputs: string[], optionsHash: string): boolean {
    if (!this.enabled) return false;
    const entry = this.data[this.key(file)];
    if (!entry) return false;
    if (entry.optionsHash !== optionsHash) return false;
    const normalizedOutputs = outputs.map((o) => this.key(o));
    if (!normalizedOutputs.every((o) => entry.outputs.includes(o) && fs.existsSync(this.absolute(o)))) return false;
    const hash = ConversionCache.hashFile(this.absolute(file));
    return hash === entry.hash;
  }

  record(file: string, outputs: string[], optionsHash: string): void {
    if (!this.enabled) return;
    this.data[this.key(file)] = {
      hash: ConversionCache.hashFile(this.absolute(file)),
      outputs: outputs.map((o) => this.key(o)),
      optionsHash,
      mtime: Date.now(),
    };
  }

  save(): void {
    if (!this.enabled) return;
    const temporary = `${this.file}.${process.pid}.${Date.now()}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(this.data, null, 2));
      fs.renameSync(temporary, this.file);
    } finally {
      try { fs.unlinkSync(temporary); } catch { /* already renamed */ }
    }
  }
}
