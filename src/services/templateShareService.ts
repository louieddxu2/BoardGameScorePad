import { GameTemplate } from '../types';

const CLOUD_SHARE_BASE_URL = import.meta.env.VITE_TEMPLATE_SHARE_API_BASE_URL || 'https://scoreboard-api.louieddxu2.workers.dev';
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

type UploadResponse = { id: string; reused?: boolean };
type FetchResponse = { id: string; name: string; payload: unknown; createdAt: number };

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

const getTurnstileToken = async (): Promise<string> => {
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
      action: 'template_share_upload',
      execution: 'render', // Start as soon as rendered
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

import { buildCloudHash } from '../utils/deepLink';

export const buildCloudShareUrl = (cloudId: string, englishName?: string): string => {
  const hash = buildCloudHash(cloudId, englishName);
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}${hash}`;
};

export const uploadTemplateToCloud = async (template: GameTemplate): Promise<UploadResponse> => {
  // Sanitize template: Remove fields that change hash but don't affect structure (deduplication)
  // or that are local-only (privacy/broken links).
  const {
    createdAt: _c,
    updatedAt: _u,
    lastSyncedAt: _s,
    imageId: _i,
    hasImage: _h,
    cloudImageId: _ci,
    ...sanitizedTemplate
  } = template;

  const token = await getTurnstileToken();
  const response = await fetch(`${CLOUD_SHARE_BASE_URL}/api/template/upload`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: sanitizedTemplate.name,
      payload: sanitizedTemplate,
      turnstileToken: token,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`upload_failed_${response.status}_${text}`);
  }

  return response.json() as Promise<UploadResponse>;
};

export const fetchTemplateFromCloud = async (cloudId: string): Promise<FetchResponse | null> => {
  const response = await fetch(`${CLOUD_SHARE_BASE_URL}/api/template/${encodeURIComponent(cloudId)}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`fetch_failed_${response.status}_${text}`);
  }
  return response.json() as Promise<FetchResponse>;
};
