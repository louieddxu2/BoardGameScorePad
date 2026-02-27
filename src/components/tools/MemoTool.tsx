import React, { useState, useEffect } from 'react';
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

    // Sync from session if it changes externally (e.g. from DB load)
    useEffect(() => {
        if (session && session.note !== undefined && session.note !== text) {
            setText(session.note);
        }
    }, [session?.id]); // Only reset on session change to avoid cursor jumping

    // Debounce updates to parent
    useEffect(() => {
        const timer = setTimeout(() => {
            if (session && onUpdateSession && text !== (session.note || '')) {
                onUpdateSession({ ...session, note: text });
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [text, session, onUpdateSession]);

    const handleClear = () => {
        setText('');
    };

    return (
        <div className="w-full h-full bg-yellow-100/5 rounded-2xl border border-yellow-500/20 p-3 flex flex-col min-h-[140px] relative group">
            <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-yellow-500/70 uppercase flex items-center gap-1">
                    <PenLine size={12} /> {t('memo_title')}
                </span>
                {text && (
                    <button
                        onClick={handleClear}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1"
                    >
                        <Eraser size={12} />
                    </button>
                )}
            </div>

            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('memo_placeholder')}
                className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-yellow-100/90 placeholder-yellow-500/30 leading-relaxed scrollbar-thin"
                spellCheck={false}
            />

            {/* Visual Corner Fold */}
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-gradient-to-tl from-slate-900 to-transparent opacity-50 rounded-tl-lg pointer-events-none"></div>
        </div>
    );
};

export default MemoTool;
