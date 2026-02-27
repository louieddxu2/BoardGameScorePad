/// <reference types="vite/client" />

export function registerServiceWorker() {
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('SW Registered in PROD mode');
                    // 手動檢查更新
                    registration.update();
                })
                .catch(error => {
                    console.log('SW Registration failed:', error);
                });
        });
    } else if (import.meta.env.DEV && 'serviceWorker' in navigator) {
        // 開發階段: 主動解除可能舊有的 SW 註冊，確保開發環境乾淨
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            for (const registration of registrations) {
                registration.unregister();
                console.log('SW: Unregistered legacy worker in DEV mode.');
            }
        });
    }
}
