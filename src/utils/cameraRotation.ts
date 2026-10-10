export type CameraRotation = 0 | 90 | -90;

/** Gravity projected onto the screen plane, with a landscape-biased dead band. */
export const detectCameraRotation = (
  previous: CameraRotation,
  x: number | null | undefined,
  y: number | null | undefined,
): CameraRotation => {
  if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) return previous;
  // Near-flat devices have too little in-plane gravity to infer their heading.
  if (Math.hypot(x, y) < 2) return previous;
  const horizontal = Math.abs(x);
  const vertical = Math.abs(y);
  // Enter landscape at ~27° from portrait; return below ~19° to avoid jitter.
  if (horizontal >= vertical * 0.5) return x > 0 ? 90 : -90;
  if (horizontal < vertical * 0.35) return 0;
  return previous;
};
