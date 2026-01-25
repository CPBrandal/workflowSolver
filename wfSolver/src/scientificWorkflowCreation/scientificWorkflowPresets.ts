// utils/workflowPresets.ts - Workflow type presets with REDUCED CONNECTIVITY

import type { WorkflowNode, WorkflowType } from '../utils/../types';
import { generateProbabilisticWorkflow } from '../utils/probabilisticGenerator';
import { createBroadbandWorkflow } from './broadbandCreation';
import { createCybershakeWorkflow } from './cybershakeCreation';
import { createEpigenomicsWorkflow } from './epigenomicCreation';
import { createMontageWorkflow } from './montageCreation';
import { createSiphtWorkflow } from './siphtCreation';

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

    maxWidth: Math.ceil(nodeCount / 3),
    singleSink: true,
  });
};

export const createScientificWorkflowByType = (
  nodeCount: number,
  type: WorkflowType
): WorkflowNode[] => {
  switch (type) {
    case 'montage':
      return createMontageWorkflow(nodeCount);
    case 'cybershake':
      return createCybershakeWorkflow(nodeCount);
    case 'epigenomics':
      return createEpigenomicsWorkflow(nodeCount);
    case 'broadband':
      return createBroadbandWorkflow(nodeCount);
    case 'sipht':
      return createSiphtWorkflow(nodeCount);
    default:
      return createBalancedWorkflow(nodeCount);
  }
};
