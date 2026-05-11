
import React, { useRef, useState, useEffect } from 'react';
import { X, Upload, Loader2, Database, AlertTriangle, ArrowRight, Globe, Clock, DownloadCloud } from 'lucide-react';
import { useToast } from '../../../hooks/useToast';
import { bggImportService } from '../services/bggImportService';
import { ImportAnalysisReport, ImportManualLinks } from '../../bgstats/types';
import ImportStagingView from '../../bgstats/components/ImportStagingView';
import { useIntegrationTranslation } from '../../../i18n/integration';
import { useCommonTranslation } from '../../../i18n/common';

interface BggImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type ImportState = 'file_selection' | 'analyzing' | 'staging' | 'importing';

// [Config] 預設的 Google Sheet 連結 (作為初始值或 fallback)
const DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/1L_RGm03e07gZc8Di12Tnwk5hbd0BYKvyOng3WY4r3Zs/edit?usp=sharing";
const URL_STORAGE_KEY = 'bgg_import_target_url';
const COOLDOWN_KEY = 'bgg_url_import_last_success';
const COOLDOWN_MINUTES = 5; // [Changed] Shortened to 5 minutes

const BggImportModal: React.FC<BggImportModalProps> = ({ isOpen, onClose }) => {
    const { t } = useIntegrationTranslation();
    const { t: tCommon } = useCommonTranslation();

    const [importState, setImportState] = useState<ImportState>('file_selection');
    const [analysisReport, setAnalysisReport] = useState<ImportAnalysisReport | null>(null);
    const [cooldownRemaining, setCooldownRemaining] = useState<string | null>(null);

    // Track import source to decide whether to trigger cooldown on success
    const [isUrlSource, setIsUrlSource] = useState(false);

    // URL State with persistence
    const [targetUrl, setTargetUrl] = useState(() => {
        return localStorage.getItem(URL_STORAGE_KEY) || DEFAULT_SHEET_URL;
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    useEffect(() => {
        if (!isOpen) {
            setImportState('file_selection');
            setAnalysisReport(null);
            setIsUrlSource(false);
        } else {
            checkCooldown();
        }
    }, [isOpen]);

    // Save URL on change
    useEffect(() => {
        localStorage.setItem(URL_STORAGE_KEY, targetUrl);
    }, [targetUrl]);

    // 檢查冷卻時間
    const checkCooldown = () => {
        const lastSuccessStr = localStorage.getItem(COOLDOWN_KEY);
        if (lastSuccessStr) {
            const lastSuccess = parseInt(lastSuccessStr, 10);
            const now = Date.now();
            const diffMs = now - lastSuccess;
            const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;

            if (diffMs < cooldownMs) {
                const remainingMs = cooldownMs - diffMs;
                const remainingMins = Math.ceil(remainingMs / (60 * 1000));
                setCooldownRemaining(`${remainingMins}m`);
            } else {
                setCooldownRemaining(null);
            }
        } else {
            setCooldownRemaining(null);
        }
    };

    // [Fix] 必須檢查 isOpen，否則會導致 Modal 一直覆蓋在畫面上
    if (!isOpen) return null;

    // 輔助函式：偵測並解碼 ArrayBuffer
    const decodeCSVBuffer = (buffer: ArrayBuffer): string => {
        try {
            // 1. 嘗試以嚴格的 UTF-8 解碼 (fatal: true 會在遇到非 UTF-8 字元時拋錯)
            const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
            return utf8Decoder.decode(buffer);
        } catch (e) {
            // 2. 若失敗，通常是 Windows Excel 的 Big5 編碼
            console.log("[BGG Import] UTF-8 decoding failed, falling back to Big5");
            try {
                const big5Decoder = new TextDecoder('big5');
                return big5Decoder.decode(buffer);
            } catch (e2) {
                // 3. 若 Big5 也失敗，回退到寬鬆 UTF-8
                console.warn("[BGG Import] Big5 decoding failed, falling back to loose UTF-8");
                return new TextDecoder('utf-8').decode(buffer);
            }
        }
    };

    // 智能網址轉換器：將 Google Sheet 的檢視網址轉為 CSV 匯出網址
    const convertGoogleSheetUrl = (url: string): string => {
        // 檢查是否為 Google Sheets 網址
        if (url.includes('docs.google.com/spreadsheets')) {
            // 提取 ID
            const matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (matches && matches[1]) {
                const id = matches[1];
                // 回傳標準匯出格式
                return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
            }
        }
        return url; // 如果不是 Google Sheet 或無法解析，回傳原網址
    };

    const handleUrlImport = async () => {
        if (cooldownRemaining) {
            showToast({ message: t('bgg_msg_cooldown'), type: 'info' });
            return;
        }

        if (!targetUrl.trim()) {
            showToast({ message: t('bgg_msg_invalid_url'), type: 'warning' });
            return;
        }

        setImportState('analyzing');
        setIsUrlSource(true); // Mark as URL source

        try {
            // 1. Convert URL to CSV format if needed
            const finalUrl = convertGoogleSheetUrl(targetUrl);
            console.log("[BGG Import] Fetching from:", finalUrl);

            // 2. Fetch CSV
            const response = await fetch(finalUrl);

            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status}`);
            }

            // 3. Get ArrayBuffer and Decode (Using existing robust logic)
            const buffer = await response.arrayBuffer();
            const text = decodeCSVBuffer(buffer);

            // 4. Analyze
            const report = await bggImportService.analyzeData(text);
            setAnalysisReport(report);
            setImportState('staging');

            // [Updated] Do NOT set cooldown here. Wait for confirm.

        } catch (e: any) {
            console.error("URL Import Failed", e);
            const msg = e.message || t('bgg_msg_download_fail');
            showToast({ message: t('bgg_msg_connect_fail', { msg }), type: 'error' });
            setImportState('file_selection');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportState('analyzing');
        setIsUrlSource(false); // Mark as File source

        const reader = new FileReader();

        reader.onload = async (ev) => {
            try {
                const buffer = ev.target?.result as ArrayBuffer;
                // 使用自定義解碼邏輯處理原始數據
                const text = decodeCSVBuffer(buffer);

                // 1. 分析 CSV 並產生報告
                const report = await bggImportService.analyzeData(text);
                setAnalysisReport(report);
                setImportState('staging');
            } catch (e) {
                console.error(e);
                showToast({ message: t('bgg_msg_import_fail_csv'), type: 'error' });
                setImportState('file_selection');
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };

        // 關鍵：改用 ArrayBuffer 讀取，以保留原始 Byte 供解碼判斷
        reader.readAsArrayBuffer(file);
    };

    const handleStagingConfirm = async (links: ImportManualLinks) => {
        if (!analysisReport) return;

        setImportState('importing');
        try {
            // 2. 執行匯入
            const count = await bggImportService.importData(analysisReport.sourceData, links);
            showToast({ message: t('bgg_msg_import_success', { count }), type: 'success' });

            // [Updated] Set cooldown ONLY if it was a URL import and it succeeded
            if (isUrlSource) {
                localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
                checkCooldown();
            }

            onClose();
        } catch (e) {
            console.error(e);
            showToast({ message: t('bgg_msg_import_error'), type: 'error' });
            setImportState('staging');
        }
    };

    // Full-screen Staging View
    if (importState === 'staging' && analysisReport) {
        return (
            <div className="fixed inset-0 z-[60] bg-app-bg flex flex-col animate-in fade-in duration-200">
                <ImportStagingView
                    report={analysisReport}
                    onConfirm={handleStagingConfirm}
                    onCancel={() => setImportState('file_selection')}
                    isProcessing={false}
                />
            </div>
        );
    }

    // Default Modal Layout for other states
    return (
        <div
            className="fixed inset-0 z-[60] bg-modal-backdrop backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={(e) => {
                if (e.target === e.currentTarget && importState !== 'importing') onClose();
            }}
        >
            <div
                className="modal-container w-full max-w-sm flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {importState === 'importing' || importState === 'analyzing' ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4 modal-bg-elevated">
                        <Loader2 size={48} className="animate-spin text-brand-primary" />
                        <span className="text-txt-primary font-bold">
                            {importState === 'analyzing' ? t('bgg_state_analyzing') : t('bgg_state_importing')}
                        </span>
                        <span className="text-xs text-txt-muted">{t('bgg_state_hint')}</span>
                    </div>
                ) : (
                    <>
                        <div className="modal-bg-elevated p-4 border-b border-surface-border flex items-center justify-between flex-none">
                            <h3 className="text-lg font-bold text-txt-primary flex items-center gap-2">
                                <Database size={20} className="text-brand-secondary" />
                                {t('bgg_import_title')}
                            </h3>
                            <button onClick={onClose} className="text-txt-muted hover:text-txt-primary transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 modal-body">
                            <div className="bg-brand-secondary/10 border border-brand-secondary/30 rounded-xl p-4 text-sm text-brand-secondary leading-relaxed">
                                <p className="flex items-start gap-2">
                                    <AlertTriangle size={16} className="text-brand-secondary shrink-0 mt-0.5" />
                                    {t('bgg_desc_title')}
                                </p>
                                <p className="mt-2 text-xs opacity-70">
                                    {t('bgg_desc_details')}
                                </p>
                            </div>

                            <div className="flex flex-col gap-3">
                                {/* URL Import Input Group */}
                                <div className="flex flex-col gap-1">
                                    <div className="text-xs font-bold text-txt-muted pl-1 uppercase tracking-tight">{t('bgg_cloud_import')}</div>
                                    <div className="modal-bg-recessed rounded-xl border border-surface-border p-1 flex items-center gap-1 shadow-inner focus-within:ring-2 focus-within:ring-status-info focus-within:border-transparent transition-all">
                                        <div className="pl-2 text-txt-muted shrink-0">
                                            <Globe size={16} />
                                        </div>
                                        <input
                                            type="text"
                                            value={targetUrl}
                                            onChange={(e) => setTargetUrl(e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            placeholder={t('bgg_url_placeholder')}
                                            className="flex-1 bg-transparent border-none outline-none text-xs text-txt-primary py-3 font-mono min-w-0"
                                        />
                                        <button
                                            onClick={handleUrlImport}
                                            disabled={!!cooldownRemaining}
                                            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shrink-0 whitespace-nowrap
                                        ${cooldownRemaining
                                                    ? 'bg-surface-bg-alt text-txt-muted cursor-not-allowed border border-surface-border'
                                                    : 'bg-status-info hover:filter hover:brightness-110 text-white shadow-lg'
                                                }
                                    `}
                                        >
                                            {cooldownRemaining ? <Clock size={14} /> : <DownloadCloud size={14} />}
                                            {cooldownRemaining ? cooldownRemaining : t('bgg_btn_update')}
                                        </button>
                                    </div>
                                    <div className="text-[10px] text-txt-muted pl-1">
                                        {cooldownRemaining
                                            ? t('bgg_cooldown_hint', { time: cooldownRemaining })
                                            : t('bgg_cloud_hint')
                                        }
                                    </div>
                                    <div className="mt-1.5 pl-1 flex items-center flex-wrap gap-x-1.5 text-[9px] text-txt-muted/60 border-t border-surface-border/30 pt-1.5">
                                        <span>{t('bgg_cloud_attribution')}</span>
                                        <a 
                                            href="https://boardgamegeek.com" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity"
                                        >
                                            <svg viewBox="0 0 342 76" className="h-4 w-auto shrink-0 text-txt-primary/80 transition-colors" aria-label="BGG Logo">
                                                <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                                                    <g transform="translate(0.654300, 0.296900)">
                                                        <path d="M106.3372,25.7535 C108.0022,25.7535 109.0062,26.8855 108.8182,28.5505 L106.7492,46.8565 C106.5612,48.5195 105.3022,49.6535 103.6372,49.6535 L91.3492,49.6535 C89.6842,49.6535 88.6812,48.5195 88.8682,46.8565 L90.9362,28.5505 C91.1242,26.8855 92.3862,25.7535 94.0502,25.7535 L106.3372,25.7535 Z M119.4023,25.7534 L119.7953,40.7644 L124.7123,25.7534 L129.7763,25.7534 L131.1723,40.3404 L135.0883,25.7534 L140.6113,25.7534 L133.4133,49.6534 L127.9953,49.6534 L125.8183,36.3394 L120.5253,49.6534 L115.2153,49.6534 L113.3823,25.7534 L119.4023,25.7534 Z M160.6848,25.7534 L160.1048,30.8864 L150.6148,30.8864 L150.1418,35.0664 L158.3578,35.0664 L157.7808,40.1644 L149.5668,40.1644 L149.0788,44.4844 L158.5678,44.4844 L157.9848,49.6534 L142.3698,49.6534 L145.0698,25.7534 L160.6848,25.7534 Z M206.2849,25.7534 L205.7049,30.8864 L196.2169,30.8864 L195.7449,35.0664 L203.9599,35.0664 L203.3829,40.1644 L195.1679,40.1644 L194.6809,44.4844 L204.1689,44.4844 L203.5849,49.6534 L187.9719,49.6534 L190.6709,25.7534 L206.2849,25.7534 Z M289.8932,25.7533 C291.8432,25.7533 292.9402,26.9913 292.7412,28.7623 L292.1412,34.0723 C291.9572,35.7023 290.7182,37.2593 288.4632,37.7913 C290.5992,38.3213 291.6692,39.8083 291.4892,41.4033 L290.9012,46.6063 C290.6892,48.4843 289.3182,49.6533 287.3702,49.6533 L272.4642,49.6533 L275.1642,25.7533 L289.8932,25.7533 Z M83.714,25.7529 C85.165,25.7529 86.272,26.9209 86.099,28.4429 L84.711,40.7309 C84.551,42.1469 83.169,43.4219 81.717,43.4219 L73.253,43.4219 L72.55,49.6529 L66.389,49.6529 L69.09,25.7529 L83.714,25.7529 Z M181.6448,25.7537 C183.0968,25.7537 184.2028,26.9207 184.0308,28.4427 L182.7948,39.3847 C182.6308,40.8367 181.2518,42.0747 179.7998,42.0747 L179.6228,42.0747 L181.7048,49.6527 L175.6858,49.6527 L173.5688,42.0747 L170.9478,42.0747 L170.0918,49.6527 L163.9318,49.6527 L166.6318,25.7537 L181.6448,25.7537 Z M225.0852,25.7531 C227.7052,25.7531 229.6932,27.9131 229.3892,30.6031 L227.7892,44.7671 C227.4802,47.4941 225.0062,49.6521 222.3862,49.6521 L209.5312,49.6521 L212.2312,25.7531 L225.0852,25.7531 Z M316.8386,25.7531 L316.2586,30.8871 L305.1746,30.8871 C304.9976,30.8871 304.8016,31.0641 304.7776,31.2761 L304.7776,31.2761 L303.3296,44.0941 C303.3046,44.3071 303.4656,44.4481 303.6426,44.4481 L303.6426,44.4481 L308.6006,44.4481 C308.8476,44.4481 309.0056,44.3071 309.0306,44.0941 L309.0306,44.0941 L309.4866,40.0581 L306.1996,40.0581 L308.7676,34.9941 L315.7196,34.9941 L314.3386,46.9271 C314.1626,48.4841 312.8266,49.6521 311.3046,49.6521 L311.3046,49.6521 L299.3376,49.6521 C297.8136,49.6521 296.7066,48.4841 296.8826,46.9271 L296.8826,46.9271 L298.9716,28.4431 C299.1356,26.9921 300.5136,25.7531 302.0386,25.7531 L302.0386,25.7531 L316.8386,25.7531 Z M340.6911,25.7531 L340.1111,30.8871 L329.0271,30.8871 C328.8501,30.8871 328.6541,31.0641 328.6311,31.2761 L328.6311,31.2761 L327.1821,44.0941 C327.1571,44.3071 327.3181,44.4481 327.4951,44.4481 L327.4951,44.4481 L332.4531,44.4481 C332.6991,44.4481 332.8581,44.3071 332.8831,44.0941 L332.8831,44.0941 L333.3391,40.0581 L330.0521,40.0581 L332.6201,34.9941 L339.5721,34.9941 L338.1911,46.9271 C338.0161,48.4841 336.6791,49.6521 335.1571,49.6521 L335.1571,49.6521 L323.1901,49.6521 C321.6661,49.6521 320.5591,48.4841 320.7341,46.9271 L320.7341,46.9271 L322.8231,28.4431 C322.9881,26.9921 324.3661,25.7531 325.8911,25.7531 L325.8911,25.7531 L340.6911,25.7531 Z M285.2212,39.8443 L279.6972,39.8443 L279.1002,45.1203 L284.6252,45.1203 C284.8732,45.1203 284.9992,44.9443 285.0182,44.7663 L285.5312,40.2343 C285.5512,40.0583 285.4692,39.8443 285.2212,39.8443 Z M248.408,30.5417 C249.576,30.5417 250.234,31.2837 250.114,32.3457 L249.755,35.5287 C249.645,36.5037 248.902,37.4387 247.55,37.7577 C248.83,38.0747 249.473,38.9657 249.363,39.9207 L249.012,43.0397 C248.885,44.1637 248.063,44.8647 246.896,44.8647 L237.963,44.8647 L239.581,30.5417 L248.408,30.5417 Z M257.2558,30.5412 L256.5098,37.1402 C256.4978,37.2472 256.6128,37.3532 256.7188,37.3532 L259.6688,37.3532 C259.7958,37.3532 259.8298,37.2472 259.8418,37.1402 L260.5858,30.5412 L264.2798,30.5412 L263.3268,38.9652 C263.2218,39.8992 262.3918,40.6632 261.5238,40.6632 L259.6338,40.6632 L259.1578,44.8642 L255.4668,44.8642 L255.9418,40.6632 L254.0308,40.6632 C253.1628,40.6632 252.5058,39.8992 252.6118,38.9652 L253.5638,30.5412 L257.2558,30.5412 Z M101.9992,30.9215 L97.1492,30.9215 C97.0072,30.9215 96.8102,31.0995 96.7872,31.3115 L95.3332,44.1645 C95.3132,44.3415 95.4742,44.4845 95.6172,44.4845 L100.4672,44.4845 C100.6792,44.4845 100.8732,44.3415 100.8932,44.1645 L102.3462,31.3115 C102.3692,31.0995 102.2112,30.9215 101.9992,30.9215 Z M221.4962,30.8871 L217.8122,30.8871 L216.2762,44.4841 L219.9602,44.4841 C220.9872,44.4841 221.7752,43.7761 221.8902,42.7481 L223.0352,32.6211 C223.1512,31.5951 222.5232,30.8871 221.4962,30.8871 Z M245.607,38.9877 L242.298,38.9877 L241.939,42.1487 L245.25,42.1487 C245.4,42.1487 245.475,42.0427 245.486,41.9367 L245.793,39.2207 C245.806,39.1147 245.757,38.9877 245.607,38.9877 Z M79.345,30.8869 L74.67,30.8869 L73.826,38.3579 L78.5,38.3579 C78.678,38.3579 78.838,38.1809 78.854,38.0399 L79.623,31.2409 C79.643,31.0649 79.522,30.8869 79.345,30.8869 Z M177.3108,30.8867 L172.2128,30.8867 L171.4928,37.2597 L176.5908,37.2597 C176.7338,37.2597 176.9298,37.0847 176.9448,36.9407 L177.5898,31.2407 C177.6098,31.0637 177.4528,30.8867 177.3108,30.8867 Z M246.24,33.3847 L242.93,33.3847 L242.596,36.3557 L245.904,36.3557 C246.054,36.3557 246.129,36.2497 246.144,36.1227 L246.427,33.6177 C246.439,33.5117 246.39,33.3847 246.24,33.3847 Z M286.2772,30.4963 L280.7552,30.4963 L280.1932,35.4543 L285.7172,35.4543 C285.9662,35.4543 286.0912,35.2763 286.1142,35.0663 L286.5872,30.8873 C286.6062,30.7093 286.5272,30.4963 286.2772,30.4963 Z" fill="currentColor" />
                                                        <polygon fill="#FF5100" points="49.374 13.936 41.903 15.973 49.219 -4.8316906e-13 1.787 17.482 4.379 38.424 -3.37507799e-13 42.651 13.058 75.406 40.813 65.166 50.461 42.483 46.319 38.485" />
                                                        <polygon fill="#FFFFFF" points="15.1196 63.3086 33.8576 44.0036 26.7606 33.4056 34.6816 16.0356 17.2286 34.1636 23.9436 44.2936" />
                                                    </g>
                                                </g>
                                            </svg>
                                        </a>
                                    </div>
                                </div>

                                <div className="relative py-1">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-surface-border"></div></div>
                                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-modal-bg-elevated px-2 text-txt-muted">{tCommon('modal_or')}</span></div>
                                </div>

                                {/* File Import Button */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-3 modal-bg-recessed hover:modal-bg-elevated text-txt-primary font-bold rounded-xl border border-surface-border flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 group"
                                >
                                    <div className="flex items-center gap-2">
                                        <Upload size={18} className="group-hover:scale-110 transition-transform text-brand-primary" />
                                        <span>{t('bgg_btn_select_file')}</span>
                                    </div>
                                    <span className="text-[9px] text-txt-muted font-normal">{t('bgg_file_hint')}</span>
                                </button>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>
                        </div>

                        <div className="p-4 modal-bg-recessed/50 border-t border-surface-border text-center flex-none">
                            <p className="text-[10px] text-txt-muted">
                                {t('bgg_footer')}
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default BggImportModal;
