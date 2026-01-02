
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react()
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 獨立打包 html-to-image (截圖功能，體積較大)
            if (id.includes('html-to-image')) {
              return 'utils-vendor';
            }
            // 獨立打包 lucide-react (圖示庫)
            // 注意：必須在檢查 react 之前檢查，因為名稱包含 react
            if (id.includes('lucide-react')) {
              return 'icons-vendor';
            }
            // 獨立打包 React 核心 (最穩定，幾乎不變動)
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
          }
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true, // 允許解析 CSS 以便測試 class 變更
  }
});
