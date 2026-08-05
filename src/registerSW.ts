/// <reference types="vite/client" />

type SwRuntime = {
    env: { PROD: boolean; DEV: boolean };
    navigatorObj: Navigator;
    windowObj: Window;
};

type ScorePadWindow = Window & {
    __boardGameScorePadMultiplayerActive?: boolean;
};

const MULTIPLAYER_STATE_CHANGE_EVENT = 'boardgame-scorepad-multiplayer-state-change';

export function registerServiceWorker(runtime?: Partial<SwRuntime>) {
    const env = runtime?.env ?? import.meta.env;
    const navigatorObj = runtime?.navigatorObj ?? navigator;
    const windowObj = runtime?.windowObj ?? window;

    if (env.PROD && 'serviceWorker' in navigatorObj) {
        // 監聽 controllerchange 事件，當新的 Service Worker 取得控制權時自動重新整理
        const scorePadWindow = windowObj as ScorePadWindow;
        const hasActiveMultiplayerRoom = () => {
            const hasRoomQuery = typeof scorePadWindow.location?.search === 'string'
                && Boolean(new URLSearchParams(scorePadWindow.location.search).get('room'));
            return hasRoomQuery || scorePadWindow.__boardGameScorePadMultiplayerActive === true;
        };

        let refreshing = false;
        let reloadPending = false;
        const reloadWhenSafe = () => {
            if (refreshing) return;
            if (hasActiveMultiplayerRoom()) {
                reloadPending = true;
                return;
            }
            refreshing = true;
            windowObj.location.reload();
        };

        if (typeof navigatorObj.serviceWorker.addEventListener === 'function') {
            navigatorObj.serviceWorker.addEventListener('controllerchange', () => {
                reloadWhenSafe();
            });
        }

        if (typeof windowObj.addEventListener === 'function') {
            windowObj.addEventListener(MULTIPLAYER_STATE_CHANGE_EVENT, () => {
                if (reloadPending && !hasActiveMultiplayerRoom()) {
                    reloadPending = false;
                    reloadWhenSafe();
                }
            });
        }

        windowObj.addEventListener('load', () => {
            navigatorObj.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('SW Registered in PROD mode');
                    // 手動檢查更新
                    registration.update();
                })
                .catch(error => {
                    console.log('SW Registration failed:', error);
                });
        });
    } else if (env.DEV && 'serviceWorker' in navigatorObj) {
        // 開發階段: 主動解除可能舊有的 SW 註冊，確保開發環境乾淨
        navigatorObj.serviceWorker.getRegistrations().then((registrations) => {
            for (const registration of registrations) {
                registration.unregister();
                console.log('SW: Unregistered legacy worker in DEV mode.');
            }
        });
    }
}
