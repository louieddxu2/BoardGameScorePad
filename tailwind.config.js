
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          750: '#2d3748',
          850: '#1a202c',
          950: '#0d1117',
        }
      },
      fontFamily: {
        // 簡化版設定：
        // 1. Inter: 保留這個是因為我們有內建它，它的數字顯示(Tabular nums)比系統字更適合計分板。
        // 2. system-ui: 現代瀏覽器的「萬能鑰匙」，它會自動對應到裝置最原生的字體。
        // 3. sans-serif: 萬一 system-ui 失效的最後一道保險。
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
