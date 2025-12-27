
// --- 矩陣運算 (Homography Solver) ---

/**
 * 計算透視變換矩陣 (Homography Matrix)
 * 將來源四點 (src) 映射到目標四點 (dst)
 * 回傳 9 個元素的陣列 [h0, h1, h2, h3, h4, h5, h6, h7, 1]
 */
export function getPerspectiveTransform(src: {x:number, y:number}[], dst: {x:number, y:number}[]) {
  // Gaussian Elimination 解 8 變數線性方程組
  
  let a: number[][] = [];
  let b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const s = src[i];
    const d = dst[i];
    a.push([s.x, s.y, 1, 0, 0, 0, -s.x * d.x, -s.y * d.x]);
    b.push(d.x);
    a.push([0, 0, 0, s.x, s.y, 1, -s.x * d.y, -s.y * d.y]);
    b.push(d.y);
  }

  const n = 8;
  for (let i = 0; i < n; i++) {
    let maxEl = Math.abs(a[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(a[k][i]) > maxEl) {
        maxEl = Math.abs(a[k][i]);
        maxRow = k;
      }
    }

    for (let k = i; k < n; k++) {
      const tmp = a[maxRow][k];
      a[maxRow][k] = a[i][k];
      a[i][k] = tmp;
    }
    const tmp = b[maxRow];
    b[maxRow] = b[i];
    b[i] = tmp;

    for (let k = i + 1; k < n; k++) {
      const c = -a[k][i] / a[i][i];
      for (let j = i; j < n; j++) {
        if (i === j) {
          a[k][j] = 0;
        } else {
          a[k][j] += c * a[i][j];
        }
      }
      b[k] += c * b[i];
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i > -1; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
        sum += a[i][j] * x[j];
    }
    x[i] = (b[i] - sum) / a[i][i];
  }

  return [...x, 1]; 
}

/**
 * 應用透視變換 (Pure JS Backward Mapping)
 */
export function warpPerspective(
  srcCtx: CanvasRenderingContext2D,
  dstCtx: CanvasRenderingContext2D,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
  h: number[]
) {
  const srcImageData = srcCtx.getImageData(0, 0, srcWidth, srcHeight);
  const dstImageData = dstCtx.createImageData(dstWidth, dstHeight);
  
  const srcPixels = srcImageData.data;
  const dstPixels = dstImageData.data;

  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      const denominator = h[6] * x + h[7] * y + h[8];
      const srcX = (h[0] * x + h[1] * y + h[2]) / denominator;
      const srcY = (h[3] * x + h[4] * y + h[5]) / denominator;

      const dstIdx = (y * dstWidth + x) * 4;

      if (srcX >= 0 && srcX < srcWidth && srcY >= 0 && srcY < srcHeight) {
        const sx = Math.floor(srcX);
        const sy = Math.floor(srcY);
        const srcIdx = (sy * srcWidth + sx) * 4;

        dstPixels[dstIdx] = srcPixels[srcIdx];     
        dstPixels[dstIdx + 1] = srcPixels[srcIdx + 1]; 
        dstPixels[dstIdx + 2] = srcPixels[srcIdx + 2]; 
        dstPixels[dstIdx + 3] = 255;               
      } else {
        dstPixels[dstIdx + 3] = 0;
      }
    }
  }
  
  dstCtx.putImageData(dstImageData, 0, 0);
}


// --- 影像處理 (Magnetic Snapping & Edge Detection) ---

/**
 * 計算梯度重心 (Gradient Centroid)
 * 用於「直線吸附」：找出局部區域內最強邊緣的中心位置。
 * 這能讓使用者的手指自動「滑」到線條上。
 */
export function snapToEdge(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number = 15
): { x: number, y: number } | null {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const sx = Math.max(0, ix - radius);
    const sy = Math.max(0, iy - radius);
    const sw = Math.min(width - sx, radius * 2);
    const sh = Math.min(height - sy, radius * 2);

    if (sw <= 0 || sh <= 0) return null;

    const imageData = ctx.getImageData(sx, sy, sw, sh);
    const data = imageData.data;

    let totalMag = 0;
    let sumX = 0;
    let sumY = 0;
    
    const getLum = (idx: number) => (data[idx] + data[idx+1] + data[idx+2]) / 3;

    // 計算 Center of Mass of Gradients
    for (let py = 1; py < sh - 1; py++) {
        for (let px = 1; px < sw - 1; px++) {
            const idx = (py * sw + px) * 4;
            
            const val_L = getLum(idx - 4);
            const val_R = getLum(idx + 4);
            const val_T = getLum(idx - sw * 4);
            const val_B = getLum(idx + sw * 4);

            const gx = Math.abs(val_R - val_L);
            const gy = Math.abs(val_B - val_T);
            const mag = Math.sqrt(gx*gx + gy*gy);

            // 只考慮強邊緣，濾除紋理雜訊
            if (mag > 50) { 
                // Weight distance from center (optional, keeps it local)
                // const dist = Math.sqrt(Math.pow(px - radius, 2) + Math.pow(py - radius, 2));
                // const weight = mag / (dist + 1);
                
                // Using Magnitude squared gives stronger pull to sharper edges
                const weight = mag * mag; 

                sumX += px * weight;
                sumY += py * weight;
                totalMag += weight;
            }
        }
    }

    if (totalMag < 10000) return null; // 區域內沒有足夠明顯的線條

    const centroidX = sx + (sumX / totalMag);
    const centroidY = sy + (sumY / totalMag);

    return { x: centroidX, y: centroidY };
}

/**
 * 計算某個點周圍的主導邊緣角度
 */
function getLocalEdgeDirections(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    cx: number, // local coordinates
    cy: number
): number[] {
    const bins = new Float32Array(36); // 180 degrees, 5-degree bins
    const windowSize = 5; 
    
    const getLum = (idx: number) => (data[idx] + data[idx+1] + data[idx+2]) / 3;
    let totalSignificantGradient = 0;

    for (let y = -windowSize; y <= windowSize; y++) {
        for (let x = -windowSize; x <= windowSize; x++) {
            const px = cx + x;
            const py = cy + y;
            if (px < 1 || px >= width - 1 || py < 1 || py >= height - 1) continue;

            const idx = (py * width + px) * 4;
            
            const val_L = getLum(idx - 4);
            const val_R = getLum(idx + 4);
            const val_T = getLum(idx - width * 4);
            const val_B = getLum(idx + width * 4);

            const gx = val_R - val_L;
            const gy = val_B - val_T;
            
            const mag = Math.sqrt(gx*gx + gy*gy);
            
            // Increased threshold to reduce noise from paper texture
            if (mag > 60) {
                totalSignificantGradient += mag;
                let angle = Math.atan2(gy, gx) * (180 / Math.PI);
                angle += 90; // Convert normal to tangent
                while (angle < 0) angle += 180;
                while (angle >= 180) angle -= 180;
                
                const binIdx = Math.floor(angle / 5) % 36;
                bins[binIdx] += mag; 
            }
        }
    }

    // 如果該區域太「平坦」（沒有明顯特徵），不要回傳隨機角度
    if (totalSignificantGradient < 500) {
        return []; // 表示無明顯方向
    }

    const peaks: {idx: number, score: number}[] = [];
    for (let i = 0; i < 36; i++) {
        const prev = bins[(i - 1 + 36) % 36];
        const curr = bins[i];
        const next = bins[(i + 1) % 36];
        if (curr > prev && curr > next && curr > 200) { 
            peaks.push({ idx: i, score: curr });
        }
    }

    peaks.sort((a, b) => b.score - a.score);

    const resultAngles: number[] = [];
    for (const peak of peaks) {
        if (resultAngles.length >= 2) break;
        const angle = peak.idx * 5 + 2.5; 
        const isDistinct = resultAngles.every(existing => {
            let diff = Math.abs(existing - angle);
            if (diff > 90) diff = 180 - diff;
            return diff > 20; 
        });
        if (isDistinct) resultAngles.push(angle);
    }

    return resultAngles;
}

/**
 * 取得指定座標點的邊緣角度 (無吸附，僅分析)
 */
export function getEdgeAngles(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number = 15
): number[] {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  
  const ix = Math.floor(x);
  const iy = Math.floor(y);

  const sx = Math.max(0, ix - radius);
  const sy = Math.max(0, iy - radius);
  const ex = Math.min(width, ix + radius);
  const ey = Math.min(height, iy + radius);
  const sw = ex - sx;
  const sh = ey - sy;

  if (sw <= 0 || sh <= 0) return [0, 90];

  const imageData = ctx.getImageData(sx, sy, sw, sh);
  const cx = ix - sx;
  const cy = iy - sy;

  const angles = getLocalEdgeDirections(imageData.data, sw, sh, cx, cy);
  // 如果沒有找到明顯角度，回傳預設十字線 [0, 90]
  return angles.length > 0 ? angles : [0, 90];
}

/**
 * 尋找區域內梯度最強的點 (Corner Snap)
 */
export function findStrongestCorner(
  ctx: CanvasRenderingContext2D, 
  centerX: number, 
  centerY: number, 
  radius: number = 20
): { x: number, y: number, angles: number[] } | null {
  
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  
  const sx = Math.max(0, Math.floor(centerX - radius));
  const sy = Math.max(0, Math.floor(centerY - radius));
  const sw = Math.min(width - sx, radius * 2);
  const sh = Math.min(height - sy, radius * 2);
  
  if (sw <= 0 || sh <= 0) return null;

  const imageData = ctx.getImageData(sx, sy, sw, sh);
  const data = imageData.data;
  
  let maxScore = -1;
  let bestLocalX = radius;
  let bestLocalY = radius;

  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const i = (y * sw + x) * 4;
      const getLum = (offset: number) => (data[offset] + data[offset+1] + data[offset+2]) / 3;
      const val_L  = getLum(i - 4);
      const val_R  = getLum(i + 4);
      const val_T  = getLum(i - sw * 4);
      const val_B  = getLum(i + sw * 4);
      
      const gx = Math.abs(val_R - val_L);
      const gy = Math.abs(val_B - val_T);
      
      const magnitude = gx + gy; 
      const cornerBonus = Math.min(gx, gy) * 2; 
      
      const dist = Math.sqrt(Math.pow(x - radius, 2) + Math.pow(y - radius, 2));
      const distPenalty = dist * 2; 

      const score = magnitude + cornerBonus - distPenalty;

      if (score > maxScore) {
        maxScore = score;
        bestLocalX = x;
        bestLocalY = y;
      }
    }
  }

  if (maxScore < 150) return null; // 提高 Corner 門檻

  const angles = getLocalEdgeDirections(data, sw, sh, bestLocalX, bestLocalY);

  return { 
      x: sx + bestLocalX, 
      y: sy + bestLocalY,
      angles: angles.length > 0 ? angles : [0, 90]
  };
}

/**
 * 計算平行四邊形的第 4 個點 (幾何吸附)
 */
export function calculateParallelogramPoint(points: {x:number, y:number}[], activeIdx: number): {x:number, y:number} | null {
    if (points.length !== 4) return null;
    
    const oppositeIdx = (activeIdx + 2) % 4;
    const neighbor1Idx = (activeIdx + 1) % 4;
    const neighbor3Idx = (activeIdx + 3) % 4;
    
    const pOpposite = points[oppositeIdx];
    const pN1 = points[neighbor1Idx];
    const pN3 = points[neighbor3Idx];
    
    return {
        x: pN1.x + pN3.x - pOpposite.x,
        y: pN1.y + pN3.y - pOpposite.y
    };
}
