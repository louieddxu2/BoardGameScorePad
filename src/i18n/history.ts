import { useTranslation } from './index';

export const historyTranslations = {
    'zh-TW': {
        history_review_subtitle: "歷史回顧",
        history_edit_info: "編輯紀錄資訊",
        history_share_photo: "分享/照片",
        history_settings_title: "詳細資訊設定",
        history_game_name: "遊戲名稱",
        history_start_time: "開始時間",
        history_end_time: "結束時間",
        history_location: "地點",
        history_location_ph: "例如：家裡、桌遊店...",
        history_rule: "競爭 / 合作模式",
        history_rule_warn: "* 此設定將改變歷史紀錄中的規則標記 (不會自動重算贏家)",
        history_note: "筆記 / 備註",
        history_note_ph: "紀錄這場遊戲的趣事、戰術或心得...",
        history_raw_data: "檢視原始資料結構 (Debug)",
        history_hide_raw: "隱藏原始結構",
        history_update_success: "紀錄已更新",
    },
    'en': {
        history_review_subtitle: "Review",
        history_edit_info: "Edit Info",
        history_share_photo: "Share/Photos",
        history_settings_title: "Record Details",
        history_game_name: "Game Name",
        history_start_time: "Start Time",
        history_end_time: "End Time",
        history_location: "Location",
        history_location_ph: "e.g. Home, Cafe...",
        history_rule: "Mode",
        history_rule_warn: "* Changing this won't re-calculate winners automatically.",
        history_note: "Note",
        history_note_ph: "Write something about the game...",
        history_raw_data: "View Raw Data (Debug)",
        history_hide_raw: "Hide Raw Data",
        history_update_success: "Record Updated",
    }
};

export type HistoryTranslationKey = keyof typeof historyTranslations['zh-TW'];

export const useHistoryTranslation = () => {
    const { language } = useTranslation();
    const t = (key: HistoryTranslationKey, params?: Record<string, string | number>) => {
        const dict = historyTranslations[language] || historyTranslations['zh-TW'];
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
