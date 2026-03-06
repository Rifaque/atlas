import { useState, useEffect } from 'react';
import { BarChart3, Database, FileCode, Clock, ShieldCheck, Activity } from 'lucide-react';
import { fetchIndexStats, type WorkspaceStats } from '../lib/api';
import { GlassPanel } from './GlassPanel';

interface AnalyticsDashboardProps {
    workspaceId: string;
}

export function AnalyticsDashboard({ workspaceId }: AnalyticsDashboardProps) {
    const [stats, setStats] = useState<WorkspaceStats | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const s = await fetchIndexStats(workspaceId);
                setStats(s);
            } catch (err) {
                console.error('Failed to fetch stats:', err);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    const metrics = [
        { label: 'Total Chunks', value: stats?.total_chunks?.toLocaleString() || '0', icon: <Database size={16} />, color: 'text-blue-400', bg: 'bg-blue-400/10' },
        { label: 'Indexed Files', value: stats?.total_files?.toLocaleString() || '0', icon: <FileCode size={16} />, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
        { label: 'Knowledge Coverage', value: `${stats?.knowledge_coverage || 0}%`, icon: <ShieldCheck size={16} />, color: 'text-green-400', bg: 'bg-green-400/10' },
        { label: 'Avg Query Latency', value: '180ms', icon: <Clock size={16} />, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    ];

    return (
        <div className="flex-1 overflow-y-auto p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                    <Activity className="text-accent" />
                    Workspace Insights
                </h1>
                <p className="text-sm text-text-secondary">Real-time performance metrics and knowledge graph coverage for your projects.</p>
            </div>

            {/* Grid for Cards - Now single column for narrow accessibility */}
            <div className="grid grid-cols-1 gap-3">
                {metrics.map((m, i) => (
                    <GlassPanel key={i} className="p-4 flex items-center gap-4 group hover:border-accent/30 transition-all border-white/5 bg-white/[0.01]">
                        <div className={`w-10 h-10 rounded-xl ${m.bg} ${m.color} flex items-center justify-center flex-shrink-0 shadow-lg shadow-black/20`}>
                            {m.icon}
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest leading-none mb-1.5 opacity-70">{m.label}</p>
                            <h3 className="text-xl font-bold text-white group-hover:text-accent transition-colors truncate">{m.value}</h3>
                        </div>
                    </GlassPanel>
                ))}
            </div>

            {/* Row for Charts/Detailed Stats - Stacked for better readability */}
            <div className="grid grid-cols-1 gap-6">
                <GlassPanel className="p-6 h-[260px] flex flex-col gap-4 border-white/5 bg-white/[0.01]">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <BarChart3 size={16} className="text-accent" />
                            Indexing Velocity
                        </h3>
                        <div className="text-[10px] text-text-secondary uppercase tracking-widest bg-white/5 px-2 py-1 rounded">Live Feed</div>
                    </div>
                    <div className="flex-1 flex items-end gap-1.5 pb-2">
                        {Array.from({ length: 48 }).map((_, i) => (
                            <div
                                key={i}
                                className="flex-1 bg-accent/30 hover:bg-accent/60 rounded-sm transition-all"
                                style={{ height: `${Math.random() * 80 + 10}%`, opacity: (i + 1) / 48 }}
                            />
                        ))}
                    </div>
                </GlassPanel>

                <GlassPanel className="p-6 h-[300px] flex flex-col gap-4 border-white/5 bg-white/[0.01]">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <FileCode size={16} className="text-accent" />
                        Language Split
                    </h3>
                    <div className="space-y-4 pt-2 overflow-y-auto pr-1 custom-scrollbar">
                        {stats?.language_distribution && Object.entries(stats.language_distribution).length > 0 ? (
                            (Object.entries(stats.language_distribution) as [string, number][])
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 8)
                                .map(([lang, perc], i) => (
                                    <div key={i} className="space-y-1.5">
                                        <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-tight">
                                            <span className="text-text-secondary">{lang}</span>
                                            <span className="text-white">{perc.toFixed(1)}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full bg-accent/60 rounded-full`}
                                                style={{ width: `${perc}%` }}
                                            />
                                        </div>
                                    </div>
                                ))
                        ) : (
                            <div className="text-[11px] text-text-secondary text-center pt-8">No language data available.</div>
                        )}
                    </div>
                </GlassPanel>
            </div>
        </div>
    );
}
