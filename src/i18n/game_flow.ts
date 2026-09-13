
import { useTranslation } from './index';

export const gameFlowTranslations = {
  'zh-TW': {
    // Game Setup Modal (Enter Game)
    setup_last_played: "上次：",
    setup_resume_btn: "繼續\n遊戲",
    setup_or_new: "或是 開始新遊戲",
    setup_time: "遊戲開始時間",
    setup_rule: "勝利條件",
    setup_players: "玩家人數",
    setup_reset_record: "重置記錄",
    setup_and: "並",
    setup_start_btn: "開始計分",
    setup_start_new_btn: "開始新遊戲",
    setup_more_players: "...共 {count} 人",

    // Scoring Rules
    rule_highest: "競爭：最高分贏",
    rule_lowest: "競爭：最低分贏",
    rule_coop: "合作模式",
    rule_comp_no_score: "競爭(不計勝負)",
    rule_coop_no_score: "合作(不計勝負)",

    // Session Exit Modal (Exit Game)
    exit_title: "即將返回目錄",
    exit_msg: "遊戲結束了嗎？",
    exit_location_ph: "在哪裡進行遊戲？",
    exit_btn_discard: "捨棄",
    exit_btn_draft: "暫存遊戲",
    exit_btn_draft_sub: "(稍後再玩)",
    exit_btn_finish: "結束遊戲",
    exit_btn_finish_sub: "(儲存紀錄)",

    // Discard Confirmation (Context specific)
    confirm_discard_title: "確定捨棄本局？",
    confirm_discard_msg: "此動作將完全刪除本局遊戲的所有紀錄（包含照片），且無法復原。",

    // Generic used in flow
    delete: "刪除",
    cancel: "取消",
    player_unit: "玩家",
  },
  'en': {
    // Game Setup Modal (Enter Game)
    setup_last_played: "Last played:",
    setup_resume_btn: "Resume\nGame",
    setup_or_new: "OR Start New Game",
    setup_time: "Start Time",
    setup_rule: "Win Condition",
    setup_players: "Players",
    setup_reset_record: "Reset Record",
    setup_and: "and",
    setup_start_btn: "Start Scoring",
    setup_start_new_btn: "Start New Game",
    setup_more_players: "...total {count}",

    // Scoring Rules
    rule_highest: "Competitive: Highest Wins",
    rule_lowest: "Competitive: Lowest Wins",
    rule_coop: "Co-op Mode",
    rule_comp_no_score: "Competitive (No Win/Loss)",
    rule_coop_no_score: "Co-op (No Win/Loss)",

    // Session Exit Modal (Exit Game)
    exit_title: "Return to Menu",
    exit_msg: "Is the game finished?",
    exit_location_ph: "Where did you play?",
    exit_btn_discard: "Discard",
    exit_btn_draft: "Save Draft",
    exit_btn_draft_sub: "(Play Later)",
    exit_btn_finish: "Finish Game",
    exit_btn_finish_sub: "(Save History)",

    // Discard Confirmation (Context specific)
    confirm_discard_title: "Discard Game?",
    confirm_discard_msg: "This will permanently delete this session and all photos. This cannot be undone.",

    // Generic used in flow
    delete: "Delete",
    cancel: "Cancel",
    player_unit: "Players",
  }
};

export type GameFlowTranslationKey = keyof typeof gameFlowTranslations['zh-TW'];

export const useGameFlowTranslation = () => {
  const { language } = useTranslation();
  const t = (key: GameFlowTranslationKey, params?: Record<string, string | number>) => {
    const dict = gameFlowTranslations[language] || gameFlowTranslations['zh-TW'];
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
