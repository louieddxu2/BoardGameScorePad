import React, { useRef, useEffect, useState } from 'react';
import { Dice5, Search, X, Download, HelpCircle, Calculator, History, Cloud, CloudOff, Loader2, Sun, Moon } from 'lucide-react';
import { useTranslation } from '../../../i18n'; // Keep for language context
import { useCommonTranslation } from '../../../i18n/common';
import { useDashboardTranslation } from '../../../i18n/dashboard';
import { useCloudTranslation } from '../../../i18n/cloud';

interface DashboardHeaderProps {
  isSearchActive: boolean;
  setIsSearchActive: (active: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isInstalled: boolean;
  canInstall: boolean;
  onInstallClick: () => void;
  onShowInstallGuide: () => void;
  viewMode: 'library' | 'history';
  setViewMode: (mode: 'library' | 'history') => void;
  // Theme Props
  themeMode: 'dark' | 'light';
  onToggleTheme: () => void;
  // Cloud Props
  isConnected: boolean;
  isSyncing: boolean;
  onCloudClick: () => void; // Changed from onToggleCloud
  onTriggerInspector: () => void; // New prop for debug tool
  // [Refactor] Allow passing external refs to ignore clicks
  interactionRefs?: React.RefObject<HTMLElement | null>[];
  // [Fix] New prop to prevent background clicks when global modal is open
  isOverlayOpen?: boolean;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  isSearchActive,
  setIsSearchActive,
  searchQuery,
  setSearchQuery,
  isInstalled,
  canInstall,
  onInstallClick,
  onShowInstallGuide,
  viewMode,
  setViewMode,
  themeMode,
  onToggleTheme,
  isConnected,
  isSyncing,
  onCloudClick,
  onTriggerInspector,
  interactionRefs,
  isOverlayOpen
}) => {

  const searchRef = useRef<HTMLDivElement>(null);
  const { language, setLanguage } = useTranslation();
  const { t: tCommon } = useCommonTranslation();
  const { t: tDash } = useDashboardTranslation();
  const { t: tCloud } = useCloudTranslation();

  // [New] Storage Usage State
  const [localUsage, setLocalUsage] = useState<string>('');

  // [New] Check Storage Estimate
  useEffect(() => {
    const checkUsage = async () => {
      if (navigator.storage && navigator.storage.estimate) {
        try {
          const estimate = await navigator.storage.estimate();
          if (estimate.usage) {
            // Convert to MB with 1 decimal place
            const mb = (estimate.usage / (1024 * 1024)).toFixed(1);
            setLocalUsage(`${mb} MB`);
          }
        } catch (e) {
          console.warn("Storage estimate failed", e);
        }
      }
    };

    // Check initially
    checkUsage();

    // Re-check periodically (every 10s) or when syncing state changes (data changed)
    // This keeps the "shortcut" info relatively fresh without heavy polling
    const interval = setInterval(checkUsage, 10000);

    return () => clearInterval(interval);
  }, [isSyncing, viewMode]); // Re-check after sync or view change (potential deletions)

  // [Refactor] Handle click outside with explicit Refs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      // 1. If not searching, do nothing
      if (!isSearchActive || !searchRef.current) return;

      // [Fix] If a global overlay (modal) is open, do NOT handle background clicks.
      // This prevents the search mode (and setup panel) from closing when interacting with the modal.
      if (isOverlayOpen) return;

      const target = event.target as Node;

      // 2. If clicking inside search bar, do nothing
      if (searchRef.current.contains(target)) return;

      // 3. If clicking inside any excluded element (e.g. setup panel), do nothing
      if (interactionRefs?.some(ref => ref.current?.contains(target))) {
        return;
      }

      // 4. Otherwise, handle close logic
      // Only close if the search query is empty.
      // If there is text, keep it open so the user knows the list is filtered.
      if (!searchQuery || searchQuery.trim() === '') {
        setIsSearchActive(false);
      }
    };

    if (isSearchActive) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isSearchActive, setIsSearchActive, searchQuery, interactionRefs, isOverlayOpen]);

  const toggleView = () => {
    setViewMode(viewMode === 'library' ? 'history' : 'library');
  };

  const toggleLanguage = (e: React.MouseEvent) => {
    e.stopPropagation(); // [Fix] ?ªÊ≠¢‰∫ã‰ª∂?íÊ≥°ÔºåÈÅø?çËß∏??Header ?ÑÈô§?ØÈ??äÂÅµÊ∏?
    setLanguage(language === 'zh-TW' ? 'en' : 'zh-TW');
  };

  // --- Debug Trigger Logic (3 Clicks on Empty Space) ---
  const debugClickCountRef = useRef(0);
  const debugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHeaderClick = (e: React.MouseEvent) => {
    // Only active in History view to avoid conflicts
    if (viewMode !== 'history') return;

    const target = e.target as HTMLElement;

    // Ignore if clicking on interactive elements (buttons, inputs)
    // We check recursively up to 2 levels to catch icons inside buttons
    if (target.closest('button') || target.closest('input') || target.closest('[role="button"]')) {
      return;
    }

    debugClickCountRef.current += 1;

    if (debugTimerRef.current) {
      clearTimeout(debugTimerRef.current);
    }

    if (debugClickCountRef.current >= 3) {
      onTriggerInspector();
      debugClickCountRef.current = 0;
      // Feedback (if vibrate is supported)
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    } else {
      // Reset count after 500ms if not reached 3 clicks
      debugTimerRef.current = setTimeout(() => {
        debugClickCountRef.current = 0;
      }, 500);
    }
  };

  return (
    <header
      className="flex flex-col bg-app-bg/95 backdrop-blur-md border-b border-surface-border sticky top-0 z-30 transition-all duration-300 shadow-sm"
      onClick={handleHeaderClick}
    >
      <div className="p-2.5 flex items-center gap-2 h-[58px]">
        {isSearchActive ? (
          <div ref={searchRef} className="flex items-center gap-2 w-full animate-in fade-in duration-300">
            <Search size={20} className="text-emerald-500 shrink-0 ml-1" />
            <input
              type="search"
              inputMode="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              name="q"
              placeholder={viewMode === 'library' ? tDash('dash_search_placeholder') : tDash('dash_history_search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full bg-transparent text-txt-primary focus:outline-none placeholder-txt-muted font-medium"
            />
            <button onClick={() => { setIsSearchActive(false); setSearchQuery(''); }} className="text-txt-muted hover:text-txt-primary p-2">
              <X size={20} />
            </button>
          </div>
        ) : (
          <div className="flex justify-between items-center w-full animate-in fade-in duration-300 gap-2">
            {/* Left Side: Logo, Title, Toggle */}
            <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
              {/* Logo: Toggle Theme */}
              <div
                className="bg-surface-alt p-1.5 rounded-lg border border-surface-border shrink-0 cursor-pointer active:scale-90 transition-transform shadow-sm"
                onClick={(e) => { e.stopPropagation(); onToggleTheme(); }}
                role="button"
                title={themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}
              >
                {themeMode === 'dark'
                  ? <Dice5 size={24} className="text-emerald-500" />
                  : <Sun size={24} className="text-amber-500" />
                }
              </div>
              {/* Title: Toggle Language */}
              <h1
                className="text-lg sm:text-xl font-bold tracking-tight text-txt-primary truncate select-none cursor-pointer active:opacity-50 transition-opacity"
                onClick={toggleLanguage}
                role="button"
                title={tDash('dash_switch_language')}
              >
                {tCommon('app_name')}
              </h1>

              {/* Unified Toggle Button - Width 56px, tight padding */}
              <button
                onClick={toggleView}
                className="relative h-9 w-[56px] bg-surface-alt border border-surface-border rounded-xl flex items-center justify-center cursor-pointer hover:bg-surface-alt/80 transition-colors shrink-0 group active:scale-95 shadow-inner"
                title={viewMode === 'library' ? tCloud('cloud_tab_history') : tCloud('cloud_tab_templates')}
              >
                {/* Central Slash (Background) */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                  <span className="text-txt-muted/20 font-bold text-sm -rotate-12 select-none">/</span>
                </div>

                {/* Icon Container - Library (Calculator) */}
                <div
                  className={`absolute flex items-center justify-center left-2.5 
                        ${viewMode === 'library' ? 'icon-toggle-active' : 'z-10 text-txt-muted'}
                    `}
                >
                  <Calculator size={20} strokeWidth={viewMode === 'library' ? 2.5 : 2} />
                </div>

                {/* Icon Container - History (History Clock) */}
                <div
                  className={`absolute flex items-center justify-center right-2.5
                        ${viewMode === 'history' ? 'icon-toggle-active' : 'z-10 text-txt-muted'}
                    `}
                >
                  <History size={20} strokeWidth={viewMode === 'history' ? 2.5 : 2} />
                </div>
              </button>

              {/* Cloud Connect Toggle (New Position) */}
              <button
                onClick={onCloudClick}
                disabled={isSyncing}
                className={`btn-cloud-status ${isSyncing ? 'bg-surface-bg-alt border-surface-border cursor-wait' :
                  isConnected ? 'connected' : 'disconnected'
                  }`}
                // [Update] Display storage size in tooltip
                title={`${tDash('dash_cloud_sync')}${localUsage ? ` (${localUsage})` : ''}`}
              >
                {isSyncing ? <Loader2 className="animate-spin" size={18} /> :
                  isConnected ? <Cloud size={18} /> : <CloudOff size={18} />}
              </button>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-1 shrink-0 ml-1">
              <button onClick={() => setIsSearchActive(true)} className="p-2 text-txt-muted hover:text-txt-primary hover:bg-surface-bg-alt rounded-lg transition-colors">
                <Search size={20} />
              </button>

              {/* Language Toggle Removed from here */}

              {!isInstalled && (
                <button
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all text-white shadow-lg ${canInstall 
                    ? 'btn-action-primary' 
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
                  onClick={canInstall ? onInstallClick : onShowInstallGuide}
                >
                  <div className="relative">
                    <Download size={14} />
                    {!canInstall && (
                      <div className="absolute -bottom-1 -right-1 bg-amber-900/50 rounded-full w-2.5 h-2.5 flex items-center justify-center border border-slate-700">
                        <HelpCircle size={8} className="text-amber-500" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <span className="hidden sm:inline">{tDash('dash_install_app')}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default DashboardHeader;
