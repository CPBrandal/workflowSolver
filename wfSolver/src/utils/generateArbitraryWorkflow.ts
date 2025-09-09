// utils/generateArbitraryWorkflow.ts
import { randomGamma, randomBeta, randomUniform } from 'd3-random';
import type { WorkflowNode } from '../types';

interface DistributionConfig {
  duration: {
    type: 'gamma' | 'beta' | 'uniform';
    params: GammaParams | BetaParams | UniformParams;
  };
  transferAmount: {
    type: 'gamma' | 'beta' | 'uniform';
    params: GammaParams | BetaParams | UniformParams;
  };
}

interface GammaParams {
  shape: number;  // α (alpha)
  scale: number;  // scale parameter (1/rate)
  min?: number;   // minimum value
  max?: number;   // maximum value
}

interface BetaParams {
  alpha: number;  // α shape parameter
  beta: number;   // β shape parameter
  min: number;    // minimum bound
  max: number;    // maximum bound
}

interface UniformParams {
  min: number;
  max: number;
}

interface ArbitraryWorkflowConfig {
  nodeCount: number;
  
  // Core DAG structure parameters (based on DAGGEN approach)
  maxWidth?: number;           // Maximum nodes per level (parallelism)
  maxDepth?: number;           // Maximum number of levels
  edgeProbability?: number;    // Probability of creating dependencies (0-1)
  maxEdgeSpan?: number;        // Maximum levels an edge can span
  
  // Workflow-specific parameters
  singleSink?: boolean;        // Whether to create a single end node
  densityFactor?: number;      // Controls overall edge density (0-1)
  
  // Distribution configurations
  distributions?: DistributionConfig;
  
  // Legacy compatibility
  maxDuration?: number;
  minDuration?: number;
  maxTransferAmount?: number;
  minTransferAmount?: number;
}

// Default distributions for realistic workflow modeling
/* const DEFAULT_DISTRIBUTIONS: DistributionConfig = {
  duration: {
    type: 'gamma',
    params: {
      shape: 2,      // Moderate right skew
      scale: 2,      // Average duration around 4 hours
      min: 0.5,      // Minimum 30 minutes
      max: 24        // Maximum 24 hours
    } as GammaParams
  },
  transferAmount: {
    type: 'beta',
    params: {
      alpha: 2,      // Skewed toward lower amounts
      beta: 5,       
      min: 1000,     // Minimum $1,000
      max: 100000    // Maximum $100,000
    } as BetaParams
  }
}; */

export function generateArbitraryWorkflow(config: ArbitraryWorkflowConfig): WorkflowNode[] {
  const {
    nodeCount,
    maxWidth = Math.max(2, Math.ceil(Math.sqrt(nodeCount))), // Dynamic width based on node count
    maxDepth = Math.max(3, Math.ceil(nodeCount / maxWidth)),
    edgeProbability = 0.4,
    maxEdgeSpan = 3,
    singleSink = true,
    densityFactor = 0.6,
    distributions,
    maxDuration = 10,
    minDuration = 1,
    maxTransferAmount = 100000,
    minTransferAmount = 1000
  } = config;

  console.log('Generating arbitrary workflow with DAGGEN approach:', { 
    nodeCount, maxWidth, maxDepth, edgeProbability, maxEdgeSpan 
  });

  if (nodeCount < 1) {
    throw new Error('Node count must be at least 1');
  }

  if (nodeCount > 50) {
    throw new Error('Node count cannot exceed 50');
  }

  if (minDuration < 1 || maxDuration < minDuration) {
    throw new Error('Invalid duration settings');
  }

  // Use provided distributions or create defaults from legacy params
  const finalDistributions = distributions || createLegacyDistributions(
    minDuration, maxDuration, minTransferAmount, maxTransferAmount
  );

  // Create distribution samplers using d3-random
  const getDuration = createDistributionSampler(finalDistributions.duration);
  const getTransferAmount = createDistributionSampler(finalDistributions.transferAmount);

  try {
    const nodes = generateDAGWorkflow({
      nodeCount,
      maxWidth,
      maxDepth,
      edgeProbability,
      maxEdgeSpan,
      singleSink,
      densityFactor,
      getDuration,
      getTransferAmount
    });

    console.log('Generated arbitrary workflow with levels:', nodes);
    
    if (!nodes || nodes.length === 0) {
      throw new Error('Failed to generate workflow nodes');
    }

    return nodes;
    
  } catch (error) {
    console.error('Error in generateArbitraryWorkflow:', error);
    throw new Error(`Failed to generate arbitrary workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function createLegacyDistributions(
  minDuration: number, 
  maxDuration: number, 
  minTransferAmount: number, 
  maxTransferAmount: number
): DistributionConfig {
  return {
    duration: {
      type: 'uniform',
      params: { min: minDuration, max: maxDuration } as UniformParams
    },
    transferAmount: {
      type: 'uniform',
      params: { min: minTransferAmount, max: maxTransferAmount } as UniformParams
    }
  };
}

function createDistributionSampler(config: DistributionConfig['duration'] | DistributionConfig['transferAmount']): () => number {
  if (config.type === 'gamma') {
    const params = config.params as GammaParams;
    const gammaRng = randomGamma(params.shape, params.scale);
    return () => {
      let value = gammaRng();
      
      // Apply bounds if specified
      if (params.min !== undefined) {
        value = Math.max(value, params.min);
      }
      if (params.max !== undefined) {
        value = Math.min(value, params.max);
      }
      
      return Math.round(value * 100) / 100; // Round to 2 decimal places
    };
  } else if (config.type === 'beta') {
    const params = config.params as BetaParams;
    const betaRng = randomBeta(params.alpha, params.beta);
    return () => {
      // Sample from beta distribution [0,1] then scale to [min,max]
      const betaValue = betaRng();
      const scaledValue = params.min + betaValue * (params.max - params.min);
      return Math.round(scaledValue * 100) / 100;
    };
  } else if (config.type === 'uniform') {
    const params = config.params as UniformParams;
    const uniformRng = randomUniform(params.min, params.max);
    return () => {
      const value = uniformRng();
      return Math.round(value * 100) / 100;
    };
  }
  
  throw new Error(`Unsupported distribution type: ${config.type}`);
}

interface DAGGenerationParams {
  nodeCount: number;
  maxWidth: number;
  maxDepth: number;
  edgeProbability: number;
  maxEdgeSpan: number;
  singleSink: boolean;
  densityFactor: number;
  getDuration: () => number;
  getTransferAmount: () => number;
}

function generateDAGWorkflow({
  nodeCount,
  maxWidth,
  maxDepth,
  edgeProbability,
  maxEdgeSpan,
  singleSink,
  densityFactor,
  getDuration,
  getTransferAmount
}: DAGGenerationParams): WorkflowNode[] {
  
  // Step 1: Distribute nodes across levels
  const levels = distributeNodesAcrossLevels(nodeCount, maxDepth, maxWidth);
  
  // Step 2: Create nodes with level information
  const nodes: WorkflowNode[] = [];
  let nodeId = 1;
  
  for (let level = 0; level < levels.length; level++) {
    const nodesInLevel = levels[level];
    const levelWidth = Math.min(nodesInLevel, maxWidth);
    
    for (let i = 0; i < nodesInLevel; i++) {
      const node: WorkflowNode = {
        id: nodeId.toString(),
        name: level === 0 ? 'Start' : 
              level === levels.length - 1 && singleSink && nodesInLevel === 1 ? 'Complete' : 
              `Task ${nodeId}`,
        status: 'pending',
        x: calculateXPosition(i, levelWidth),
        y: level,
        connections: [],
        level: level,
        description: level === 0 ? 'Initialize workflow execution' :
                    level === levels.length - 1 && singleSink && nodesInLevel === 1 ? 'Complete workflow execution' :
                    `Execute task ${nodeId}`,
        duration: getDuration(),
        transferAmount: getTransferAmount()
      };
      
      nodes.push(node);
      nodeId++;
    }
  }
  
  // Step 3: Generate dependencies between levels
  generateDependencies(nodes, levels, edgeProbability, maxEdgeSpan, densityFactor);
  
  // Step 4: Ensure workflow connectivity
  ensureWorkflowConnectivity(nodes, levels, singleSink);  
  return nodes;
}

function distributeNodesAcrossLevels(nodeCount: number, maxDepth: number, maxWidth: number): number[] {
  if (nodeCount === 1) {
    return [1];
  }
  
  // Calculate optimal depth
  const optimalDepth = Math.min(maxDepth, Math.max(2, Math.ceil(Math.log2(nodeCount))));
  const levels: number[] = new Array(optimalDepth).fill(0);
  
  // Distribute nodes using a bell curve distribution
  let remainingNodes = nodeCount;
  
  if (optimalDepth === 2) {
    // Simple case: start and end
    levels[0] = 1;
    levels[1] = remainingNodes - 1;
  } else {
    // First level always has 1 node (entry point)
    levels[0] = 1;
    remainingNodes--;
    
    // Distribute remaining nodes across middle levels
    for (let level = 1; level < optimalDepth - 1; level++) {
      const nodesForLevel = Math.min(
        maxWidth,
        Math.ceil(remainingNodes * getBellCurveWeight(level, optimalDepth))
      );
      levels[level] = Math.max(1, nodesForLevel);
      remainingNodes -= levels[level];
    }
    
    // Last level gets remaining nodes (minimum 1)
    levels[optimalDepth - 1] = Math.max(1, remainingNodes);
  }
  
  return levels;
}

function getBellCurveWeight(level: number, totalLevels: number): number {
  const center = totalLevels / 2;
  const variance = totalLevels / 4;
  return Math.exp(-Math.pow(level - center, 2) / (2 * variance)) / Math.sqrt(2 * Math.PI * variance);
}

function calculateXPosition(index: number, levelWidth: number): number {
  if (levelWidth === 1) return 2; // Center
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
  // Group nodes by level for easier access
  const nodesByLevel: WorkflowNode[][] = [];
  let nodeIndex = 0;
  
  for (let level = 0; level < levels.length; level++) {
    nodesByLevel[level] = nodes.slice(nodeIndex, nodeIndex + levels[level]);
    nodeIndex += levels[level];
  }
  
  // Generate dependencies between levels
  for (let sourceLevel = 0; sourceLevel < levels.length - 1; sourceLevel++) {
    const sourceNodes = nodesByLevel[sourceLevel];
    
    // Determine target levels within edge span
    const maxTargetLevel = Math.min(levels.length - 1, sourceLevel + maxEdgeSpan);
    
    for (const sourceNode of sourceNodes) {
      // Generate connections to subsequent levels
      for (let targetLevel = sourceLevel + 1; targetLevel <= maxTargetLevel; targetLevel++) {
        const targetNodes = nodesByLevel[targetLevel];
        
        // Adjust probability based on distance and density
        const distance = targetLevel - sourceLevel;
        const adjustedProbability = edgeProbability * densityFactor * Math.pow(0.7, distance - 1);
        
        for (const targetNode of targetNodes) {
          if (Math.random() < adjustedProbability) {
            if (!sourceNode.connections.includes(targetNode.id)) {
              sourceNode.connections.push(targetNode.id);
            }
          }
        }
      }
    }
  }
}

function ensureWorkflowConnectivity(nodes: WorkflowNode[], levels: number[], singleSink: boolean): void {
  // Group nodes by level
  const nodesByLevel: WorkflowNode[][] = [];
  let nodeIndex = 0;
  
  for (let level = 0; level < levels.length; level++) {
    nodesByLevel[level] = nodes.slice(nodeIndex, nodeIndex + levels[level]);
    nodeIndex += levels[level];
  }
  
  const finalLevel = levels.length - 1;
  const sinkNode = singleSink ? nodesByLevel[finalLevel][0] : null;
  
  // First, ensure basic connectivity between adjacent levels
  for (let level = 0; level < levels.length - 1; level++) {
    const sourceNodes = nodesByLevel[level];
    const targetNodes = nodesByLevel[level + 1];
    
    // Skip connecting to sink level for now - we'll handle that specially
    if (singleSink && level + 1 === finalLevel) {
      continue;
    }
    
    // Check if there are any connections between these levels
    let hasConnection = false;
    for (const sourceNode of sourceNodes) {
      for (const targetNode of targetNodes) {
        if (sourceNode.connections.includes(targetNode.id)) {
          hasConnection = true;
          break;
        }
      }
      if (hasConnection) break;
    }
    
    // If no connections exist, create at least one
    if (!hasConnection) {
      const randomSource = sourceNodes[Math.floor(Math.random() * sourceNodes.length)];
      const randomTarget = targetNodes[Math.floor(Math.random() * targetNodes.length)];
      randomSource.connections.push(randomTarget.id);
    }
  }
  
  // Handle single sink connectivity
  if (singleSink && sinkNode) {
    // Find all nodes that have no outgoing connections (terminal nodes)
    const terminalNodes = nodes.filter(node => 
      node.connections.length === 0 && node.id !== sinkNode.id
    );
    
    // Connect all terminal nodes to the sink
    for (const terminalNode of terminalNodes) {
      terminalNode.connections.push(sinkNode.id);
    }
    
    // Also ensure that at least one node from the second-to-last level connects to sink
    if (finalLevel > 0) {
      const secondToLastLevel = nodesByLevel[finalLevel - 1];
      const hasConnectionToSink = secondToLastLevel.some(node => 
        node.connections.includes(sinkNode.id)
      );
      
      if (!hasConnectionToSink && secondToLastLevel.length > 0) {
        // Connect a random node from second-to-last level to sink
        const randomNode = secondToLastLevel[Math.floor(Math.random() * secondToLastLevel.length)];
        randomNode.connections.push(sinkNode.id);
      }
    }
  }
  
  // Ensure no orphaned nodes (except the start node)
  for (let level = 1; level < levels.length; level++) {
    const nodesInLevel = nodesByLevel[level];
    
    // Skip the sink node - it's not supposed to have incoming connections from our algorithm
    const nodesToCheck = singleSink && level === finalLevel ? 
      nodesInLevel.slice(1) : nodesInLevel;
    
    for (const node of nodesToCheck) {
      // Check if this node has any incoming connections
      const hasIncoming = nodes.some(n => n.connections.includes(node.id));
      
      if (!hasIncoming) {
        // Connect from a random node in the previous level
        const previousLevel = nodesByLevel[level - 1];
        const randomSource = previousLevel[Math.floor(Math.random() * previousLevel.length)];
        randomSource.connections.push(node.id);
      }
    }
  }
}

// Export the enhanced configuration type
export type { ArbitraryWorkflowConfig };

// Example usage with advanced configurations:
export const createComplexArbitraryWorkflow = (nodeCount: number) => {
  return generateArbitraryWorkflow({
    nodeCount,
    maxWidth: Math.ceil(nodeCount / 3),
    maxDepth: Math.ceil(Math.sqrt(nodeCount)) + 2,
    edgeProbability: 0.5,
    maxEdgeSpan: 2,
    singleSink: true,
    densityFactor: 0.7,
    distributions: {
      duration: {
        type: 'gamma',
        params: {
          shape: 1.5,
          scale: 3,
          min: 0.25,
          max: 20
        }
      },
      transferAmount: {
        type: 'beta',
        params: {
          alpha: 2,
          beta: 8,
          min: 2500,
          max: 150000
        }
      }
    }
  });
};