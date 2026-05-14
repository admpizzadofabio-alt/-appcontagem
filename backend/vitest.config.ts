import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 20000,  // argon2.verify itera N usuários; com 3 seedados leva poucos ms, mas margem de segurança
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/app.ts', 'src/config/**'],
    },
  },
  resolve: {
    alias: {
      '@config': resolve(__dirname, 'src/config'),
      '@modules': resolve(__dirname, 'src/modules'),
      '@middlewares': resolve(__dirname, 'src/middlewares'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
})
