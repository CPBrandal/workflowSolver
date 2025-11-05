// utils/broadbandWorkflowGenerator.ts - Deterministic Broadband Workflow Generator

import {
  EXECUTION_PARAM_DISTRIBUTIONS,
  TRANSFER_PARAM_DISTRIBUTIONS,
} from '../../constants/constants';
import type { Edge, WorkflowNode } from '../../types';
import { createGammaParam } from '../createGammaParam';
import { gammaSampler } from '../gammaSampler';

/**
 * Broadband Workflow Structure:
 *
 * The Broadband workflow is used by SCEC to integrate multiple seismic simulation codes,
 * combining low-frequency deterministic and high-frequency stochastic seismograms.
 *
 * Stages:
 * 1. createSRF: Create Seismic Rupture Format files from different source models
 *    - Multiple parallel sources (UCSB, URS, etc.)
 *    - Each represents a different seismic code/model
 *
 * 2. lp_seisgen: Low-pass seismogram generation (deterministic)
 *    - One per source model
 *    - Generates low-frequency components
 *
 * 3. Synthesis methods: Multiple approaches for combining frequencies
 *    - urs_hf_seisgen: URS high-frequency stochastic method
 *    - sdsu_hf_seisgen: SDSU high-frequency method
 *    - ucsb_seisgen: UCSB broadband synthesis
 *    - Each lp_seisgen fans out to multiple synthesis methods
 *
 * 4. rspectra: Calculate response spectra for engineering analysis
 *    - One per synthesis method
 *    - Generates spectral acceleration values
 *
 * Structure: Dual-pipeline tree where each source branches into multiple processing paths
 */

export interface BroadbandConfig {
  numSources: number; // Number of source models (minimum 2)
  synthesisPerSource: number; // Number of synthesis methods per source (minimum 3)
}

/**
 * Create a deterministic Broadband workflow matching the actual structure
 */
export function createDeterministicBroadbandWorkflow(
  numSources: number = 2,
  synthesisPerSource: number = 3
): WorkflowNode[] {
  if (numSources < 1) {
    throw new Error('Broadband workflow requires at least 1 source model');
  }
  if (synthesisPerSource < 1) {
    throw new Error('Broadband workflow requires at least 1 synthesis method per source');
  }

  const nodes: WorkflowNode[] = [];
  let nodeId = 1;

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

  // Source model names (cycle through these)
  const sourceNames = ['ucsb', 'urs', 'sdsu', 'usgs'];

  // Synthesis method names (cycle through these)
  const synthesisNames = [
    'urs_hf_seisgen',
    'sdsu_hf_seisgen',
    'ucsb_seisgen',
    'gp_seisgen',
    'exsim_seisgen',
  ];

  // ============================================================================
  // LEVEL 0: START NODE
  // ============================================================================
  const startNode = createNode('Start', 0, 2, 'Initialize Broadband workflow');
  nodes.push(startNode);

  // ============================================================================
  // LEVEL 1: createSRF - Create Seismic Rupture Format files
  // ============================================================================
  const createSRFNodes: WorkflowNode[] = [];

  for (let i = 0; i < numSources; i++) {
    const sourceName = sourceNames[i % sourceNames.length];
    const xPos = i * (4 / Math.max(numSources - 1, 1));
    const node = createNode(
      `${sourceName}_createSRF`,
      1,
      xPos,
      `Create SRF file using ${sourceName.toUpperCase()} source model`
    );
    nodes.push(node);
    createSRFNodes.push(node);

    // Connect start to all createSRF nodes
    startNode.connections.push(createEdge(startNode, node));
  }

  // ============================================================================
  // LEVEL 2: lp_seisgen - Low-pass seismogram generation
  // ============================================================================
  const lpSeisgenNodes: WorkflowNode[] = [];

  for (let i = 0; i < numSources; i++) {
    const xPos = i * (4 / Math.max(numSources - 1, 1));
    const node = createNode(
      `urs_lp_seisgen-${i + 1}`,
      2,
      xPos,
      `Generate low-frequency deterministic seismogram (source ${i + 1})`
    );
    nodes.push(node);
    lpSeisgenNodes.push(node);

    // Each createSRF connects to its corresponding lp_seisgen
    createSRFNodes[i].connections.push(createEdge(createSRFNodes[i], node));
  }

  // ============================================================================
  // LEVEL 3: Synthesis methods - Combine low and high frequency
  // ============================================================================
  const synthesisNodes: WorkflowNode[] = [];

  for (let sourceIdx = 0; sourceIdx < numSources; sourceIdx++) {
    const lpNode = lpSeisgenNodes[sourceIdx];

    for (let synthIdx = 0; synthIdx < synthesisPerSource; synthIdx++) {
      const globalIdx = sourceIdx * synthesisPerSource + synthIdx;
      const totalSynthesis = numSources * synthesisPerSource;
      const xPos = globalIdx * (4 / Math.max(totalSynthesis - 1, 1));

      const synthesisName = synthesisNames[synthIdx % synthesisNames.length];

      const node = createNode(
        `${synthesisName}-${globalIdx + 1}`,
        3,
        xPos,
        `Synthesize seismogram using ${synthesisName} (source ${sourceIdx + 1})`
      );
      nodes.push(node);
      synthesisNodes.push(node);

      // Each lp_seisgen fans out to multiple synthesis methods
      lpNode.connections.push(createEdge(lpNode, node));
    }
  }

  // ============================================================================
  // LEVEL 4: rspectra - Calculate response spectra
  // ============================================================================
  const rspectraNodes: WorkflowNode[] = [];

  for (let i = 0; i < synthesisNodes.length; i++) {
    const synthesisNode = synthesisNodes[i];
    const xPos = i * (4 / Math.max(synthesisNodes.length - 1, 1));

    const node = createNode(
      `rspectra-${i + 1}`,
      4,
      xPos,
      `Calculate response spectra for engineering analysis (synthesis ${i + 1})`
    );
    nodes.push(node);
    rspectraNodes.push(node);

    // Each synthesis method connects to its rspectra calculation
    synthesisNode.connections.push(createEdge(synthesisNode, node));
  }

  // ============================================================================
  // LEVEL 5: END NODE
  // ============================================================================
  const endNode = createNode('Complete', 5, 2, 'Broadband seismic simulation complete');
  nodes.push(endNode);

  // All rspectra nodes connect to end
  for (const rspectraNode of rspectraNodes) {
    rspectraNode.connections.push(createEdge(rspectraNode, endNode));
  }

  console.log('Generated deterministic Broadband workflow:', {
    totalNodes: nodes.length,
    numSources,
    synthesisPerSource,
    levels: endNode.level + 1,
    structure: {
      createSRF: numSources,
      lp_seisgen: numSources,
      synthesis: numSources * synthesisPerSource,
      rspectra: numSources * synthesisPerSource,
    },
    branchingFactor: synthesisPerSource,
  });

  return nodes;
}

/**
 * Calculate optimal source and synthesis counts from total node count
 */
function calculateBroadbandParameters(nodeCount: number): {
  numSources: number;
  synthesisPerSource: number;
} {
  // Broadband structure: Start + (sources) + (sources) + (sources*synth) + (sources*synth) + End
  // Total = 1 + s + s + s*n + s*n + 1 = 2*s + 2*s*n + 2 = 2*s*(1 + n) + 2
  // nodeCount = 2*s*(1 + n) + 2
  // nodeCount - 2 = 2*s*(1 + n)
  // (nodeCount - 2) / 2 = s*(1 + n)

  // For minimum structure: 2 sources, 3 synthesis per source
  // Minimum nodes = 2*2*(1 + 3) + 2 = 2*2*4 + 2 = 16 + 2 = 18

  const minNodes = 18;

  if (nodeCount < minNodes) {
    // Use minimum configuration
    return { numSources: 2, synthesisPerSource: 3 };
  }

  const workingNodes = (nodeCount - 2) / 2; // Remove start and end

  // Try to balance sources and synthesis methods
  // For small workflows, keep sources at 2, scale synthesis
  if (nodeCount <= 30) {
    const numSources = 2;
    const synthesisPerSource = Math.max(3, Math.floor(workingNodes / (numSources * 2)));
    return { numSources, synthesisPerSource };
  }

  // For medium workflows, scale both
  if (nodeCount <= 60) {
    const numSources = Math.max(2, Math.floor(Math.sqrt(workingNodes / 2)));
    const synthesisPerSource = Math.max(3, Math.floor(workingNodes / (numSources * 2)));
    return { numSources, synthesisPerSource };
  }

  // For large workflows, scale both dimensions more
  const numSources = Math.max(3, Math.floor(Math.sqrt(workingNodes / 1.5)));
  const synthesisPerSource = Math.max(3, Math.floor(workingNodes / (numSources * 2)));

  return { numSources, synthesisPerSource };
}

/**
 * Wrapper function that matches the existing workflow preset interface
 */
export const createBroadbandWorkflow = (nodeCount: number): WorkflowNode[] => {
  const { numSources, synthesisPerSource } = calculateBroadbandParameters(nodeCount);
  return createDeterministicBroadbandWorkflow(numSources, synthesisPerSource);
};
