import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    splitting: false,
    sourcemap: true,
    external: ['node:async_hooks', 'node:module'],
    define: {
      'process.env.PACKAGE_VERSION': JSON.stringify(version),
    },
  },
  {
    entry: ['src/cli.ts', 'src/postinstall.ts'],
    format: ['esm'],
    dts: false,
    clean: false,
    splitting: false,
    sourcemap: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
    define: {
      'process.env.PACKAGE_VERSION': JSON.stringify(version),
    },
  },
]);
