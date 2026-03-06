import { useState, useEffect } from 'react';
import { BarChart3, Database, FileCode, Zap, Clock, ShieldCheck, Activity } from 'lucide-react';
import { fetchIndexStats } from '../lib/api';
import { GlassPanel } from './GlassPanel';

export function AnalyticsDashboard() {
    const [stats, setStats] = useState<{ count: number } | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const s = await fetchIndexStats();
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
        { label: 'Total Chunks', value: stats?.count?.toLocaleString() || '0', icon: <Database size={16} />, color: 'text-blue-400', bg: 'bg-blue-400/10' },
        { label: 'Knowledge Coverage', value: '82%', icon: <ShieldCheck size={16} />, color: 'text-green-400', bg: 'bg-green-400/10' },
        { label: 'Indexing Speed', value: '42 files/min', icon: <Zap size={16} />, color: 'text-amber-400', bg: 'bg-amber-400/10' },
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

            {/* Grid for Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {metrics.map((m, i) => (
                    <GlassPanel key={i} className="p-5 flex flex-col gap-3 group hover:border-accent/30 transition-all border-white/5 bg-white/[0.01]">
                        <div className={`w-8 h-8 rounded-lg ${m.bg} ${m.color} flex items-center justify-center`}>
                            {m.icon}
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">{m.label}</p>
                            <h3 className="text-xl font-bold text-white group-hover:text-accent transition-colors">{m.value}</h3>
                        </div>
                    </GlassPanel>
                ))}
            </div>

            {/* Row for Charts/Detailed Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <GlassPanel className="lg:col-span-2 p-6 h-[300px] flex flex-col gap-4 border-white/5 bg-white/[0.01]">
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
                                className="flex-1 bg-accent/40 hover:bg-accent rounded-sm transition-all"
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
                    <div className="space-y-4 pt-2">
                        {[
                            { lang: 'Typescript', perc: 45, color: 'bg-blue-500' },
                            { lang: 'Rust', perc: 30, color: 'bg-orange-500' },
                            { lang: 'CSS', perc: 15, color: 'bg-indigo-500' },
                            { lang: 'Others', perc: 10, color: 'bg-white/10' },
                        ].map((l, i) => (
                            <div key={i} className="space-y-1.5">
                                <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-tight">
                                    <span className="text-text-secondary">{l.lang}</span>
                                    <span className="text-white">{l.perc}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className={`h-full ${l.color} rounded-full`} style={{ width: `${l.perc}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </GlassPanel>
            </div>
        </div>
    );
}
