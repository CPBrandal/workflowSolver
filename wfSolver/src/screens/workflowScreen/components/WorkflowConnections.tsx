import type { WorkflowNode } from '../../../types';

interface WorkflowConnectionsProps {
  nodes: WorkflowNode[];
}

export function WorkflowConnections({ nodes }: WorkflowConnectionsProps) {
  const getStrokeColor = (sourceStatus: string, targetStatus: string) => {
    if (sourceStatus === 'completed' && targetStatus === 'running') return '#3b82f6';
    if (sourceStatus === 'completed' && targetStatus === 'completed') return '#10b981';
    return '#6b7280';
  };

  return (
    <>
      {nodes.map(node =>
        node.connections.map(edge => {
          const target = nodes.find(n => n.id === edge.targetNodeId);
          if (!target) return null;

          const startX = node.position.x * 280 + 72;
          const startY = node.position.y * 180 + 60;
          const endX = target.position.x * 280 + 72;
          const endY = target.position.y * 180 + 60;

          const midX = (startX + endX) / 2;
          const midY = (startY + endY) / 2;

          const strokeColor = getStrokeColor(node.status, target.status);

          return (
            <g key={`${node.id}-${edge.targetNodeId}`}>
              {/* Connection line */}
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke={strokeColor}
                strokeWidth="3"
                markerEnd="url(#arrowhead)"
                className="transition-all duration-300"
              />

              {/* Transfer amount label */}
              <g>
                {/* Background rectangle for better readability */}
                <rect
                  x={midX - 30}
                  y={midY - 10}
                  width="60"
                  height="20"
                  rx="8"
                  fill="white"
                  stroke={strokeColor}
                  strokeWidth="1"
                  className="transition-all duration-300"
                />

                {/* Transfer amount text */}
                <text
                  x={midX}
                  y={midY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="11"
                  fontWeight="500"
                  fill={strokeColor}
                  className="transition-all duration-300"
                >
                  {edge.transferTime != null ? `${edge.transferTime}s` : '?'}
                </text>
              </g>
            </g>
          );
        })
      )}
    </>
  );
}
