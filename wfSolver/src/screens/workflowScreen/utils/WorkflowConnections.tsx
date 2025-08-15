import type { WorkflowNode } from "../../../types";

interface ConnectionsProps {
  nodes: WorkflowNode[];
}

export function WorkflowConnections({ nodes }: ConnectionsProps) {
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

          const getStrokeColor = () => {
            if (node.status === 'completed' && target.status === 'running') return "#3b82f6";
            if (node.status === 'completed' && target.status === 'completed') return "#10b981";
            return "#6b7280";
          };

          return (
            <line
              key={`${node.id}-${targetId}`}
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke={getStrokeColor()}
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