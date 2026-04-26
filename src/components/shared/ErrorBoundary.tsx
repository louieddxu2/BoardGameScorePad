
import React, { ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// 硬編碼雙語字串：ErrorBoundary 是最後防線，絕對不可依賴任何外部 Provider
const ERROR_STRINGS = {
  'zh-TW': {
    title: '發生了一些問題',
    desc: '應用程式遇到預期外的錯誤。這通常是因為瀏覽器翻譯插件破壞了網頁結構，請嘗試關閉翻譯後重新載入。',
    btn: '重新載入應用程式',
  },
  'en': {
    title: 'Something went wrong',
    desc: 'An unexpected error occurred. This is often caused by browser translation plugins. Please disable translation and reload.',
    btn: 'Reload App',
  },
};

function getErrorStrings() {
  try {
    const saved = localStorage.getItem('app_language');
    if (saved === 'en') return ERROR_STRINGS['en'];
  } catch { /* ignore */ }
  return ERROR_STRINGS['zh-TW'];
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) {
          registration.unregister();
        }
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      const strings = getErrorStrings();
      return (
        <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-app text-txt-primary p-6 text-center">
          <div className="bg-status-danger/10 p-4 rounded-full mb-4">
            <AlertTriangle size={48} className="text-status-danger" />
          </div>
          <h1 className="text-xl font-bold mb-2">{strings.title}</h1>
          <p className="text-txt-muted text-sm mb-6 max-w-xs mx-auto">
            {strings.desc}
          </p>

          <div className="bg-surface-bg p-3 rounded-lg border border-surface-border mb-6 text-xs font-mono text-left w-full max-w-xs overflow-auto max-h-32 opacity-70">
            {this.state.error?.toString()}
          </div>

          <button
            onClick={this.handleReload}
            className="flex items-center gap-2 bg-brand-primary-deep hover:bg-brand-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-brand-primary/30 transition-all active:scale-95"
          >
            <RefreshCw size={20} />
            {strings.btn}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
