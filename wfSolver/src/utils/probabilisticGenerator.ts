import type { ArbitraryWorkflowConfig, Edge, WorkflowNode } from '../types';
import { gammaSampler } from './gammaSampler';

// Enhanced configuration with probabilistic parameters
export interface ProbabilisticWorkflowConfig extends ArbitraryWorkflowConfig {
  // Topology shape parameters
  topologyType?: 'diamond' | 'pipeline' | 'fan' | 'balanced' | 'custom';

  // Distribution parameters for level generation
  levelDistribution?: 'poisson' | 'geometric' | 'uniform';
  levelParams?: { lambda?: number; p?: number; min?: number; max?: number };

  // Width distribution parameters
  widthDistribution?: 'poisson' | 'power_law' | 'exponential' | 'uniform';
  widthParams?: { lambda?: number; alpha?: number; scale?: number };

  // Connectivity parameters
  connectivityDecay?: number; // How quickly connectivity decreases with distance
  hubProbability?: number; // Probability of creating hub nodes

  // Structural constraints
  minLevels?: number;
  maxLevels?: number;

  // Advanced parameters
  clusteringCoefficient?: number; // For creating clustered regions
  preferentialAttachment?: boolean; // Use preferential attachment for edges
}

/**
 * Probabilistic sampler utilities
 */
class ProbabilisticSamplers {
  /**
   * Poisson distribution sampler using Knuth's algorithm
   */
  static poisson(lambda: number): number {
    if (lambda < 0) return 0;
    if (lambda === 0) return 0;

    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1.0;

    do {
      k++;
      p *= Math.random();
    } while (p > L);

    return k - 1;
  }

  /**
   * Geometric distribution sampler
   */
  static geometric(p: number): number {
    if (p <= 0 || p >= 1) return 1;
    return Math.floor(Math.log(Math.random()) / Math.log(1 - p)) + 1;
  }

  /**
   * Power-law distribution sampler (using inverse transform)
   */
  static powerLaw(alpha: number, xMin: number = 1, xMax: number = 100): number {
    const r = Math.random();
    const exp = 1 - alpha;
    const numerator = (xMax ** exp - xMin ** exp) * r + xMin ** exp;
    return Math.floor(numerator ** (1 / exp));
  }

  /**
   * Exponential distribution sampler
   */
  static exponential(rate: number): number {
    return -Math.log(Math.random()) / rate;
  }
}

/**
 * Advanced probabilistic workflow generator
 */
export function generateProbabilisticWorkflow(config: ProbabilisticWorkflowConfig): WorkflowNode[] {
  const {
    nodeCount,
    topologyType = 'balanced',
    levelDistribution = 'poisson',
    levelParams = { lambda: 3 },
    widthDistribution = 'poisson',
    widthParams = { lambda: 3 },
    connectivityDecay = 0.7,
    hubProbability = 0.1,
    minLevels = 3,
    maxLevels = Math.max(6, Math.ceil(Math.sqrt(nodeCount))),
    clusteringCoefficient = 0.3,
    preferentialAttachment = false,
    gammaParams = { shape: 1.5, scale: 3 },
    maxWidth = Math.floor((nodeCount - 2) * 0.6), // Conservative max width
    edgeProbability = 0.4,
    maxEdgeSpan = 3,
  } = config;

  if (nodeCount < 3) {
    throw new Error('Node count must be at least 3 for start->middle->end structure');
  }

  const effectiveMaxWidth = Math.min(maxWidth, nodeCount - 2);
  const getDuration = gammaSampler(gammaParams);
  const getTransferTime = gammaSampler(gammaParams);

  // Phase 1: Generate level structure using probabilistic methods
  const levelStructure = generateLevelStructure(
    nodeCount,
    topologyType,
    levelDistribution,
    levelParams,
    minLevels,
    maxLevels
  );

  // Phase 2: Distribute nodes across levels using probabilistic width assignment
  const levelWidths = distributeLevelWidths(
    levelStructure,
    nodeCount,
    widthDistribution,
    widthParams,
    effectiveMaxWidth
  );

  // Phase 3: Create nodes with distributed properties
  const nodes = createNodesWithDistribution(levelWidths, getDuration);

  // Phase 4: Generate edges using advanced probabilistic connectivity
  generateProbabilisticConnectivity(
    nodes,
    levelWidths,
    connectivityDecay,
    hubProbability,
    clusteringCoefficient,
    preferentialAttachment,
    edgeProbability,
    maxEdgeSpan,
    getTransferTime
  );

  // Phase 5: Ensure workflow validity
  ensureWorkflowValidity(nodes, levelWidths, getTransferTime);

  console.log('Generated probabilistic workflow:', {
    levels: levelWidths.length,
    levelDistribution: levelWidths,
    totalNodes: nodes.length,
    topology: topologyType,
  });

  return nodes;
}

/**
 * Phase 1: Generate level structure based on topology type and distributions
 */
function generateLevelStructure(
  nodeCount: number,
  topologyType: string,
  distribution: string,
  params: any,
  minLevels: number,
  maxLevels: number
): number {
  let targetLevels: number;

  switch (topologyType) {
    case 'diamond':
      targetLevels = Math.max(minLevels, Math.min(maxLevels, Math.ceil(Math.sqrt(nodeCount)) + 2));
      break;
    case 'pipeline':
      targetLevels = Math.max(minLevels, Math.min(maxLevels, Math.ceil(nodeCount / 2)));
      break;
    case 'fan':
      targetLevels = Math.max(minLevels, Math.min(maxLevels, Math.ceil(Math.log(nodeCount)) + 2));
      break;
    case 'balanced':
      targetLevels = Math.max(
        minLevels,
        Math.min(maxLevels, Math.ceil(Math.pow(nodeCount, 1 / 3)) + 3)
      );
      break;
    case 'custom':
      switch (distribution) {
        case 'poisson':
          targetLevels = ProbabilisticSamplers.poisson(params.lambda || 4);
          break;
        case 'geometric':
          targetLevels = ProbabilisticSamplers.geometric(params.p || 0.3);
          break;
        case 'uniform':
          targetLevels = Math.floor(Math.random() * (params.max - params.min + 1)) + params.min;
          break;
        default:
          targetLevels = Math.ceil(Math.sqrt(nodeCount)) + 2;
      }
      break;
    default:
      targetLevels = Math.ceil(Math.sqrt(nodeCount)) + 2;
  }

  return Math.max(minLevels, Math.min(maxLevels, targetLevels));
}

/**
 * Phase 2: Distribute nodes across levels with probabilistic width assignment
 */
function distributeLevelWidths(
  numLevels: number,
  nodeCount: number,
  distribution: string,
  params: any,
  maxWidth: number
): number[] {
  const widths = new Array(numLevels).fill(0);

  // Reserve start and end nodes
  widths[0] = 1; // Start node
  widths[numLevels - 1] = 1; // End node
  let remainingNodes = nodeCount - 2;

  // For middle levels (1 to numLevels-2)
  const middleLevels = numLevels - 2;

  if (middleLevels <= 0) {
    return widths;
  }

  // Generate width for each middle level using the specified distribution
  const targetWidths: number[] = [];
  let totalTargetWidth = 0;

  for (let i = 0; i < middleLevels; i++) {
    let width: number;

    switch (distribution) {
      case 'poisson':
        width = Math.max(1, ProbabilisticSamplers.poisson(params.lambda || 3));
        break;
      case 'power_law':
        width = Math.max(1, ProbabilisticSamplers.powerLaw(params.alpha || 2.0, 1, maxWidth));
        break;
      case 'exponential':
        width = Math.max(1, Math.floor(ProbabilisticSamplers.exponential(params.scale || 0.5)));
        break;
      case 'uniform':
        width = Math.floor(Math.random() * maxWidth) + 1;
        break;
      default:
        width = Math.max(1, ProbabilisticSamplers.poisson(3));
    }

    width = Math.min(width, maxWidth);
    targetWidths.push(width);
    totalTargetWidth += width;
  }

  // Scale to fit remaining nodes while maintaining proportions
  if (totalTargetWidth > 0) {
    const scaleFactor = remainingNodes / totalTargetWidth;
    let assignedNodes = 0;

    for (let i = 0; i < middleLevels; i++) {
      if (i === middleLevels - 1) {
        // Last level gets remaining nodes
        widths[i + 1] = remainingNodes - assignedNodes;
      } else {
        const scaledWidth = Math.max(1, Math.round(targetWidths[i] * scaleFactor));
        widths[i + 1] = Math.min(scaledWidth, maxWidth);
        assignedNodes += widths[i + 1];
      }
    }

    // Ensure we don't exceed maxWidth constraint
    for (let i = 1; i < numLevels - 1; i++) {
      if (widths[i] > maxWidth) {
        const excess = widths[i] - maxWidth;
        widths[i] = maxWidth;

        // Redistribute excess to other levels
        for (let j = 1; j < numLevels - 1 && excess > 0; j++) {
          if (j !== i && widths[j] < maxWidth) {
            const canTake = Math.min(excess, maxWidth - widths[j]);
            widths[j] += canTake;
          }
        }
      }
    }
  }

  return widths;
}

/**
 * Phase 3: Create nodes with distributed properties
 */
function createNodesWithDistribution(
  levelWidths: number[],
  getDuration: () => number
): WorkflowNode[] {
  const nodes: WorkflowNode[] = [];
  let nodeId = 1;

  for (let level = 0; level < levelWidths.length; level++) {
    const nodesInLevel = levelWidths[level];

    for (let i = 0; i < nodesInLevel; i++) {
      const isStart = level === 0;
      const isEnd = level === levelWidths.length - 1;

      const node: WorkflowNode = {
        id: nodeId.toString(),
        name: isStart ? 'Start' : isEnd ? 'Complete' : `Task ${nodeId}`,
        status: 'pending',
        position: {
          x: calculateXPosition(i, nodesInLevel),
          y: level,
        },
        connections: [],
        level: level,
        description: isStart
          ? 'Initialize workflow execution'
          : isEnd
            ? 'Complete workflow execution'
            : `Execute task ${nodeId}`,
        executionTime: getDuration(),
        criticalPath: false,
      };

      nodes.push(node);
      nodeId++;
    }
  }

  return nodes;
}

/**
 * Phase 4: Generate sophisticated probabilistic connectivity
 */
function generateProbabilisticConnectivity(
  nodes: WorkflowNode[],
  levelWidths: number[],
  connectivityDecay: number,
  hubProbability: number,
  clusteringCoefficient: number,
  preferentialAttachment: boolean,
  baseEdgeProbability: number,
  maxEdgeSpan: number,
  getTransferTime: () => number
): void {
  const nodesByLevel = groupNodesByLevel(nodes, levelWidths);

  // Identify hub nodes probabilistically
  const hubNodes = new Set<string>();
  for (let level = 1; level < levelWidths.length - 1; level++) {
    for (const node of nodesByLevel[level]) {
      if (Math.random() < hubProbability) {
        hubNodes.add(node.id);
      }
    }
  }

  // Generate edges with distance-based probability decay
  for (let sourceLevel = 0; sourceLevel < levelWidths.length - 1; sourceLevel++) {
    const sourceNodes = nodesByLevel[sourceLevel];

    for (const sourceNode of sourceNodes) {
      const maxTargetLevel = Math.min(levelWidths.length - 1, sourceLevel + maxEdgeSpan);

      for (let targetLevel = sourceLevel + 1; targetLevel <= maxTargetLevel; targetLevel++) {
        const targetNodes = nodesByLevel[targetLevel];
        const distance = targetLevel - sourceLevel;

        // Calculate distance-based probability
        const distanceProbability = baseEdgeProbability * Math.pow(connectivityDecay, distance - 1);

        for (const targetNode of targetNodes) {
          let edgeProbability = distanceProbability;

          // Boost probability for hub connections
          if (hubNodes.has(sourceNode.id) || hubNodes.has(targetNode.id)) {
            edgeProbability *= 1.5;
          }

          // Preferential attachment: boost probability based on existing degree
          if (preferentialAttachment) {
            const sourceDegree = sourceNode.connections.length + 1;
            const targetInDegree = countIncomingEdges(targetNode, nodes) + 1;
            edgeProbability *= Math.log(sourceDegree * targetInDegree) / 10;
          }

          // Apply clustering coefficient for local connectivity
          if (Math.random() < clusteringCoefficient) {
            edgeProbability *= 1.3;
          }

          // Create edge if probability check passes
          if (Math.random() < Math.min(0.9, edgeProbability)) {
            const edgeExists = sourceNode.connections.some(
              edge => edge.targetNodeId === targetNode.id
            );

            if (!edgeExists) {
              const newEdge: Edge = {
                sourceNodeId: sourceNode.id,
                targetNodeId: targetNode.id,
                transferTime: getTransferTime(),
                label: `${sourceNode.name} → ${targetNode.name}`,
              };
              sourceNode.connections.push(newEdge);
            }
          }
        }
      }
    }
  }
}

/**
 * Phase 5: Ensure workflow validity and connectivity
 */
function ensureWorkflowValidity(
  nodes: WorkflowNode[],
  levelWidths: number[],
  getTransferTime: () => number
): void {
  const nodesByLevel = groupNodesByLevel(nodes, levelWidths);

  // Ensure basic connectivity between adjacent levels
  for (let level = 0; level < levelWidths.length - 1; level++) {
    const sourceNodes = nodesByLevel[level];
    const targetNodes = nodesByLevel[level + 1];

    // Check if any connection exists between these levels
    let hasConnection = false;
    for (const sourceNode of sourceNodes) {
      for (const targetNode of targetNodes) {
        if (sourceNode.connections.some(edge => edge.targetNodeId === targetNode.id)) {
          hasConnection = true;
          break;
        }
      }
      if (hasConnection) break;
    }

    // If no connection exists, create one
    if (!hasConnection) {
      const randomSource = sourceNodes[Math.floor(Math.random() * sourceNodes.length)];
      const randomTarget = targetNodes[Math.floor(Math.random() * targetNodes.length)];

      const newEdge: Edge = {
        sourceNodeId: randomSource.id,
        targetNodeId: randomTarget.id,
        transferTime: getTransferTime(),
        label: `${randomSource.name} → ${randomTarget.name}`,
      };
      randomSource.connections.push(newEdge);
    }
  }

  // Ensure no orphaned nodes (except start and end)
  for (let level = 1; level < levelWidths.length - 1; level++) {
    for (const node of nodesByLevel[level]) {
      // Check incoming edges
      const hasIncoming = nodes.some(n =>
        n.connections.some(edge => edge.targetNodeId === node.id)
      );

      if (!hasIncoming && level > 0) {
        const previousLevel = nodesByLevel[level - 1];
        const randomSource = previousLevel[Math.floor(Math.random() * previousLevel.length)];

        const newEdge: Edge = {
          sourceNodeId: randomSource.id,
          targetNodeId: node.id,
          transferTime: getTransferTime(),
          label: `${randomSource.name} → ${node.name}`,
        };
        randomSource.connections.push(newEdge);
      }

      // Check outgoing edges (except for end node)
      if (level < levelWidths.length - 1 && node.connections.length === 0) {
        const nextLevel = nodesByLevel[level + 1];
        const randomTarget = nextLevel[Math.floor(Math.random() * nextLevel.length)];

        const newEdge: Edge = {
          sourceNodeId: node.id,
          targetNodeId: randomTarget.id,
          transferTime: getTransferTime(),
          label: `${node.name} → ${randomTarget.name}`,
        };
        node.connections.push(newEdge);
      }
    }
  }
}

/**
 * Utility functions
 */
function groupNodesByLevel(nodes: WorkflowNode[], levelWidths: number[]): WorkflowNode[][] {
  const nodesByLevel: WorkflowNode[][] = [];
  let nodeIndex = 0;

  for (let level = 0; level < levelWidths.length; level++) {
    nodesByLevel[level] = nodes.slice(nodeIndex, nodeIndex + levelWidths[level]);
    nodeIndex += levelWidths[level];
  }

  return nodesByLevel;
}

function calculateXPosition(index: number, levelWidth: number): number {
  if (levelWidth === 1) return 2;
  const spacing = 4 / (levelWidth - 1);
  return index * spacing;
}

function countIncomingEdges(node: WorkflowNode, allNodes: WorkflowNode[]): number {
  return allNodes.reduce((count, sourceNode) => {
    return count + sourceNode.connections.filter(edge => edge.targetNodeId === node.id).length;
  }, 0);
}
