
export const COLORS = [
  // --- Tier 1: 基礎玩家色 (高對比，最常見的 8 人局顏色) ---
  'rgb(var(--c-p-emerald))', // Emerald (綠) - 玩家/森林
  'rgb(var(--c-p-blue))',    // Blue (藍) - 玩家/水
  'rgb(var(--c-p-yellow))',  // Yellow (黃) - 玩家/麥子
  'rgb(var(--c-p-red))',     // Red (紅) - 玩家
  'rgb(var(--c-p-orange))',  // Orange (橘) [New] - 玩家/磚頭
  'rgb(var(--c-p-violet))',  // Violet (紫) - 玩家
  'rgb(var(--c-p-black))',   // Black (黑) - 玩家/黑曜石
  'rgb(var(--c-p-white))',   // White (白) - 玩家/綿羊

  // --- Tier 2: 擴充與鮮豔色 (常見於第 5+ 玩家或特殊標記) ---
  'rgb(var(--c-p-pink))',    // Pink (粉紅) - 玩家/豬
  'rgb(var(--c-p-cyan))',    // Cyan (青) [New] - 水晶/鑽石/靈魂
  'rgb(var(--c-p-lime))',    // Lime (萊姆) [New] - 蔬菜/毒藥
  'rgb(var(--c-p-amber))',   // Amber (琥珀) - 黃金/蜂蜜 (比黃色深)
  'rgb(var(--c-p-indigo))',  // Indigo (靛藍) - 魔法/深海

  // --- Tier 3: 材質與自然色 (資源配件常用色) ---
  'rgb(var(--c-p-teal))',    // Teal (松石綠) - 寶石/科技
  'rgb(var(--c-p-brown))',   // Brown (棕) - 木頭/牛
  'rgb(var(--c-p-gray))',    // Gray (灰) - 石頭/銀幣/鐵
  'rgb(var(--c-p-skin))',    // Skin (膚色) - 人類/工人
];

/**
 * [Color Tone Registry]
 * Manually defines which player colors are "dark" or "light" to guide contrast protection.
 * This is more reliable than pure calculation for specific board game palettes.
 */
export const COLOR_TONES: Record<string, 'dark' | 'light' | 'neutral'> = {
  // Dark Tones (Needs white contrast in dark mode)
  '--c-p-black': 'dark',
  '--c-p-brown': 'dark',
  '--c-p-gray': 'dark',
  '--c-p-indigo': 'dark',

  // Light Tones (Needs dark contrast in light mode)
  '--c-p-white': 'light',
  '--c-p-yellow': 'light',
  '--c-p-skin': 'light',
  '--c-p-lime': 'light',
  '--c-p-cyan': 'light',

  // Neutral / Mid-tones
  '--c-p-emerald': 'neutral',
  '--c-p-blue': 'neutral',
  '--c-p-red': 'neutral',
  '--c-p-orange': 'neutral',
  '--c-p-violet': 'neutral',
  '--c-p-pink': 'neutral',
  '--c-p-teal': 'neutral',
  '--c-p-amber': 'neutral',
};
