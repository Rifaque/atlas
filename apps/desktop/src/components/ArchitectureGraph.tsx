import React, { useEffect, useState } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    MarkerType,
    type Node,
    type Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { invoke } from '@tauri-apps/api/core';

interface ArchitectureGraphProps {
    workspaceId: string;
}

const ArchitectureGraph: React.FC<ArchitectureGraphProps> = ({ workspaceId }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchGraph = async () => {
            try {
                setLoading(true);
                const data = await invoke('get_graph_data', { workspaceId }) as {
                    nodes: { id: string, kind: string, filePath: string }[],
                    edges: { from: string, to: string, kind: string }[]
                };

                const initialNodes: Node[] = data.nodes.map((n, i) => ({
                    id: n.id,
                    data: { label: `${n.id}\n(${n.kind})` },
                    position: { x: (i % 5) * 200, y: Math.floor(i / 5) * 150 },
                    style: {
                        background: n.kind.includes('function') ? '#3b82f6' : '#10b981',
                        color: '#fff',
                        borderRadius: '8px',
                        fontSize: '12px',
                        padding: '10px',
                        width: 150
                    }
                }));

                const initialEdges: Edge[] = data.edges.map((e, i) => ({
                    id: `e-${i}`,
                    source: e.from,
                    target: e.to,
                    label: e.kind,
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
                    style: { stroke: '#94a3b8' }
                }));

                setNodes(initialNodes);
                setEdges(initialEdges);
            } catch (err) {
                console.error('Failed to fetch graph data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchGraph();
    }, [workspaceId, setNodes, setEdges]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-slate-400">
                <div className="animate-pulse">Mapping workspace architecture...</div>
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-slate-900 overflow-hidden rounded-xl border border-white/10">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
            >
                <Background color="#334155" gap={20} />
                <Controls />
                <MiniMap
                    nodeColor={(n) => n.style?.background as string || '#334155'}
                    maskColor="rgba(15, 23, 42, 0.7)"
                />
            </ReactFlow>
        </div>
    );
};

export default ArchitectureGraph;
