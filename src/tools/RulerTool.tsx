
import React from 'react';
import { Ruler } from 'lucide-react';

const RulerTool: React.FC = () => {
    // 96px is roughly 1 inch in CSS standards.
    // 1 cm = 96 / 2.54 ≈ 37.8 px
    const cmInPx = 37.8;
    const totalCm = 8; // Display roughly 8cm

    return (
        <div className="w-full h-full bg-slate-100 rounded-2xl border-2 border-slate-300 relative overflow-hidden flex flex-col shadow-inner select-none group">
            <div className="absolute top-2 right-2 text-slate-400 opacity-50 group-hover:opacity-100 transition-opacity">
                <Ruler size={16} />
            </div>

            {/* CM Scale */}
            <div className="flex-1 flex items-end w-full relative">
                {Array.from({ length: totalCm * 10 + 1 }).map((_, i) => {
                    const isCm = i % 10 === 0;
                    const isHalf = i % 5 === 0 && !isCm;
                    const height = isCm ? 'h-4' : (isHalf ? 'h-3' : 'h-1.5');
                    const width = 'w-px';
                    const left = `${i * (cmInPx / 10)}px`;
                    
                    return (
                        <React.Fragment key={i}>
                            <div 
                                className={`absolute bottom-0 bg-slate-800 ${width} ${height}`}
                                style={{ left }}
                            />
                            {isCm && (
                                <span className="absolute bottom-5 text-[9px] font-mono font-bold text-slate-800 -translate-x-1/2" style={{ left }}>
                                    {i / 10}
                                </span>
                            )}
                        </React.Fragment>
                    );
                })}
                <span className="absolute bottom-1 right-2 text-[8px] font-bold text-slate-500">CM</span>
            </div>

            {/* Divider */}
            <div className="h-px w-full bg-slate-300 my-1"></div>

            {/* Inch Scale (Approx 3 inches) */}
            <div className="flex-1 w-full relative">
                {Array.from({ length: 4 }).map((_, i) => (
                    <React.Fragment key={i}>
                        <div className="absolute top-0 w-px h-4 bg-slate-800" style={{ left: `${i * 96}px` }} />
                        <span className="absolute top-5 text-[9px] font-mono font-bold text-slate-800 -translate-x-1/2" style={{ left: `${i * 96}px` }}>{i}</span>
                        {/* Halves */}
                        {i < 3 && <div className="absolute top-0 w-px h-2.5 bg-slate-600" style={{ left: `${i * 96 + 48}px` }} />}
                        {/* Quarters */}
                        {i < 3 && <div className="absolute top-0 w-px h-1.5 bg-slate-400" style={{ left: `${i * 96 + 24}px` }} />}
                        {i < 3 && <div className="absolute top-0 w-px h-1.5 bg-slate-400" style={{ left: `${i * 96 + 72}px` }} />}
                    </React.Fragment>
                ))}
                <span className="absolute top-1 right-2 text-[8px] font-bold text-slate-500">INCH</span>
            </div>
            
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-100 pointer-events-none w-8 right-0" />
        </div>
    );
};

export default RulerTool;
