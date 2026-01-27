
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    // Custom Plugin to strip DEV_ONLY blocks from HTML during build
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        // 只有在 'build' 階段才執行移除動作
        if (command === 'build') {
          // 使用 Regex 移除 <!-- DEV_ONLY_START --> ... <!-- DEV_ONLY_END --> 之間的內容
          return html.replace(/<!-- DEV_ONLY_START -->[\s\S]*?<!-- DEV_ONLY_END -->/g, '');
        }
        return html;
      },
    }
  ],
  build: {
    // 提高警告門檻至 1000kB，避免因第三方套件過大而頻繁警告
    chunkSizeWarningLimit: 1000, 
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 獨立打包 html-to-image (截圖功能，體積較大)
            if (id.includes('html-to-image')) {
              return 'utils-vendor';
            }
            // 獨立打包 lucide-react (圖示庫)
            if (id.includes('lucide-react')) {
              return 'icons-vendor';
            }
            // 獨立打包 React 核心 (最穩定，幾乎不變動)
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            // [新增] 獨立打包 Dexie (資料庫核心)
            if (id.includes('dexie')) {
              return 'db-vendor';
            }
          }
        }
      }
    }
  },
  // @ts-ignore
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true, // 允許解析 CSS 以便測試 class 變更
  }
}));
