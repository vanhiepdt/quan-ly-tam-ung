import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Next.js đọc alias "@/*" từ tsconfig.json, còn Vitest thì không. Khai báo lại ở đây
// để test dùng được đúng đường dẫn như trong ứng dụng.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'dist/**'],
  },
})
