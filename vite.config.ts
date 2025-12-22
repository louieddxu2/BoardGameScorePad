import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react()
  ],
  // 新增 build 設定
  build: {
    // 關閉 sourcemap 可以防止對 .map 檔案的 404 請求
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true, // 允許解析 CSS 以便測試 class 變更
  }
});