import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    target: 'node18',
    clean: true,
    sourcemap: true,
    banner: { js: '#!/usr/bin/env node' },
  },
  {
    entry: { lib: 'src/lib.ts' },
    format: ['esm'],
    target: 'node18',
    dts: true,
    sourcemap: true,
  },
]);
