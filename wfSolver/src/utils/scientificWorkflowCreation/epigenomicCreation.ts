import {
  EXECUTION_PARAM_DISTRIBUTIONS,
  TRANSFER_PARAM_DISTRIBUTIONS,
} from '../../constants/constants';
import type { Edge, WorkflowNode } from '../../types';
import { createGammaParam } from '../createGammaParam';
import { gammaSampler } from '../gammaSampler';

export interface EpigenomicsConfig {
  nodeCount: number; // Total number of nodes in workflow (minimum 8 for straight line)
}

/**
 * Distribute tasks across 4 parallel levels
 * Each level starts with 1 node (base), then extra nodes are distributed evenly
 */
function distributeTasksAcrossLevels(totalNodes: number): number[] {
  // Minimum 8 nodes: 4 fixed (fastQSplit, mapMerge, maqIndex, pileup) + 4 parallel (1 per level)
  const minNodes = 8;
  const effectiveNodes = Math.max(minNodes, totalNodes);

  // Fixed nodes: fastQSplit, mapMerge, maqIndex, pileup
  const fixedNodes = 4;

  // Parallel nodes to distribute across 4 levels
  const parallelNodes = effectiveNodes - fixedNodes;

  // Base: each level gets at least 1 node
  const basePerLevel = 1;

  // Extra nodes beyond the base (4 nodes for straight line)
  const extraNodes = parallelNodes - 4;

  const distribution: number[] = [];
  if (extraNodes <= 0) {
    // Straight line: 1 node per level
    return [1, 1, 1, 1];
  }

  // Distribute extra nodes evenly
  const extraPerLevel = Math.floor(extraNodes / 4);
  const remainder = extraNodes % 4;

  for (let i = 0; i < 4; i++) {
    // Each level gets base + extra + (1 if in remainder)
    distribution.push(basePerLevel + extraPerLevel + (i < remainder ? 1 : 0));
  }

  return distribution;
}

/**
 * Create a deterministic Epigenomics workflow matching the actual structure
 * @param nodeCount Total number of nodes (minimum 8 enforced for straight line)
 */
export function createDeterministicEpigenomicsWorkflow(nodeCount: number = 8): WorkflowNode[] {
  if (nodeCount < 1) {
    throw new Error('Epigenomics workflow requires at least 1 node');
  }

  const nodes: WorkflowNode[] = [];
  let nodeId = 1;

  // Distribute nodes - minimum 8 nodes enforced
  const taskDistribution = distributeTasksAcrossLevels(nodeCount);

  // Helper to create gamma parameters
  const createExecParams = () => ({
    shape: createGammaParam(EXECUTION_PARAM_DISTRIBUTIONS.SHAPE),
    scale: createGammaParam(EXECUTION_PARAM_DISTRIBUTIONS.SCALE),
  });

  const createTransferParams = () => ({
    shape: createGammaParam(TRANSFER_PARAM_DISTRIBUTIONS.SHAPE),
    scale: createGammaParam(TRANSFER_PARAM_DISTRIBUTIONS.SCALE),
  });

  // Helper to create nodes
  const createNode = (
    name: string,
    level: number,
    xPos: number,
    description: string
  ): WorkflowNode => {
    const gammaParams = createExecParams();
    const node: WorkflowNode = {
      id: nodeId.toString(),
      name,
      status: 'pending',
      position: { x: xPos, y: level },
      connections: [],
      level,
      description,
      executionTime: gammaSampler(gammaParams)(),
      criticalPath: false,
      gammaDistribution: gammaParams,
    };
    nodeId++;
    return node;
  };

  // Helper to create edges
  const createEdge = (sourceNode: WorkflowNode, targetNode: WorkflowNode): Edge => {
    const transferParams = createTransferParams();
    return {
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      transferTime: gammaSampler(transferParams)(),
      label: `${sourceNode.name} → ${targetNode.name}`,
      gammaDistribution: transferParams,
    };
  };

  // ============================================================================
  // LEVEL 1: fastQSplit - Split input data into lanes
  // ============================================================================
  const fastQSplitNode = createNode(
    'fastQSplit',
    1,
    2,
    'Split input sequencing data into parallel processing lanes'
  );
  nodes.push(fastQSplitNode);

  // ============================================================================
  // LEVEL 2: filterContams - Filter contamination (parallel)
  // ============================================================================
  const filterContamsNodes: WorkflowNode[] = [];
  const numFilterContams = taskDistribution[0];

  for (let i = 0; i < numFilterContams; i++) {
    const xPos = i * (4 / Math.max(numFilterContams - 1, 1));
    const node = createNode(
      `filterContams-${i + 1}`,
      2,
      xPos,
      `Filter contamination from lane ${i + 1}`
    );
    nodes.push(node);
    filterContamsNodes.push(node);

    // fastQSplit fans out to all filterContams nodes
    fastQSplitNode.connections.push(createEdge(fastQSplitNode, node));
  }

  // ============================================================================
  // LEVEL 3: sol2sanger - Convert quality scores (parallel)
  // ============================================================================
  const sol2sangerNodes: WorkflowNode[] = [];
  const numSol2sanger = taskDistribution[1];

  for (let i = 0; i < numSol2sanger; i++) {
    const xPos = i * (4 / Math.max(numSol2sanger - 1, 1));
    const node = createNode(
      `sol2sanger-${i + 1}`,
      3,
      xPos,
      `Convert Solexa to Sanger quality scores for lane ${i + 1}`
    );
    nodes.push(node);
    sol2sangerNodes.push(node);
  }

  // Connect filterContams to sol2sanger with smart distribution
  for (let i = 0; i < filterContamsNodes.length; i++) {
    // Map to corresponding sol2sanger index, or nearest if counts differ
    const targetIdx = Math.min(
      Math.floor((i * numSol2sanger) / numFilterContams),
      numSol2sanger - 1
    );
    filterContamsNodes[i].connections.push(
      createEdge(filterContamsNodes[i], sol2sangerNodes[targetIdx])
    );
  }

  // ============================================================================
  // LEVEL 4: fastq2bfq - Convert to binary format (parallel)
  // ============================================================================
  const fastq2bfqNodes: WorkflowNode[] = [];
  const numFastq2bfq = taskDistribution[2];

  for (let i = 0; i < numFastq2bfq; i++) {
    const xPos = i * (4 / Math.max(numFastq2bfq - 1, 1));
    const node = createNode(
      `fastq2bfq-${i + 1}`,
      4,
      xPos,
      `Convert FASTQ to BFQ format for lane ${i + 1}`
    );
    nodes.push(node);
    fastq2bfqNodes.push(node);
  }

  // Connect sol2sanger to fastq2bfq with smart distribution
  for (let i = 0; i < sol2sangerNodes.length; i++) {
    const targetIdx = Math.min(Math.floor((i * numFastq2bfq) / numSol2sanger), numFastq2bfq - 1);
    sol2sangerNodes[i].connections.push(createEdge(sol2sangerNodes[i], fastq2bfqNodes[targetIdx]));
  }

  // ============================================================================
  // LEVEL 5: map - Align reads to reference genome (parallel)
  // ============================================================================
  const mapNodes: WorkflowNode[] = [];
  const numMap = taskDistribution[3];

  for (let i = 0; i < numMap; i++) {
    const xPos = i * (4 / Math.max(numMap - 1, 1));
    const node = createNode(
      `map-${i + 1}`,
      5,
      xPos,
      `Align reads to reference genome for lane ${i + 1}`
    );
    nodes.push(node);
    mapNodes.push(node);
  }

  // Connect fastq2bfq to map with smart distribution
  for (let i = 0; i < fastq2bfqNodes.length; i++) {
    const targetIdx = Math.min(Math.floor((i * numMap) / numFastq2bfq), numMap - 1);
    fastq2bfqNodes[i].connections.push(createEdge(fastq2bfqNodes[i], mapNodes[targetIdx]));
  }

  // ============================================================================
  // LEVEL 6: mapMerge - Merge all aligned reads (aggregation point)
  // ============================================================================
  const mapMergeNode = createNode('mapMerge', 6, 2, 'Merge all aligned reads from all lanes');
  nodes.push(mapMergeNode);

  // All map nodes connect to mapMerge (convergence point)
  for (const mapNode of mapNodes) {
    mapNode.connections.push(createEdge(mapNode, mapMergeNode));
  }

  // ============================================================================
  // LEVEL 7: maqIndex - Index merged alignment
  // ============================================================================
  const maqIndexNode = createNode('maqIndex', 7, 2, 'Create index for merged alignment data');
  nodes.push(maqIndexNode);
  mapMergeNode.connections.push(createEdge(mapMergeNode, maqIndexNode));

  // ============================================================================
  // LEVEL 8: pileup - Generate pileup format
  // ============================================================================
  const pileupNode = createNode(
    'pileup',
    8,
    2,
    'Generate pileup format showing base-by-base coverage'
  );
  nodes.push(pileupNode);
  maqIndexNode.connections.push(createEdge(maqIndexNode, pileupNode));

  console.log('Generated deterministic Epigenomics workflow:', {
    totalNodes: nodes.length,
    requestedNodes: nodeCount,
    enforced:
      nodeCount < 8 ? `Minimum 8 nodes enforced (requested ${nodeCount})` : 'No enforcement',
    levels: maqIndexNode.level + 1,
    taskDistribution: {
      filterContams: taskDistribution[0],
      sol2sanger: taskDistribution[1],
      fastq2bfq: taskDistribution[2],
      map: taskDistribution[3],
    },
    fixedNodes: {
      fastQSplit: 1,
      mapMerge: 1,
      maqIndex: 1,
      pileup: 1,
    },
  });

  return nodes;
}

/**
 * Wrapper function that matches the existing workflow preset interface
 * @param nodeCount Total number of nodes requested (minimum 8 enforced)
 */
export const createEpigenomicsWorkflow = (nodeCount: number): WorkflowNode[] => {
  // Pass nodeCount directly - the generator enforces minimum of 8 nodes
  return createDeterministicEpigenomicsWorkflow(nodeCount);
};
