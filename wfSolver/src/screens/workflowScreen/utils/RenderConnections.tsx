import React from 'react';
import type { WorkflowNode } from "../../../types";

export const RenderConnections = (workflowNodes: WorkflowNode[]): React.ReactElement[] => {
  const connections: React.ReactElement[] = [];
  
  workflowNodes.forEach((node: WorkflowNode) => {
    node.connections.forEach((targetId: string) => {
      const target = workflowNodes.find((n: WorkflowNode) => n.id === targetId);
      if (target) {
        const startX = (node.x * 180) + 72;
        const startY = (node.y * 120) + 48;
        const endX = (target.x * 180) + 72;
        const endY = (target.y * 120) + 48;
        
        let strokeColor = "#6b7280";
        let strokeWidth = "2";
        
        if (node.status === 'completed' && target.status === 'running') {
          strokeColor = "#3b82f6"; // Blue
          strokeWidth = "3";
        } else if (node.status === 'completed') {
          strokeColor = "#10b981"; // Green
          strokeWidth = "3";
        } else if (node.status === 'error') {
          strokeColor = "#ef4444"; // Red
          strokeWidth = "3";
        }
        
        connections.push(
          <g key={`${node.id}-${targetId}`}>
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              markerEnd="url(#arrowhead)"
              className="transition-all duration-300"
            />
          </g>
        );
      }
    });
  });
  
  return connections;
};