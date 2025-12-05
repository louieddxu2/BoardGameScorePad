import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // 這個外掛負責把根目錄的 PWA 檔案複製到打包後的 dist 資料夾
    viteStaticCopy({
      targets: [
        {
          src: 'manifest.json',
          dest: '.'
        },
        {
          src: 'sw.js',
          dest: '.'
        },
        // 如果您有圖標檔案，例如 pwa-192x192.png，請確保它們也在這裡
        {
          src: '*.png',
          dest: '.'
        }
      ]
    })
  ]
});
