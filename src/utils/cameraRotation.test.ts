import { describe, expect, it } from 'vitest';
import { detectCameraRotation } from './cameraRotation';

describe('camera landscape detection', () => {
  it('enters either landscape direction with weaker gravity than the old fixed threshold', () => {
    expect(detectCameraRotation(0, 4.9, 8.5)).toBe(90);
    expect(detectCameraRotation(0, -4.9, 8.5)).toBe(-90);
    expect(detectCameraRotation(0, 2.4, 1.2)).toBe(90); // Tilted down towards a table.
  });

  it('uses a dead band and retains direction for flat/noisy/missing sensor data', () => {
    expect(detectCameraRotation(0, 3.6, 8)).toBe(0);
    expect(detectCameraRotation(90, 3.6, 8)).toBe(90);
    expect(detectCameraRotation(90, 2.4, 8)).toBe(0);
    for (const [x, y] of [[0.2, 0.1], [0, 0], [null, 8], [NaN, 8], [Infinity, 8]]) {
      expect(detectCameraRotation(-90, x, y)).toBe(-90);
    }
  });
});
