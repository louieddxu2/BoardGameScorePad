import { useTranslation } from './index';

export const setupTranslations = {
    'zh-TW': {
        setup_last_played: "上次：",
        setup_resume_btn: "繼續\n遊戲",
        setup_or_new: "或是 開始新遊戲",
        setup_time: "遊戲開始時間",
        setup_rule: "勝利條件",
        setup_players: "玩家人數",
        setup_reset_record: "重置記錄",
        setup_and: "並",
        setup_start_btn: "開始計分",
        rule_highest: "競爭：最高分贏",
        rule_lowest: "競爭：最低分贏",
        rule_coop: "合作模式",
        rule_comp_no_score: "競爭(不計勝負)",
        rule_coop_no_score: "合作(不計勝負)",
    },
    'en': {
        setup_last_played: "Last Played:",
        setup_resume_btn: "Resume\nGame",
        setup_or_new: "OR Start New Game",
        setup_time: "Start Time",
        setup_rule: "Win Condition",
        setup_players: "Players",
        setup_reset_record: "Reset Record",
        setup_and: "and",
        setup_start_btn: "Start Scoring",
        rule_highest: "Competitive: Highest Wins",
        rule_lowest: "Competitive: Lowest Wins",
        rule_coop: "Co-op Mode",
        rule_comp_no_score: "Competitive (No Win/Loss)",
        rule_coop_no_score: "Co-op (No Win/Loss)",
    }
};

export type SetupTranslationKey = keyof typeof setupTranslations['zh-TW'];

export const useSetupTranslation = () => {
    const { language } = useTranslation();
    const t = (key: SetupTranslationKey, params?: Record<string, string | number>) => {
        const dict = setupTranslations[language] || setupTranslations['zh-TW'];
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
