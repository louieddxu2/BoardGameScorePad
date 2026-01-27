
import React, { ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
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
    // 強制從伺服器重新載入，忽略快取
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
      return (
        <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-slate-900 text-slate-100 p-6 text-center">
          <div className="bg-red-500/10 p-4 rounded-full mb-4">
            <AlertTriangle size={48} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold mb-2">發生了一些問題</h1>
          <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">
            應用程式遇到預期外的錯誤。這通常是因為瀏覽器翻譯插件破壞了網頁結構，請嘗試關閉翻譯後重新載入。
          </p>
          
          <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 mb-6 text-xs font-mono text-left w-full max-w-xs overflow-auto max-h-32 opacity-70">
             {this.state.error?.toString()}
          </div>

          <button
            onClick={this.handleReload}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-900/50 transition-all active:scale-95"
          >
            <RefreshCw size={20} />
            重新載入應用程式
          </button>
        </div>
      );
    }

    // Explicit cast to any to avoid "Property 'props' does not exist" error in some environments
    return (this as any).props.children;
  }
}

export default ErrorBoundary;