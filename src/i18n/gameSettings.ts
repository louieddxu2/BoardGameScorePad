import { useTranslation } from './index';

export const gameSettingsTranslations = {
  'zh-TW': {
    title: "編輯遊戲設置",
    subtitle: "全域設定",
    general_section: "基本資訊",
    bgg_id_label: "BoardGameGeek ID",
    bgg_id_desc: "輸入 BGG ID (數字)，有助於系統識別遊戲並在未來自動獲取封面圖與資訊。",
    colors_section: "玩家代表色",
    colors_desc: "設定此遊戲專用的玩家顏色順序。\n新增玩家時，系統將依此順序自動分配顏色。",
    colors_selected: "已選順序 (點擊移除)",
    colors_palette: "點擊選擇顏色 (依序加入)",
    btn_save: "儲存設定",
    reset_default: "重置為系統預設",
    colors_auto_assign: "(系統自動分配)"
  },
  'en': {
    title: "Game Settings",
    subtitle: "Global Configuration",
    general_section: "General Info",
    bgg_id_label: "BoardGameGeek ID",
    bgg_id_desc: "Enter BGG ID (Number). Helps the system identify the game for future metadata/cover fetching.",
    colors_section: "Player Colors",
    colors_desc: "Set the priority order of player colors for this game.\nNew players will be assigned colors in this sequence.",
    colors_selected: "Selected Order (Tap to remove)",
    colors_palette: "Tap to append color",
    btn_save: "Save Settings",
    reset_default: "Reset to Default",
    colors_auto_assign: "(Auto-assigned)"
  }
};
