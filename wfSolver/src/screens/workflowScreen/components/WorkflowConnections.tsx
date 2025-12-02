import { useEffect, useRef, useState } from 'react';
import type { WorkflowNode } from '../../../types';

interface WorkflowConnectionsProps {
  nodes: WorkflowNode[];
  criticalPathNodes: WorkflowNode[];
  isSimulationRunning?: boolean;
  simulationStartTime?: number;
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

interface ActiveTransfer {
  sourceNodeId: string;
  targetNodeId: string;
  startTime: number;
  duration: number;
  progress: number;
  id: string;
}

export function WorkflowConnections({
  nodes,
  criticalPathNodes,
  isSimulationRunning = false,
  simulationStartTime = 0,
}: WorkflowConnectionsProps) {
  const [activeTransfers, setActiveTransfers] = useState<ActiveTransfer[]>([]);
  const [currentTime, setCurrentTime] = useState(0);

  // Track node completion status to detect when new transfers should start
  const previousNodeStatusRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let animationFrame: number;

    if (isSimulationRunning && simulationStartTime) {
      const updateTime = () => {
        const elapsed = (Date.now() - simulationStartTime) / 1000;
        setCurrentTime(elapsed);
        animationFrame = requestAnimationFrame(updateTime);
      };
      updateTime();
    } else {
      setCurrentTime(0);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isSimulationRunning, simulationStartTime]);

  // Reset everything when simulation starts/stops
  useEffect(() => {
    if (!isSimulationRunning) {
      setActiveTransfers([]);
      previousNodeStatusRef.current.clear();
    }
  }, [isSimulationRunning]);

  // Track data transfers when nodes complete
  useEffect(() => {
    if (!isSimulationRunning) return;

    const newActiveTransfers: ActiveTransfer[] = [];
    const currentNodeStatus = new Map<string, string>();

    // Build current status map and detect newly completed nodes
    nodes.forEach(node => {
      currentNodeStatus.set(node.id, node.status);
      const previousStatus = previousNodeStatusRef.current.get(node.id);

      // If node just completed (changed from non-completed to completed)
      if (node.status === 'completed' && previousStatus !== 'completed') {
        node.connections.forEach(edge => {
          const targetNode = nodes.find(n => n.id === edge.targetNodeId);
          if (targetNode && targetNode.status !== 'completed') {
            const transferId = `${node.id}-${edge.targetNodeId}-${currentTime}`;

            newActiveTransfers.push({
              id: transferId,
              sourceNodeId: node.id,
              targetNodeId: edge.targetNodeId,
              startTime: currentTime,
              duration: edge.transferTime || 1,
              progress: 0,
            });
          }
        });
      }
    });

    // Update previous status reference
    previousNodeStatusRef.current = currentNodeStatus;

    if (newActiveTransfers.length > 0) {
      setActiveTransfers(prev => [...prev, ...newActiveTransfers]);
    }
  }, [nodes, isSimulationRunning, currentTime]);

  // Update transfer progress and remove completed ones
  useEffect(() => {
    if (!isSimulationRunning || activeTransfers.length === 0) return;

    setActiveTransfers(
      prev =>
        prev
          .map(transfer => {
            const elapsed = currentTime - transfer.startTime;
            const progress = Math.min(Math.max(elapsed / transfer.duration, 0), 1);
            return { ...transfer, progress };
          })
          .filter(transfer => transfer.progress < 1) // Remove completed transfers
    );
  }, [currentTime, isSimulationRunning]);

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
    const clampedRatio = Math.max(0.1, Math.min(0.9, ratio));
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

  // Slide label away from overlapping node
  const slideAwayFromNode = (label: LabelPosition, node: NodeBounds): void => {
    const testPositions = [0.2, 0.8, 0.35, 0.65, 0.15, 0.85];
    const padding = 15;

    for (const testRatio of testPositions) {
      const testPos = getPositionOnLine(label.lineStart, label.lineEnd, testRatio);
      const testX = testPos.x - label.width / 2;
      const testY = testPos.y - label.height / 2;

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

    label.positionRatio = label.positionRatio < 0.5 ? 0.15 : 0.85;
    updateLabelPosition(label);
    label.displaced = true;
  };

  // Slide two overlapping labels apart along their lines
  const slideLabelsApart = (label1: LabelPosition, label2: LabelPosition): void => {
    const separationDistance = 0.15;

    if (label1.positionRatio < label2.positionRatio) {
      label1.positionRatio = Math.max(0.1, label1.positionRatio - separationDistance);
      label2.positionRatio = Math.min(0.9, label2.positionRatio + separationDistance);
    } else {
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

      for (let i = 0; i < result.length; i++) {
        const overlappingNode = doesLabelOverlapWithNode(result[i], nodeBounds);
        if (overlappingNode) {
          hasOverlap = true;
          slideAwayFromNode(result[i], overlappingNode);
        }
      }

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
          positionRatio: 0.5,
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

          // Find active transfer for this connection
          const activeTransfer = activeTransfers.find(
            t => t.sourceNodeId === node.id && t.targetNodeId === edge.targetNodeId
          );

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
                className={`transition-all duration-300 ${activeTransfer ? 'animate-pulse' : ''}`}
              />

              {/* Animated data transfer dot */}
              {activeTransfer && activeTransfer.progress < 1 && (
                <g>
                  {/* Main transfer dot */}
                  <circle
                    cx={startX + (endX - startX) * activeTransfer.progress}
                    cy={startY + (endY - startY) * activeTransfer.progress}
                    r="8"
                    fill={strokeColor}
                    stroke="white"
                    strokeWidth="2"
                    opacity="0.9"
                    style={{
                      filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.2))',
                    }}
                  />

                  {/* Subtle glow effect */}
                  <circle
                    cx={startX + (endX - startX) * activeTransfer.progress}
                    cy={startY + (endY - startY) * activeTransfer.progress}
                    r="12"
                    fill={strokeColor}
                    opacity="0.3"
                    className="animate-pulse"
                  />
                </g>
              )}

              {/* Transfer amount label */}
              <g>
                {/* Optional indicator when displaced */}
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
                  className={`transition-all duration-300 ${
                    activeTransfer ? 'shadow-lg animate-pulse' : ''
                  }`}
                  style={{
                    filter: activeTransfer ? 'drop-shadow(0px 2px 8px rgba(0,0,0,0.1))' : 'none',
                  }}
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

                {/* Progress indicator overlay when active */}
                {activeTransfer && (
                  <rect
                    x={labelPos.x}
                    y={labelPos.y + labelPos.height - 2}
                    width={labelPos.width * activeTransfer.progress}
                    height="2"
                    rx="1"
                    fill={labelPos.strokeColor}
                    opacity="0.6"
                  />
                )}
              </g>
            </g>
          );
        })
      )}
    </>
  );
}
