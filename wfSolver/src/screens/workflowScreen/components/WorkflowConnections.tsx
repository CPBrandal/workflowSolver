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
        node.connections.map((edge) => {
          const target = nodes.find((n) => n.id === edge.targetNodeId);
          if (!target) return null;

          const startX = (node.position.x * 180) + 72;
          const startY = (node.position.y * 120) + 48;
          const endX = (target.position.x * 180) + 72;
          const endY = (target.position.y * 120) + 48;

          return (
            <line
              key={`${node.id}-${edge.targetNodeId}`}
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