import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'electron/**/*.test.ts'],
    exclude: ['dist/**', 'dist-electron/**', 'release/**', 'node_modules/**']
  }
});
