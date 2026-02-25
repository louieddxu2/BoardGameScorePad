import { useTranslation } from './index';


export const toolsTranslations = {
    'zh-TW': {
        tools_title: "桌遊工具箱",

        // Order Tool
        order_title: "順位與分組",
        order_shuffle: "重新洗牌",
        order_reset: "重置",
        order_first_player: "起始玩家",

        // Timer / Countdown
        timer_title: "計時器",
        timer_label: "倒計時器",
        timer_start: "開始",
        timer_pause: "暫停",
        timer_reset: "重置",
        timer_stop: "停止",
        timer_warning_hint: "倒數提醒設定",
        timer_unit_min: "分",
        timer_unit_sec: "秒",

        // Memo / Notes
        memo_title: "遊戲紀錄 / 筆記",
        memo_placeholder: "記錄臨時規則、欠款或雜事...",

        // Randomizer
        random_title: "隨機產生器",
        random_dice: "擲骰子",
        random_coin: "擲硬幣",
        random_coin_heads: "正面",
        random_coin_tails: "反面",
        random_rolling: "正在擲...",
        random_hint: "點擊下方按鈕",
        random_result: "結果",

        // Media
        media_camera: "拍照",
        media_screenshot: "截圖",

        // Team Tool
        team_title: "隨機分隊",
        team_count: "隊伍數量",
        team_generate: "產成分隊",

        // Selection / Picker
        picker_title: "誰是起始玩家",
        picker_start: "開始抽取",
        picker_hint: "按住螢幕來選擇玩家",
    },
    'en': {
        tools_title: "Tools",

        // Order Tool
        order_title: "Seat Order & Teams",
        order_shuffle: "Reshuffle",
        order_reset: "Reset",
        order_first_player: "First Player",

        // Timer / Countdown
        timer_title: "Timer",
        timer_label: "Countdown Timer",
        timer_start: "Start",
        timer_pause: "Pause",
        timer_reset: "Reset",
        timer_stop: "Stop",
        timer_warning_hint: "Alert Settings",
        timer_unit_min: "m",
        timer_unit_sec: "s",

        // Memo / Notes
        memo_title: "Game Notes",
        memo_placeholder: "Record rules, debts, or misc...",

        // Randomizer
        random_title: "Randomizer",
        random_dice: "Roll Dice",
        random_coin: "Flip Coin",
        random_coin_heads: "Heads",
        random_coin_tails: "Tails",
        random_rolling: "Rolling...",
        random_hint: "Tap a button below",
        random_result: "Result",

        // Media
        media_camera: "Camera",
        media_screenshot: "Screenshot",

        // Team Tool
        team_title: "Team Generator",
        team_count: "Team Count",
        team_generate: "Generate Teams",

        // Selection / Picker
        picker_title: "First Player Picker",
        picker_start: "Start Picker",
        picker_hint: "Hold screen to pick a player",
    }
};

export type ToolsTranslationKey = keyof typeof toolsTranslations['zh-TW'];

export const useToolsTranslation = () => {
    const { language } = useTranslation();
    const t = (key: ToolsTranslationKey): string => {
        const dict = (toolsTranslations[language] || toolsTranslations['zh-TW']) as any;
        return dict[key] || key;
    };
    return { t, language };
};
