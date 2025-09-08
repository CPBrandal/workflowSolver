import type { WorkflowNode } from "../../../types";

interface WorkflowConnectionsProps {
  nodes: WorkflowNode[];
}

export function WorkflowConnections({ nodes }: WorkflowConnectionsProps) {
  const getStrokeColor = (sourceStatus: string, targetStatus: string) => {
    if (sourceStatus === 'completed' && targetStatus === 'running') return "#3b82f6";
    if (sourceStatus === 'completed' && targetStatus === 'completed') return "#10b981";
    return "#6b7280";
  };

  return (
    <>
      {nodes.map((node) =>
        node.connections.map((targetId) => {
          const target = nodes.find((n) => n.id === targetId);
          if (!target) return null;

          const startX = (node.x * 180) + 72;
          const startY = (node.y * 120) + 48;
          const endX = (target.x * 180) + 72;
          const endY = (target.y * 120) + 48;

          return (
            <line
              key={`${node.id}-${targetId}`}
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke={getStrokeColor(node.status, target.status)}
              strokeWidth="3"
              markerEnd="url(#arrowhead)"
              className="transition-all duration-300"
            />
          );
        })
      )}
    </>
  );
}