import { useTranslation } from './index';

export const commonTranslations = {
  'zh-TW': {
    app_name: "萬用桌遊計分板",
    confirm: "確認",
    cancel: "取消",
    delete: "刪除",
    save: "儲存",
    edit: "編輯",
    copy: "複製",
    download: "下載",
    share: "分享",
    close: "關閉",
    back: "返回",
    reset: "重置",
    restore: "還原",
    loading: "載入中...",
    success: "成功",
    failed: "失敗",
    warning: "警告",
    error: "錯誤",
    info: "資訊",
    none: "無",
    player: "玩家",
    total: "總分",
    winner: "贏家",
    search: "搜尋",
    filter: "篩選",
    ok: "好",
    understand: "我瞭解了",
    select_all: "全選",
    deselect_all: "取消全選",
    retry: "重試",
    add: "新增",
    game: "遊戲",
    location: "地點",
    modal_or: "或",

    // Scoring Rules
    rule_highest_wins: "最高分贏",
    rule_lowest_wins: "最低分贏",
    rule_coop: "合作模式",
    rule_competitive_no_score: "競爭(無勝負)",
    rule_coop_no_score: "合作(無勝負)",
  },
  'en': {
    app_name: "Board Game ScorePad",
    confirm: "Confirm",
    cancel: "Cancel",
    delete: "Delete",
    save: "Save",
    edit: "Edit",
    copy: "Copy",
    download: "Download",
    share: "Share",
    close: "Close",
    back: "Back",
    reset: "Reset",
    restore: "Restore",
    loading: "Loading...",
    success: "Success",
    failed: "Failed",
    warning: "Warning",
    error: "Error",
    info: "Info",
    none: "None",
    player: "Player",
    total: "Total",
    winner: "Winner",
    search: "Search",
    filter: "Filter",
    ok: "OK",
    understand: "I Understand",
    select_all: "Select All",
    deselect_all: "Deselect All",
    retry: "Retry",
    add: "Add",
    game: "Game",
    location: "Location",
    modal_or: "or",

    // Scoring Rules
    rule_highest_wins: "Highest Wins",
    rule_lowest_wins: "Lowest Wins",
    rule_coop: "Cooperative",
    rule_competitive_no_score: "Competitive (No Score)",
    rule_coop_no_score: "Cooperative (No Score)",
  }
};

export type CommonTranslationKey = keyof typeof commonTranslations['zh-TW'];

export const useCommonTranslation = () => {
  const { language } = useTranslation();
  const t = (key: CommonTranslationKey, params?: Record<string, string | number>) => {
    const dict = commonTranslations[language] || commonTranslations['zh-TW'];
    let text = dict[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };
  return { t, language };
};
