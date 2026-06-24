import { describe, expect, it } from 'vitest';
import { getPlatformEnvironment } from './platformEnvironment';

describe('getPlatformEnvironment', () => {
  const iphoneSafari =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

  it('identifies iPhone Safari browser mode', () => {
    expect(getPlatformEnvironment(iphoneSafari, false, false, true)).toEqual({
      isIOS: true,
      isStandalone: false,
      isIOSSafariBrowser: true,
    });
  });

  it('identifies iOS standalone mode from display-mode', () => {
    expect(getPlatformEnvironment(iphoneSafari, true, false, true)).toEqual({
      isIOS: true,
      isStandalone: true,
      isIOSSafariBrowser: false,
    });
  });

  it('identifies legacy iOS standalone mode from navigator.standalone', () => {
    expect(getPlatformEnvironment(iphoneSafari, false, true, true).isStandalone).toBe(true);
  });

  it('does not apply iOS Safari handling to Android Chrome', () => {
    const androidChrome =
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

    expect(getPlatformEnvironment(androidChrome, false, false, true)).toEqual({
      isIOS: false,
      isStandalone: false,
      isIOSSafariBrowser: false,
    });
  });

  it('supports iPadOS desktop user agents with touch input', () => {
    const ipadDesktopUA =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

    expect(getPlatformEnvironment(ipadDesktopUA, false, false, true).isIOS).toBe(true);
  });
});
