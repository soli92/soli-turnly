import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['lib/rules/**/*.ts', 'lib/zod/**/*.ts'],
      exclude: ['**/*.test.ts', '**/types.ts'],
      reporter: ['text', 'lcov'],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './') },
  },
});
