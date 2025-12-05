import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
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
    ],
    define: {
      // 讓原本程式碼中的 process.env.API_KEY 能夠讀取到 Vercel 設定的環境變數
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || process.env.VITE_API_KEY),
    },
  };
});