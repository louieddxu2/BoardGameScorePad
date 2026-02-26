import { useTranslation } from './index';

export const scannerTranslations = {
    'zh-TW': {
        scan_title: "矩形校正",
        scan_source_title: "請選擇圖片來源",
        scan_btn_camera: "拍攝照片",
        scan_btn_upload: "從相簿上傳",
        scan_hint: "提示：拍攝時請盡量保持光線充足，並垂直拍攝計分表。",
        scan_drag_hint: "拖曳4個點到計分紙角落",
        scan_snap_geo: "幾何吸附",
        scan_snap_line: "直線吸附",
        scan_snap_free: "自由移動",
        scan_btn_snap: "吸附",
        scan_btn_center: "置中",
        scan_btn_retake: "重拍",
        scan_btn_rotate: "旋轉",
        scan_preview_title: "預覽與確認",
        scan_btn_back: "返回調整",
        scan_btn_save_img: "儲存圖片",
        mapper_step1: "步驟 1/2 : 調整網格",
        mapper_step2: "步驟 2/2 : 定義結構",
        mapper_step1_desc: "拖曳四邊邊界裁切，再對齊內部線條。",
        mapper_step2_desc: "預覽項目分割，或點擊「匯入設定」套用規則。",
        mapper_drag_desc: "單指平移 • 雙指縮放 • 拖曳線條",
        mapper_btn_reset: "重置視角",
        mapper_btn_add_row: "新增橫列",
        mapper_btn_next: "下一步",
        mapper_btn_back_grid: "返回網格",
        mapper_btn_cancel_import: "取消匯入",
        mapper_btn_import: "匯入設定",
        mapper_btn_finish: "完成",
        mapper_import_title: "搜尋現有模板...",
        mapper_import_count: "{count}個項目",
        mapper_bound_top: "頂部邊界",
        mapper_bound_bottom: "底部邊界",
        mapper_bound_left: "左邊界",
        mapper_bound_right: "右邊界",
        mapper_col_item: "項目右邊界",
        mapper_col_p1: "首位玩家欄右邊界",
        mapper_struct_name: "玩家名稱",
        mapper_struct_total: "總分合計",
        mapper_struct_empty: "空",
        mapper_struct_clear: "清空此列",
        mapper_success: "模板建立成功",
        mapper_success_msg: "已套用計分紙紋理！",

        // New additions
        scan_share_title: "已校正計分表",
        scan_preview_alt: "校正結果",
        scan_btn_save_device_title: "儲存圖片到裝置",
        scan_btn_edit_grid: "修改網格",
        scan_source_or: "或",

        camera_toast_auto_rotate: "已啟用自動旋轉偵測",
        camera_toast_access_denied: "相機存取被拒。",
        camera_toast_no_device: "找不到相機裝置。",
        camera_toast_start_failed: "無法啟動相機。",
        camera_auto_save: "拍照後自動儲存",
    },
    'en': {
        scan_title: "Rectify Image",
        scan_source_title: "Select Image Source",
        scan_btn_camera: "Take Photo",
        scan_btn_upload: "Upload Image",
        scan_hint: "Tip: Ensure good lighting and take photos from top-down view.",
        scan_drag_hint: "Drag 4 corners to the sheet",
        scan_snap_geo: "Geo Snap",
        scan_snap_line: "Line Snap",
        scan_snap_free: "Free Move",
        scan_btn_snap: "Snap",
        scan_btn_center: "Center",
        scan_btn_retake: "Retake",
        scan_btn_rotate: "Rotate",
        scan_preview_title: "Preview & Confirm",
        scan_btn_back: "Back",
        scan_btn_save_img: "Save Image",
        mapper_step1: "Step 1/2: Grid",
        mapper_step2: "Step 2/2: Structure",
        mapper_step1_desc: "Crop boundaries, then align internal lines.",
        mapper_step2_desc: "Preview split items, or import settings.",
        mapper_drag_desc: "1-Finger Pan • 2-Finger Zoom • Drag Lines",
        mapper_btn_reset: "Reset View",
        mapper_btn_add_row: "Add Row",
        mapper_btn_next: "Next",
        mapper_btn_back_grid: "Back to Grid",
        mapper_btn_cancel_import: "Cancel Import",
        mapper_btn_import: "Import Settings",
        mapper_btn_finish: "Finish",
        mapper_import_title: "Search Templates...",
        mapper_import_count: "{count} items",
        mapper_bound_top: "Top",
        mapper_bound_bottom: "Bottom",
        mapper_bound_left: "Left",
        mapper_bound_right: "Right",
        mapper_col_item: "Item Col Right",
        mapper_col_p1: "P1 Col Right",
        mapper_struct_name: "PLAYER NAMES",
        mapper_struct_total: "TOTAL SCORE",
        mapper_struct_empty: "Empty",
        mapper_struct_clear: "Clear Row",
        mapper_success: "Template Created",
        mapper_success_msg: "Texture applied successfully!",

        // New additions
        scan_share_title: "Rectified Score Sheet",
        scan_preview_alt: "Rectified Result",
        scan_btn_save_device_title: "Save image to device",
        scan_btn_edit_grid: "Edit Grid",
        scan_source_or: "OR",

        camera_toast_auto_rotate: "Auto-rotation detection enabled",
        camera_toast_access_denied: "Camera access denied.",
        camera_toast_no_device: "No camera device found.",
        camera_toast_start_failed: "Failed to start camera.",
        camera_auto_save: "Auto-save after capture",
    }
};

export type ScannerTranslationKey = keyof typeof scannerTranslations['zh-TW'];

export const useScannerTranslation = () => {
    const { language } = useTranslation();
    const t = (key: ScannerTranslationKey, params?: Record<string, string | number>) => {
        const dict = scannerTranslations[language] || scannerTranslations['zh-TW'];
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
