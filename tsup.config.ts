import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist/cli',
  clean: true,
  splitting: false,
  sourcemap: false,
  shims: false,
  banner: { js: '#!/usr/bin/env node' },
})
