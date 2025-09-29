// utils/workflowPresets.ts - Workflow type presets with REDUCED CONNECTIVITY

import type { WorkflowNode } from '../types';
import { generateProbabilisticWorkflow } from './probabilisticGenerator';

export type WorkflowType =
  | 'scientific'
  | 'dataPipeline'
  | 'machineLearning'
  | 'complex'
  | 'balanced';

/**
 * SCIENTIFIC WORKFLOWS - REDUCED CONNECTIVITY
 * Best for: Research, simulations, data analysis pipelines
 * Characteristics: Diamond shape, coordinator hubs, moderate complexity
 */
export const createScientificWorkflow = (nodeCount: number): WorkflowNode[] => {
  return generateProbabilisticWorkflow({
    nodeCount,
    topologyType: 'diamond', // Gradual expand then contract
    levelDistribution: 'poisson', // Natural level count variation
    levelParams: { lambda: 4 }, // Average 4 levels
    widthDistribution: 'power_law', // Few wide levels, many narrow ones
    widthParams: { alpha: 2.5 }, // Moderate power-law exponent

    // REDUCED CONNECTIVITY PARAMETERS
    edgeProbability: 0.25, // REDUCED from 0.4 to 0.25
    connectivityDecay: 0.9, // INCREASED from 0.8 to 0.9 (faster decay = fewer long connections)
    hubProbability: 0.08, // REDUCED from 0.15 to 0.08
    maxEdgeSpan: 2, // REDUCED from 3 to 2
    clusteringCoefficient: 0.2, // REDUCED from 0.3 to 0.2
    preferentialAttachment: false, // DISABLED to prevent rich-get-richer

    gammaParams: { shape: 2.0, scale: 4 },
  });
};

/**
 * DATA PROCESSING PIPELINES - MINIMAL CONNECTIVITY
 * Best for: ETL, stream processing, sequential data transformation
 * Characteristics: Sequential stages, high local clustering, minimal hubs
 */
export const createDataPipeline = (nodeCount: number): WorkflowNode[] => {
  return generateProbabilisticWorkflow({
    nodeCount,
    topologyType: 'pipeline', // Many sequential stages
    levelDistribution: 'geometric', // Exponentially decreasing level probability
    levelParams: { p: 0.3 }, // 30% chance to stop adding levels
    widthDistribution: 'exponential', // Most levels narrow, few wide
    widthParams: { scale: 0.4 }, // Low scale = prefer narrow levels

    // MINIMAL CONNECTIVITY PARAMETERS
    edgeProbability: 0.15, // VERY LOW - pipelines should be sparse
    connectivityDecay: 0.95, // VERY HIGH decay - mostly adjacent connections
    hubProbability: 0.02, // MINIMAL hubs in pipelines
    maxEdgeSpan: 1, // ONLY adjacent level connections
    clusteringCoefficient: 0.1, // MINIMAL clustering
    preferentialAttachment: false, // NO preferential attachment

    gammaParams: { shape: 1.2, scale: 2 },
  });
};

/**
 * MACHINE LEARNING WORKFLOWS - CONTROLLED CONNECTIVITY
 * Best for: Training pipelines, hyperparameter tuning, model ensemble
 * Characteristics: High parallelism, but controlled connections
 */
export const createMLWorkflow = (nodeCount: number): WorkflowNode[] => {
  return generateProbabilisticWorkflow({
    nodeCount,
    topologyType: 'fan', // High parallelism
    widthDistribution: 'poisson', // Natural width variation
    widthParams: { lambda: 5 }, // Average 5 nodes per level

    // CONTROLLED CONNECTIVITY PARAMETERS
    edgeProbability: 0.2, // REDUCED from higher values
    connectivityDecay: 0.8, // MODERATE decay for some long connections
    hubProbability: 0.1, // REDUCED from 0.2 to 0.1
    maxEdgeSpan: 2, // REDUCED from longer spans
    clusteringCoefficient: 0.15, // REDUCED clustering
    preferentialAttachment: false, // DISABLED to control connection growth

    gammaParams: { shape: 1.8, scale: 6 },
  });
};

/**
 * COMPLEX HIGHLY-CONNECTED WORKFLOWS - STILL REDUCED FROM BEFORE
 * Best for: Testing complex scenarios, but not overly dense
 * Characteristics: More connections than others, but still reasonable
 */
export const createComplexWorkflow = (nodeCount: number): WorkflowNode[] => {
  return generateProbabilisticWorkflow({
    nodeCount,
    topologyType: 'custom',
    levelDistribution: 'poisson',
    levelParams: { lambda: Math.ceil(Math.sqrt(nodeCount)) },
    widthDistribution: 'power_law',
    widthParams: { alpha: 2.0 }, // Lower alpha = more hubs
    maxWidth: Math.min(Math.floor(nodeCount * 0.4), nodeCount - 2),

    // REDUCED EVEN FOR "COMPLEX" WORKFLOWS
    edgeProbability: 0.2, // REDUCED from 0.6 to 0.4
    connectivityDecay: 0.7, // INCREASED from 0.5 to 0.7
    hubProbability: 0.15, // REDUCED from 0.25 to 0.15
    maxEdgeSpan: 3, // REDUCED from 4 to 3
    clusteringCoefficient: 0.25, // REDUCED from 0.4 to 0.25
    preferentialAttachment: false, // DISABLED even for complex

    gammaParams: { shape: 1.5, scale: 3 },
  });
};

/**
 * BALANCED WORKFLOWS - SPARSE AND CLEAN
 * Best for: General use, testing, balanced characteristics
 * Characteristics: Clean, readable structure with minimal excess connections
 */
export const createBalancedWorkflow = (nodeCount: number): WorkflowNode[] => {
  return generateProbabilisticWorkflow({
    nodeCount,
    topologyType: 'balanced',
    widthDistribution: 'poisson',
    widthParams: { lambda: Math.ceil(nodeCount / 4) },

    // SPARSE, CLEAN PARAMETERS
    edgeProbability: 0.2, // REDUCED for clean appearance
    connectivityDecay: 0.85, // HIGH decay for local connections
    hubProbability: 0.05, // MINIMAL hubs
    maxEdgeSpan: 2, // SHORT spans only
    clusteringCoefficient: 0.15, // MINIMAL clustering
    preferentialAttachment: false, // NO preferential attachment

    maxWidth: Math.ceil(nodeCount / 3),
    singleSink: true,
    gammaParams: { shape: 1.5, scale: 3 },
  });
};

/**
 * WORKFLOW METADATA FOR DISPLAY (Updated descriptions)
 */
export const workflowTypeMetadata = {
  scientific: {
    name: 'Scientific Research',
    description: 'Research workflows with sparse coordinator tasks and clean structure',
    icon: '🔬',
    characteristics: ['Diamond shape', 'Few coordinators', 'Clean connections'],
    bestFor: 'Data analysis, simulations, research pipelines',
  },
  dataPipeline: {
    name: 'Data Pipeline',
    description: 'Sequential processing stages with minimal cross-connections',
    icon: '🔄',
    characteristics: ['Sequential stages', 'Adjacent connections', 'Pipeline structure'],
    bestFor: 'ETL processes, stream processing, data transformation',
  },
  machineLearning: {
    name: 'Machine Learning',
    description: 'Parallel workflows with controlled connectivity',
    icon: '🤖',
    characteristics: ['Controlled parallelism', 'Fan structure', 'Sparse connections'],
    bestFor: 'Model training, hyperparameter tuning, ensemble methods',
  },
  complex: {
    name: 'Complex Systems',
    description: 'More connected workflows but still readable and manageable',
    icon: '🕸️',
    characteristics: ['Moderate connections', 'Some hubs', 'Controlled complexity'],
    bestFor: 'Testing scenarios, distributed computing, moderate mesh networks',
  },
  balanced: {
    name: 'Balanced General',
    description: 'Clean, sparse workflows ideal for visualization and testing',
    icon: '⚖️',
    characteristics: ['Sparse connections', 'Clean structure', 'Highly readable'],
    bestFor: 'General testing, benchmarking, clean visualizations',
  },
};

/**
 * MAIN WORKFLOW GENERATOR FUNCTION
 * This is the main function your HomeScreen should call
 */
export const createWorkflowByType = (nodeCount: number, type: WorkflowType): WorkflowNode[] => {
  switch (type) {
    case 'scientific':
      return createScientificWorkflow(nodeCount);
    case 'dataPipeline':
      return createDataPipeline(nodeCount);
    case 'machineLearning':
      return createMLWorkflow(nodeCount);
    case 'complex':
      return createComplexWorkflow(nodeCount);
    case 'balanced':
      return createBalancedWorkflow(nodeCount);
    default:
      return createBalancedWorkflow(nodeCount);
  }
};

/**
 * GET WORKFLOW METADATA FOR DISPLAY
 */
export const getWorkflowMetadata = (nodes: WorkflowNode[]) => {
  return {
    generationMethod: 'probabilistic',
    levelCount: Math.max(...nodes.map(n => n.level || 0)) + 1,
    totalNodes: nodes.length,
    averageConnectivity: nodes.reduce((sum, n) => sum + n.connections.length, 0) / nodes.length,
    totalEdges: nodes.reduce((sum, n) => sum + n.connections.length, 0),
    maxWidth: Math.max(
      ...Array.from(new Set(nodes.map(n => n.level))).map(
        level => nodes.filter(n => n.level === level).length
      )
    ),
  };
};

/**
 * LEGACY COMPATIBILITY - Direct replacement for createComplexArbitraryWorkflow
 */
export const createComplexArbitraryWorkflow = (nodeCount: number): WorkflowNode[] => {
  return createBalancedWorkflow(nodeCount);
};
