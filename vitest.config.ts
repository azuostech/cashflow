import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['lib/**/*.test.ts', 'app/api/**/*.test.ts', 'components/**/*.test.ts'],
    exclude: ['node_modules', '.next']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
});
