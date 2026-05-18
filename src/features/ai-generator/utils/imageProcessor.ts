
/**
 * 高效前端圖片處理器
 * 功能：自動縮放與降低品質，生成專用於 AI 辨識的輕量級 Blob，提升傳輸速度。
 */

const MAX_DIMENSION = 1200; // AI 辨識足夠的寬度
const JPEG_QUALITY = 0.7;   // 大幅減小體積但保留特徵

/**
 * 將使用者選取的圖片 File 壓縮並縮放，輸出為 JPEG Blob
 */
export const compressImageForAi = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // 1. 計算等比例縮放後的尺寸
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_DIMENSION) {
                        height = Math.round((height * MAX_DIMENSION) / width);
                        width = MAX_DIMENSION;
                    }
                } else {
                    if (height > MAX_DIMENSION) {
                        width = Math.round((width * MAX_DIMENSION) / height);
                        height = MAX_DIMENSION;
                    }
                }

                // 2. 建立 Canvas 畫布
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    reject(new Error("Failed to get canvas 2d context"));
                    return;
                }

                // 3. 繪製圖片
                // 強制底色為白色 (避免 PNG 透明區域在轉 JPEG 時變黑)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                // 4. 轉換為輕量化 JPEG Blob
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            console.log(`[ImageProcessor] Compressed from ${Math.round(file.size / 1024)}KB to ${Math.round(blob.size / 1024)}KB`);
                            resolve(blob);
                        } else {
                            reject(new Error("Canvas compression returned null"));
                        }
                    },
                    'image/jpeg',
                    JPEG_QUALITY
                );
            };
            img.onerror = reject;
            img.src = event.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};
