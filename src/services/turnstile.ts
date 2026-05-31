const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      execute: (widgetId: string) => void;
    };
  }
}

let turnstileScriptPromise: Promise<void> | null = null;

const loadTurnstileScript = (): Promise<void> => {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('turnstile_script_failed')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('turnstile_script_failed'));
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
};

export const getTurnstileToken = async (action: string): Promise<string> => {
  if (import.meta.env.MODE === 'test') {
    return `test-token-${action}`;
  }

  if (!TURNSTILE_SITE_KEY) {
    throw new Error('turnstile_site_key_missing');
  }

  await loadTurnstileScript();
  if (!window.turnstile) {
    throw new Error('turnstile_not_ready');
  }

  return new Promise((resolve, reject) => {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    document.body.appendChild(container);

    let settled = false;
    let widgetId = '';

    const cleanup = () => {
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
      container.remove();
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };

    widgetId = window.turnstile!.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      action,
      execution: 'render',
      callback: (token: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(token);
      },
      'error-callback': () => fail('turnstile_failed'),
      'expired-callback': () => fail('turnstile_expired'),
    });

    setTimeout(() => fail('turnstile_timeout'), 45000);
  });
};
