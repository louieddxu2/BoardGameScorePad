/// <reference types="vite/client" />

type SwRuntime = {
    env: { PROD: boolean; DEV: boolean };
    navigatorObj: Navigator;
    windowObj: Window;
};

export function registerServiceWorker(runtime?: Partial<SwRuntime>) {
    const env = runtime?.env ?? import.meta.env;
    const navigatorObj = runtime?.navigatorObj ?? navigator;
    const windowObj = runtime?.windowObj ?? window;

    if (env.PROD && 'serviceWorker' in navigatorObj) {
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
