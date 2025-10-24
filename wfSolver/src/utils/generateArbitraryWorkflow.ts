import {
  EXECUTION_PARAM_DISTRIBUTIONS,
  TRANSFER_PARAM_DISTRIBUTIONS,
} from '../constants/constants';
import type {
  ArbitraryWorkflowConfig,
  DAGGenerationParams,
  Edge,
  GammaParams,
  WorkflowNode,
} from '../types';
import { createGammaParam } from './createGammaParam';
import { gammaSampler } from './gammaSampler';

export function generateArbitraryWorkflow(config: ArbitraryWorkflowConfig): WorkflowNode[] {
  const {
    nodeCount,
    maxWidth = Math.max(2, Math.ceil(Math.sqrt(nodeCount))),
    maxDepth = Math.max(4, Math.ceil(nodeCount / 1.5)),
    edgeProbability = 0.4,
    maxEdgeSpan = 3,
    singleSink = true,
    densityFactor = 0.6,
  } = config;

  console.log('Generating arbitrary workflow:', {
    nodeCount,
    maxWidth,
    maxDepth,
    edgeProbability,
    maxEdgeSpan,
  });

  if (nodeCount < 1) {
    throw new Error('Node count must be at least 1');
  }

  if (nodeCount > 200) {
    throw new Error('Node count cannot exceed 50');
  }

  try {
    const nodes = generateDAGWorkflow({
      nodeCount,
      maxWidth,
      maxDepth,
      edgeProbability,
      maxEdgeSpan,
      singleSink,
      densityFactor,
    });

    console.log(
      'Generated workflow with levels:',
      nodes.map(n => ({ id: n.id, level: n.level, name: n.name, duration: n.executionTime }))
    );

    if (!nodes || nodes.length === 0) {
      throw new Error('Failed to generate workflow nodes');
    }

    return nodes;
  } catch (error) {
    console.error('Error in generateArbitraryWorkflow:', error);
    throw new Error(
      `Failed to generate arbitrary workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

function generateDAGWorkflow({
  nodeCount,
  maxWidth,
  maxDepth,
  edgeProbability,
  maxEdgeSpan,
  singleSink,
  densityFactor,
}: DAGGenerationParams): WorkflowNode[] {
  // Step 1: Distribute nodes across levels
  const levels = distributeNodesAcrossLevels(nodeCount, maxDepth, maxWidth, singleSink);

  // Step 2: Create nodes with gamma-distributed durations
  const nodes: WorkflowNode[] = [];
  let nodeId = 1;

  for (let level = 0; level < levels.length; level++) {
    const nodesInLevel = levels[level];
    const levelWidth = Math.min(nodesInLevel, maxWidth);

    for (let i = 0; i < nodesInLevel; i++) {
      const isLastLevel = level === levels.length - 1;
      const isSinkNode = singleSink && isLastLevel && i === 0;

      const shape = createGammaParam(EXECUTION_PARAM_DISTRIBUTIONS.SHAPE);
      const scale = createGammaParam(EXECUTION_PARAM_DISTRIBUTIONS.SCALE);

      const node: WorkflowNode = {
        id: nodeId.toString(),
        name: level === 0 ? 'Start' : isSinkNode ? 'Complete' : `Task ${nodeId}`,
        status: 'pending',
        position: {
          x: calculateXPosition(i, levelWidth),
          y: level,
        },
        connections: [],
        level: level,
        description:
          level === 0
            ? 'Initialize workflow execution'
            : isSinkNode
              ? 'Complete workflow execution'
              : `Execute task ${nodeId}`,
        executionTime: gammaSampler({ shape, scale })(),
        criticalPath: false,
        gammaDistribution: {
          shape,
          scale,
        },
      };

      nodes.push(node);
      nodeId++;
    }
  }

  // Step 3: Generate dependencies between levels
  generateDependencies(nodes, levels, edgeProbability, maxEdgeSpan, densityFactor);

  // Step 4: Ensure workflow connectivity
  ensureWorkflowConnectivity(nodes, levels, singleSink);

  // Step 5: Ensure all non-terminal nodes have outgoing connections
  ensureOutgoingConnections(nodes, levels, singleSink);

  return nodes;
}

function distributeNodesAcrossLevels(
  nodeCount: number,
  maxDepth: number,
  maxWidth: number,
  singleSink: boolean
): number[] {
  if (nodeCount === 1) {
    return [1];
  }

  const optimalDepth = Math.min(maxDepth, Math.max(3, Math.ceil(nodeCount / 2.5) + 1));
  console.log('Using optimal depth:', optimalDepth);

  const levels: number[] = new Array(optimalDepth).fill(0);
  let remainingNodes = nodeCount;

  levels[0] = 1;
  remainingNodes--;

  // Reserve 1 node for sink if needed
  if (singleSink && optimalDepth > 1) {
    levels[optimalDepth - 1] = 1;
    remainingNodes--;
  }

  // Distribute remaining nodes with gradual expansion then contraction
  if (optimalDepth > 2) {
    for (let level = 1; level < optimalDepth - (singleSink ? 1 : 0); level++) {
      if (remainingNodes <= 0) break;

      const midPoint = (optimalDepth - 1) / 2;
      const distanceFromMid = Math.abs(level - midPoint);
      const weight = Math.max(0.1, 1 - (distanceFromMid / midPoint) * 0.7);

      const nodesForLevel = Math.min(
        maxWidth,
        Math.max(
          1,
          Math.ceil((remainingNodes * weight) / (optimalDepth - level - (singleSink ? 1 : 0)))
        )
      );

      levels[level] = nodesForLevel;
      remainingNodes -= nodesForLevel;
    }
  }

  // Distribute any remaining nodes to middle levels
  let levelIndex = 1;
  while (remainingNodes > 0 && levelIndex < levels.length - (singleSink ? 1 : 0)) {
    if (levels[levelIndex] < maxWidth) {
      levels[levelIndex]++;
      remainingNodes--;
    }
    levelIndex = (levelIndex % (levels.length - (singleSink ? 2 : 1))) + 1;
  }

  if (!singleSink && levels[optimalDepth - 1] === 0) {
    levels[optimalDepth - 1] = 1;
  }

  console.log('Level distribution:', levels);
  return levels;
}

function calculateXPosition(index: number, levelWidth: number): number {
  if (levelWidth === 1) return 2;
  const spacing = 4 / (levelWidth - 1);
  return index * spacing;
}

function generateDependencies(
  nodes: WorkflowNode[],
  levels: number[],
  edgeProbability: number,
  maxEdgeSpan: number,
  densityFactor: number
): void {
  const nodesByLevel: WorkflowNode[][] = [];
  let nodeIndex = 0;

  for (let level = 0; level < levels.length; level++) {
    nodesByLevel[level] = nodes.slice(nodeIndex, nodeIndex + levels[level]);
    nodeIndex += levels[level];
  }

  for (let sourceLevel = 0; sourceLevel < levels.length - 1; sourceLevel++) {
    const sourceNodes = nodesByLevel[sourceLevel];
    const maxTargetLevel = Math.min(levels.length - 1, sourceLevel + maxEdgeSpan);

    for (const sourceNode of sourceNodes) {
      for (let targetLevel = sourceLevel + 1; targetLevel <= maxTargetLevel; targetLevel++) {
        const targetNodes = nodesByLevel[targetLevel];
        const distance = targetLevel - sourceLevel;
        const adjustedProbability = edgeProbability * densityFactor * Math.pow(0.7, distance - 1);

        for (const targetNode of targetNodes) {
          if (Math.random() < adjustedProbability) {
            // CHECK: Does this edge already exist?
            const edgeExists = sourceNode.connections.some(
              edge => edge.targetNodeId === targetNode.id
            );

            if (!edgeExists) {
              const shape = createGammaParam(TRANSFER_PARAM_DISTRIBUTIONS.SHAPE);
              const scale = createGammaParam(TRANSFER_PARAM_DISTRIBUTIONS.SCALE);
              const newEdge: Edge = {
                sourceNodeId: sourceNode.id,
                targetNodeId: targetNode.id,
                transferTime: gammaSampler({ shape, scale })(),
                label: `${sourceNode.name} → ${targetNode.name}`,
                gammaDistribution: {
                  shape,
                  scale,
                },
              };

              sourceNode.connections.push(newEdge);
            }
          }
        }
      }
    }
  }
}

function ensureWorkflowConnectivity(
  nodes: WorkflowNode[],
  levels: number[],
  singleSink: boolean
): void {
  const nodesByLevel: WorkflowNode[][] = [];
  let nodeIndex = 0;

  for (let level = 0; level < levels.length; level++) {
    nodesByLevel[level] = nodes.slice(nodeIndex, nodeIndex + levels[level]);
    nodeIndex += levels[level];
  }

  const finalLevel = levels.length - 1;
  const sinkNode = singleSink ? nodesByLevel[finalLevel][0] : null;

  // Ensure basic connectivity between adjacent levels
  for (let level = 0; level < levels.length - 1; level++) {
    const sourceNodes = nodesByLevel[level];
    const targetNodes = nodesByLevel[level + 1];

    let hasConnection = false;
    for (const sourceNode of sourceNodes) {
      for (const targetNode of targetNodes) {
        // Fix: Check edge exists
        if (sourceNode.connections.some(edge => edge.targetNodeId === targetNode.id)) {
          hasConnection = true;
          break;
        }
      }
      if (hasConnection) break;
    }

    if (!hasConnection) {
      const randomSource = sourceNodes[Math.floor(Math.random() * sourceNodes.length)];
      const randomTarget = targetNodes[Math.floor(Math.random() * targetNodes.length)];

      const shape = createGammaParam(TRANSFER_PARAM_DISTRIBUTIONS.SHAPE);
      const scale = createGammaParam(TRANSFER_PARAM_DISTRIBUTIONS.SCALE);

      const newEdge: Edge = {
        sourceNodeId: randomSource.id,
        targetNodeId: randomTarget.id,
        transferTime: gammaSampler({ shape, scale })(),
        label: `${randomSource.name} → ${randomTarget.name}`,
        gammaDistribution: {
          shape,
          scale,
        },
      };

      randomSource.connections.push(newEdge);
    }
  }

  // Handle single sink connectivity
  if (singleSink && sinkNode) {
    // Clear existing connections to sink from non-terminal nodes
    for (const node of nodes) {
      if (node.level !== undefined && node.level < finalLevel) {
        // Fix: Find edge index
        const sinkEdgeIndex = node.connections.findIndex(edge => edge.targetNodeId === sinkNode.id);
        if (sinkEdgeIndex > -1) {
          node.connections.splice(sinkEdgeIndex, 1);
        }
      }
    }

    // Connect all second-to-last level nodes to sink
    if (finalLevel > 0) {
      const secondToLastLevel = nodesByLevel[finalLevel - 1];
      for (const node of secondToLastLevel) {
        // Fix: Check if edge to sink exists
        if (!node.connections.some(edge => edge.targetNodeId === sinkNode.id)) {
          const shape = createGammaParam(TRANSFER_PARAM_DISTRIBUTIONS.SHAPE);
          const scale = createGammaParam(TRANSFER_PARAM_DISTRIBUTIONS.SCALE);

          const sinkEdge: Edge = {
            sourceNodeId: node.id,
            targetNodeId: sinkNode.id,
            transferTime: gammaSampler({ shape, scale })(),
            label: `${node.name} → ${sinkNode.name}`,
            gammaDistribution: {
              shape,
              scale,
            },
          };
          node.connections.push(sinkEdge);
        }
      }
    }
  }

  // Ensure no orphaned nodes
  for (let level = 1; level < levels.length; level++) {
    const nodesInLevel = nodesByLevel[level];

    for (const node of nodesInLevel) {
      if (singleSink && node === sinkNode) continue;

      // Fix: Check incoming edges
      const hasIncoming = nodes.some(n =>
        n.connections.some(edge => edge.targetNodeId === node.id)
      );

      if (!hasIncoming && level > 0) {
        const previousLevel = nodesByLevel[level - 1];
        const randomSource = previousLevel[Math.floor(Math.random() * previousLevel.length)];

        const shape = createGammaParam(TRANSFER_PARAM_DISTRIBUTIONS.SHAPE);
        const scale = createGammaParam(TRANSFER_PARAM_DISTRIBUTIONS.SCALE);

        const newEdge: Edge = {
          sourceNodeId: randomSource.id,
          targetNodeId: node.id,
          transferTime: gammaSampler({ shape, scale })(),
          label: `${randomSource.name} → ${node.name}`,
          gammaDistribution: {
            shape,
            scale,
          },
        };
        randomSource.connections.push(newEdge);
      }
    }
  }
}

function ensureOutgoingConnections(
  nodes: WorkflowNode[],
  levels: number[],
  singleSink: boolean
): void {
  const nodesByLevel: WorkflowNode[][] = [];
  let nodeIndex = 0;

  for (let level = 0; level < levels.length; level++) {
    nodesByLevel[level] = nodes.slice(nodeIndex, nodeIndex + levels[level]);
    nodeIndex += levels[level];
  }

  const finalLevel = levels.length - 1;
  const sinkNode = singleSink && finalLevel >= 0 ? nodesByLevel[finalLevel][0] : null;

  // Check each node (except those in the final level) to ensure it has outgoing connections
  for (let level = 0; level < finalLevel; level++) {
    const nodesInLevel = nodesByLevel[level];

    for (const node of nodesInLevel) {
      if (node.connections.length > 0) continue;

      let availableTargets: WorkflowNode[] = [];

      if (singleSink && sinkNode) {
        // In single sink mode, determine appropriate targets
        if (level === finalLevel - 1) {
          // Second-to-last level should connect to sink
          availableTargets = [sinkNode];
        } else {
          // Earlier levels should connect to intermediate levels, not directly to sink
          for (let targetLevel = level + 1; targetLevel < finalLevel; targetLevel++) {
            availableTargets.push(...nodesByLevel[targetLevel]);
          }
          // If no intermediate levels, then connect to sink
          if (availableTargets.length === 0 && sinkNode) {
            availableTargets = [sinkNode];
          }
        }
      } else {
        // Non-single sink mode: can connect to any subsequent level
        for (let targetLevel = level + 1; targetLevel < levels.length; targetLevel++) {
          availableTargets.push(...nodesByLevel[targetLevel]);
        }
      }

      if (availableTargets.length > 0) {
        const randomTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
        const shape = createGammaParam(TRANSFER_PARAM_DISTRIBUTIONS.SHAPE);
        const scale = createGammaParam(TRANSFER_PARAM_DISTRIBUTIONS.SCALE);
        const newEdge: Edge = {
          sourceNodeId: node.id,
          targetNodeId: randomTarget.id,
          transferTime: gammaSampler({ shape, scale })(),
          label: `${node.name} → ${randomTarget.name}`,
          gammaDistribution: { shape, scale },
        };

        node.connections.push(newEdge);
        console.log(
          `Added required outgoing connection: ${node.name} -> ${randomTarget.name} (${newEdge.transferTime}s)`
        );
      }
    }
  }

  // Special handling for single sink: ensure all non-sink final level nodes connect to sink
  if (singleSink && sinkNode && finalLevel > 0) {
    const finalLevelNodes = nodesByLevel[finalLevel];

    for (const node of finalLevelNodes) {
      if (node !== sinkNode && node.connections.length === 0) {
        // These nodes shouldn't exist in a proper single-sink workflow, but if they do,
        // connect them to the sink
        const shape = createGammaParam(TRANSFER_PARAM_DISTRIBUTIONS.SHAPE);
        const scale = createGammaParam(TRANSFER_PARAM_DISTRIBUTIONS.SCALE);
        const sinkEdge: Edge = {
          sourceNodeId: node.id,
          targetNodeId: sinkNode.id,
          transferTime: gammaSampler({ shape, scale })(),
          label: `${node.name} → ${sinkNode.name}`,
          gammaDistribution: { shape, scale },
        };
        node.connections.push(sinkEdge);
        console.log(
          `Connected orphaned final-level node to sink: ${node.name} -> ${sinkNode.name} (${sinkEdge.transferTime}s)`
        );
      }
    }
  }
}

// Export simplified configuration type
export type { ArbitraryWorkflowConfig, GammaParams };

// Simplified preset function with only gamma distribution
export const createComplexArbitraryWorkflow = (nodeCount: number) => {
  return generateArbitraryWorkflow({
    nodeCount,
    maxWidth: Math.ceil(nodeCount / 3),
    maxDepth: Math.ceil(Math.sqrt(nodeCount)) + 3,
    edgeProbability: 0.5,
    maxEdgeSpan: 2,
    singleSink: true,
    densityFactor: 0.7,
  });
};
