import React, { useState, useEffect, useRef } from 'react';
import { PenLine, Eraser } from 'lucide-react';
import { GameSession } from '../../types';
import { useToolsTranslation } from '../../i18n/tools';

interface MemoToolProps {
    session?: GameSession; // Optional for backward compatibility, but required for sync
    onUpdateSession?: (session: GameSession) => void;
}

const MemoTool: React.FC<MemoToolProps> = ({ session, onUpdateSession }) => {
    const { t } = useToolsTranslation();
    // Initialize with session note if available
    const [text, setText] = useState(session?.note || '');
    const onUpdateRef = useRef(onUpdateSession);
    const sessionRef = useRef(session);
    const textRef = useRef(text);
    
    onUpdateRef.current = onUpdateSession;
    sessionRef.current = session;
    textRef.current = text;

    // Sync from session if it changes externally (e.g. from DB load)
    useEffect(() => {
        if (session && session.note !== undefined && session.note !== text) {
            setText(session.note);
        }
    }, [session?.id]); // Only reset on session change to avoid cursor jumping

    const flushUpdate = () => {
        if (sessionRef.current && onUpdateRef.current && textRef.current !== (sessionRef.current.note || '')) {
            onUpdateRef.current({ ...sessionRef.current, note: textRef.current });
        }
    };

    // Debounce updates to parent + Flush on unmount
    useEffect(() => {
        const timer = setTimeout(flushUpdate, 500);
        return () => {
            clearTimeout(timer);
            flushUpdate(); // [Crucial] Force sync when tool is closed or session ends
        };
    }, [text]);

    const handleClear = () => {
        setText('');
    };

    return (
        <div className="w-full h-full bg-[rgb(var(--c-input-bg))] rounded-2xl border border-[rgb(var(--c-input-border))] p-3 flex flex-col min-h-[140px] relative group shadow-sm">
            <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-brand-primary uppercase flex items-center gap-1 opacity-80">
                    <PenLine size={12} /> {t('memo_title')}
                </span>
                {text && (
                    <button
                        onClick={handleClear}
                        className="text-txt-muted hover:text-status-danger transition-colors p-1"
                    >
                        <Eraser size={12} />
                    </button>
                )}
            </div>

            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={flushUpdate}
                placeholder={t('memo_placeholder')}
                className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-txt-primary placeholder-txt-muted/50 leading-relaxed no-scrollbar"
                spellCheck={false}
            />

            {/* Visual Corner Fold - Adjusted for theme */}
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-gradient-to-tl from-[rgb(var(--c-input-border))] to-transparent opacity-30 rounded-tl-lg pointer-events-none"></div>
        </div>
    );
};

export default MemoTool;
