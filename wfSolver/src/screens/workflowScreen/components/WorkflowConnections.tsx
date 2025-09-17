import type { WorkflowNode } from '../../../types';

interface WorkflowConnectionsProps {
  nodes: WorkflowNode[];
  criticalPathNodes: WorkflowNode[];
}

interface LabelPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  connectionId: string;
  transferTime: string;
  strokeColor: string;
  originalX: number;
  originalY: number;
  lineStart: { x: number; y: number };
  lineEnd: { x: number; y: number };
  positionRatio: number;
  displaced: boolean;
}

interface NodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
}

export function WorkflowConnections({ nodes, criticalPathNodes }: WorkflowConnectionsProps) {
  const getStrokeColor = (sourceNode: WorkflowNode, targetNode: WorkflowNode) => {
    if (isEdgeOnCriticalPath(sourceNode.id, targetNode.id)) return '#ef4444';
    if (sourceNode.status === 'completed' && targetNode.status === 'running') return '#3b82f6';
    if (sourceNode.status === 'completed' && targetNode.status === 'completed') return '#10b981';
    return '#6b7280';
  };

  const isEdgeOnCriticalPath = (sourceId: string, targetId: string): boolean => {
    if (criticalPathNodes.length === 0) return false;
    const sourceIndex = criticalPathNodes.findIndex(node => node.id === sourceId);
    const targetIndex = criticalPathNodes.findIndex(node => node.id === targetId);
    return sourceIndex !== -1 && targetIndex !== -1 && targetIndex === sourceIndex + 1;
  };

  // Calculate position along line based on ratio (0 = start, 1 = end, 0.5 = middle)
  const getPositionOnLine = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    ratio: number
  ) => {
    const clampedRatio = Math.max(0.1, Math.min(0.9, ratio)); // Keep labels between 10% and 90% of line
    return {
      x: start.x + (end.x - start.x) * clampedRatio,
      y: start.y + (end.y - start.y) * clampedRatio,
    };
  };

  // Update label position based on its line and ratio
  const updateLabelPosition = (label: LabelPosition) => {
    const pos = getPositionOnLine(label.lineStart, label.lineEnd, label.positionRatio);
    label.x = pos.x - label.width / 2;
    label.y = pos.y - label.height / 2;
  };

  // Calculate node bounds for collision detection
  const getNodeBounds = (): NodeBounds[] => {
    return nodes.map(node => ({
      x: node.position.x * 280,
      y: node.position.y * 180,
      width: 144,
      height: 120,
      id: node.id,
    }));
  };

  // Check if label overlaps with any node
  const doesLabelOverlapWithNode = (
    label: LabelPosition,
    nodeBounds: NodeBounds[]
  ): NodeBounds | null => {
    const padding = 12;

    for (const node of nodeBounds) {
      if (
        !(
          label.x + label.width + padding < node.x ||
          node.x + node.width + padding < label.x ||
          label.y + label.height + padding < node.y ||
          node.y + node.height + padding < label.y
        )
      ) {
        return node;
      }
    }
    return null;
  };

  // Check if two labels overlap
  const doLabelsOverlap = (label1: LabelPosition, label2: LabelPosition): boolean => {
    const padding = 8;
    return !(
      label1.x + label1.width + padding < label2.x ||
      label2.x + label2.width + padding < label1.x ||
      label1.y + label1.height + padding < label2.y ||
      label2.y + label2.height + padding < label1.y
    );
  };

  // Slide label along its line to avoid a node
  const slideAwayFromNode = (label: LabelPosition, node: NodeBounds): void => {
    // Try different positions along the line to find one that doesn't overlap
    const attempts = [0.3, 0.7, 0.2, 0.8, 0.15, 0.85];

    for (const ratio of attempts) {
      const testRatio = ratio;
      const pos = getPositionOnLine(label.lineStart, label.lineEnd, testRatio);
      const testX = pos.x - label.width / 2;
      const testY = pos.y - label.height / 2;

      // Check if this position would overlap with the node
      const padding = 12;
      const wouldOverlap = !(
        testX + label.width + padding < node.x ||
        node.x + node.width + padding < testX ||
        testY + label.height + padding < node.y ||
        node.y + node.height + padding < testY
      );

      if (!wouldOverlap) {
        label.positionRatio = testRatio;
        updateLabelPosition(label);
        label.displaced = true;
        return;
      }
    }

    // If no good position found, use the furthest from center
    label.positionRatio = label.positionRatio < 0.5 ? 0.15 : 0.85;
    updateLabelPosition(label);
    label.displaced = true;
  };

  // Slide two overlapping labels apart along their lines
  const slideLabelsApart = (label1: LabelPosition, label2: LabelPosition): void => {
    // Calculate how far apart they need to be
    const separationDistance = 0.15; // 15% of line length separation

    if (label1.positionRatio < label2.positionRatio) {
      // label1 is closer to start, move it further toward start
      // label2 is closer to end, move it further toward end
      label1.positionRatio = Math.max(0.1, label1.positionRatio - separationDistance);
      label2.positionRatio = Math.min(0.9, label2.positionRatio + separationDistance);
    } else {
      // label2 is closer to start, move it further toward start
      // label1 is closer to end, move it further toward end
      label2.positionRatio = Math.max(0.1, label2.positionRatio - separationDistance);
      label1.positionRatio = Math.min(0.9, label1.positionRatio + separationDistance);
    }

    updateLabelPosition(label1);
    updateLabelPosition(label2);
    label1.displaced = true;
    label2.displaced = true;
  };

  // Resolve all overlaps by sliding along lines
  const resolveOverlaps = (labels: LabelPosition[], nodeBounds: NodeBounds[]): LabelPosition[] => {
    const result = [...labels];
    const maxAttempts = 25;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let hasOverlap = false;

      // First, resolve label-node collisions
      for (let i = 0; i < result.length; i++) {
        const overlappingNode = doesLabelOverlapWithNode(result[i], nodeBounds);
        if (overlappingNode) {
          hasOverlap = true;
          slideAwayFromNode(result[i], overlappingNode);
        }
      }

      // Then resolve label-label collisions
      for (let i = 0; i < result.length - 1; i++) {
        for (let j = i + 1; j < result.length; j++) {
          if (doLabelsOverlap(result[i], result[j])) {
            hasOverlap = true;
            slideLabelsApart(result[i], result[j]);
          }
        }
      }

      if (!hasOverlap) break;
    }

    return result;
  };

  // Calculate initial label positions
  const calculateInitialPositions = (): LabelPosition[] => {
    const labels: LabelPosition[] = [];

    nodes.forEach(node => {
      node.connections.forEach(edge => {
        const target = nodes.find(n => n.id === edge.targetNodeId);
        if (!target) return;

        const startX = node.position.x * 280 + 72;
        const startY = node.position.y * 180 + 60;
        const endX = target.position.x * 280 + 72;
        const endY = target.position.y * 180 + 60;

        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        const strokeColor = getStrokeColor(node, target);
        const transferTime = edge.transferTime != null ? `${edge.transferTime}s` : '?';

        // Calculate label dimensions based on text
        const textLength = transferTime.length;
        const labelWidth = Math.max(50, textLength * 7 + 20);
        const labelHeight = 20;

        labels.push({
          x: midX - labelWidth / 2,
          y: midY - labelHeight / 2,
          width: labelWidth,
          height: labelHeight,
          connectionId: `${node.id}-${edge.targetNodeId}`,
          transferTime,
          strokeColor,
          originalX: midX,
          originalY: midY,
          lineStart: { x: startX, y: startY },
          lineEnd: { x: endX, y: endY },
          positionRatio: 0.5, // Start at center
          displaced: false,
        });
      });
    });

    return labels;
  };

  const nodeBounds = getNodeBounds();
  const labelPositions = resolveOverlaps(calculateInitialPositions(), nodeBounds);

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

          const strokeColor = getStrokeColor(node, target);
          const connectionId = `${node.id}-${edge.targetNodeId}`;
          const labelPos = labelPositions.find(l => l.connectionId === connectionId);

          if (!labelPos) return null;

          const labelCenterX = labelPos.x + labelPos.width / 2;
          const labelCenterY = labelPos.y + labelPos.height / 2;

          return (
            <g key={connectionId}>
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
                {/* Optional indicator when displaced - just a subtle highlight */}
                {labelPos.displaced && (
                  <circle
                    cx={labelPos.originalX}
                    cy={labelPos.originalY}
                    r="3"
                    fill={labelPos.strokeColor}
                    opacity="0.3"
                    className="transition-all duration-300"
                  />
                )}

                {/* Background rectangle */}
                <rect
                  x={labelPos.x}
                  y={labelPos.y}
                  width={labelPos.width}
                  height={labelPos.height}
                  rx="8"
                  fill="white"
                  stroke={labelPos.strokeColor}
                  strokeWidth="1"
                  className="transition-all duration-300"
                />

                {/* Transfer amount text */}
                <text
                  x={labelCenterX}
                  y={labelCenterY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="11"
                  fontWeight="500"
                  fill={labelPos.strokeColor}
                  className="transition-all duration-300"
                >
                  {labelPos.transferTime}
                </text>
              </g>
            </g>
          );
        })
      )}
    </>
  );
}
