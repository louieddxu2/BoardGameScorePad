
import React, { useState, useEffect } from 'react';
import { HardDrive, Loader2, Skull } from 'lucide-react';
import { db } from '../../../../db';
import Dexie from 'dexie';
import { formatBytes } from '../../../../utils/formatUtils';
import { useInspectorTranslation } from '../shared/InspectorCommon';
import { useCommonTranslation } from '../../../../i18n/common';

interface TableStats {
    name: string;
    count: number;
    size: number;
}

const DatabaseInspector = ({ onRequestFactoryReset }: { onRequestFactoryReset: () => void }) => {
    const [stats, setStats] = useState<TableStats[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const t = useInspectorTranslation();
    const { t: tCommon } = useCommonTranslation();

    const calculateObjectSize = (obj: any): number => {
        if (!obj) return 0;
        // For LocalImage records, count the blob size explicitly
        if (obj.blob instanceof Blob) {
            return obj.blob.size;
        }
        // Fallback: estimate using JSON string length * 2 (UTF-16)
        try {
            const str = JSON.stringify(obj);
            return str ? str.length * 2 : 0;
        } catch (e) {
            return 0;
        }
    };

    useEffect(() => {
        const analyzeDB = async () => {
            setIsLoading(true);
            try {
                const tables = (db as any).tables;
                const results: TableStats[] = [];

                for (const table of tables) {
                    const count = await table.count();
                    let size = 0;

                    if (count < 5000) {
                        await table.each((item: any) => {
                            size += calculateObjectSize(item);
                        });
                    } else {
                        // Estimate for huge tables
                        size = count * 100; // Rough average
                    }

                    results.push({ name: table.name, count, size });
                }

                // Sort by Size (Desc)
                results.sort((a, b) => b.size - a.size);
                setStats(results);
            } catch (e) {
                console.error("Failed to analyze DB", e);
            } finally {
                setIsLoading(false);
            }
        };
        analyzeDB();
    }, []);

    const totalSize = stats.reduce((acc, curr) => acc + curr.size, 0);

    return (
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Summary Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                        <HardDrive size={32} className="text-emerald-500" />
                    </div>
                    <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{t('db_total_size')}</span>
                    <h2 className="text-4xl font-black text-white">{isLoading ? '...' : formatBytes(totalSize)}</h2>
                </div>

                {/* Table List */}
                <div className="space-y-3">
                    <h3 className="text-slate-400 text-xs font-bold uppercase px-2">{t('list_db_tables')}</h3>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-8 text-slate-500 gap-2">
                            <Loader2 size={16} className="animate-spin" /> {tCommon('loading')}
                        </div>
                    ) : (
                        stats.map((stat) => (
                            <div key={stat.name} className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-bold text-slate-200">{stat.name}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">{stat.count} {t('db_row_count')}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-mono font-bold text-emerald-400">{formatBytes(stat.size)}</div>
                                    <div className="w-24 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-600 rounded-full"
                                            style={{ width: `${totalSize > 0 ? (stat.size / totalSize) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <p className="text-[10px] text-slate-600 text-center pt-4">
                    {t('db_calc_note')}
                </p>

                {/* Factory Reset Section */}
                <div className="pt-8 border-t border-slate-800">
                    <button
                        onClick={onRequestFactoryReset}
                        className="w-full py-4 bg-red-900/20 hover:bg-red-900/40 text-red-500 font-bold rounded-xl border border-red-900/30 flex items-center justify-center gap-2 transition-all active:scale-95 group"
                    >
                        <Skull size={20} className="group-hover:animate-pulse" />
                        {t('btn_factory_reset')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DatabaseInspector;
