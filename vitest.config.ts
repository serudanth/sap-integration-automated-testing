import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'dist/**',
        'node_modules/**',
        'src/**/*.test.ts',
        'src/cli/index.ts',
        'src/index.ts',
        'src/types/**',
        'vitest.config.ts'
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 75,
        statements: 90
      }
    }
  }
});
