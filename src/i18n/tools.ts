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
        picker_who_is_first: "誰是起始玩家？",
        picker_picking: "抽選中...",
        picker_decided: "就決定是你了！",

        // Timer additions
        timer_running: "計時中",
        timer_paused: "已暫停",

        // Team additions
        team_tool: "隊伍分配",
        team_randomize_hint: "點擊按鈕隨機分隊",
        team_not_enough_players: "人數不足 (需 2+)",

        // Misc Tools
        sound_board: "音效板",
        dice_roll_d6: "擲骰子 (D6)",
        counter_title: "計數器",
        counter_reset: "歸零",
        countdown_close: "關閉",
        coin_flip: "擲硬幣",
        coin_result_heads: "正面 (Heads)",
        coin_result_tails: "反面 (Tails)",

        // Selector Prototype
        order_visual_picker: "視覺起始決定器",
        picker_prototype_title: "起始玩家決定器",
        picker_prototype_empty: "按住螢幕，拖曳搖桿選擇身分",
        picker_prototype_start_game: "開始遊戲",
        picker_prototype_restart: "再來一次",
        picker_prototype_draw_order: "抽順位",
        picker_prototype_close: "關閉",
        picker_prototype_selected_players: "已選玩家",
        picker_prototype_random_names: "亞瑟,梅林,史萊姆,哥布林,龍傲天,路人甲,巨石強森,哈利,妙麗,阿呆,胖虎,小夫,靜香,哆啦,勇者,魔王,精靈,矮人",
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
        timer_running: "Running",
        timer_paused: "Paused",

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
        team_tool: "Team Tool",
        team_randomize_hint: "Tap to randomize teams",
        team_not_enough_players: "Not enough players (2+)",

        // Selection / Picker
        picker_title: "First Player Picker",
        picker_start: "Start Picker",
        picker_hint: "Hold screen to pick a player",
        picker_who_is_first: "Who's First?",
        picker_picking: "Picking...",
        picker_decided: "It's You!",

        // Misc Tools
        sound_board: "Soundboard",
        dice_roll_d6: "Roll Dice (D6)",
        counter_title: "Counter",
        counter_reset: "Reset",
        countdown_close: "Close",
        coin_flip: "Flip Coin",
        coin_result_heads: "Heads",
        coin_result_tails: "Tails",

        // Selector Prototype
        order_visual_picker: "Visual Selector",
        picker_prototype_title: "First Player Selector",
        picker_prototype_empty: "Hold screen and drag joystick to select player",
        picker_prototype_start_game: "Start Game",
        picker_prototype_restart: "Restart",
        picker_prototype_draw_order: "Draw Order",
        picker_prototype_close: "Close",
        picker_prototype_selected_players: "Selected Players",
        picker_prototype_random_names: "Arthur,Merlin,Slime,Goblin,Dragon,Passerby,Rock,Harry,Hermione,Dumb,Fatty,Sinyi,Shizuka,Dora,Hero,Demon,Elf,Dwarf",
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
