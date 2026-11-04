import { defineConfig, configDefaults } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const package_root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: package_root,
  test: {
    testTimeout: 30000,
    env: {
      CHAT_INPUT_DEFAULT_ROWS: ''
    },
    include: ['tests/**/*.test.js'],
    exclude: [
      ...configDefaults.exclude,
      'tests/feature.test.js',
      'tests/fix-null-pointer.test.js'
    ]
  }
});
