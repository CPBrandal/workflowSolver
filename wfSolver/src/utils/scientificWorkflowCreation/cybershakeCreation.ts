// utils/cybershakeWorkflowGenerator.ts - Deterministic CyberShake Workflow Generator

import {
  EXECUTION_PARAM_DISTRIBUTIONS,
  TRANSFER_PARAM_DISTRIBUTIONS,
} from '../../constants/constants';
import type { Edge, WorkflowNode } from '../../types';
import { createGammaParam } from '../createGammaParam';
import { gammaSampler } from '../gammaSampler';

/**
 * CyberShake Workflow Structure:
 *
 * The CyberShake workflow is used by SCEC for Probabilistic Seismic Hazard Analysis (PSHA).
 * It models earthquake hazards through seismic wave propagation simulations.
 *
 * Stages:
 * 1. ExtractSGT: Extract Strain Green Tensors (SGT) from seismic velocity models
 *    - Represents different rupture variations or source models
 *    - Parallel extraction for different model components
 *
 * 2. SeismogramSynthesis: Generate synthetic seismograms from SGTs
 *    - Each SGT spawns multiple seismogram calculations
 *    - Represents different recording stations or frequency ranges
 *
 * 3. ZipSeis: Aggregate and compress all seismogram data
 *    - Central coordination point for data management
 *    - Prepares data for peak value calculations
 *
 * 4. PeakValCalcOkaya: Calculate peak ground motion values
 *    - Uses Okaya method for spectral acceleration
 *    - Parallel calculation for different stations/frequencies
 *
 * 5. ZipPSA: Aggregate Probabilistic Seismic Analysis results
 *    - Final coordination for hazard curve generation
 *    - Produces hazard maps and statistics
 */

export interface CyberShakeConfig {
  numRuptures: number; // Number of rupture scenarios (affects ExtractSGT count)
  numStations: number; // Number of recording stations (affects synthesis parallelism)
}

/**
 * Create a deterministic CyberShake workflow matching the actual structure
 */
export function createDeterministicCyberShakeWorkflow(
  numRuptures: number = 2,
  numStations: number = 4
): WorkflowNode[] {
  if (numRuptures < 1) {
    throw new Error('CyberShake workflow requires at least 1 rupture scenario');
  }
  if (numStations < 1) {
    throw new Error('CyberShake workflow requires at least 1 recording station');
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

  // ============================================================================
  // LEVEL 0: START NODE
  // ============================================================================
  const startNode = createNode('Start', 0, 2, 'Initialize CyberShake PSHA workflow');
  nodes.push(startNode);

  // ============================================================================
  // LEVEL 1: ExtractSGT - Extract Strain Green Tensors
  // ============================================================================
  const extractSGTNodes: WorkflowNode[] = [];

  for (let i = 0; i < numRuptures; i++) {
    const xPos = i * (4 / Math.max(numRuptures - 1, 1));
    const node = createNode(
      `ExtractSGT-${i + 1}`,
      1,
      xPos,
      `Extract Strain Green Tensor for rupture scenario ${i + 1}`
    );
    nodes.push(node);
    extractSGTNodes.push(node);

    // Connect start to all ExtractSGT nodes
    startNode.connections.push(createEdge(startNode, node));
  }

  // ============================================================================
  // LEVEL 2: SeismogramSynthesis - Generate synthetic seismograms
  // ============================================================================
  // Each ExtractSGT node generates seismograms for multiple stations
  const seismogramNodes: WorkflowNode[] = [];
  const seismogramsPerSGT = numStations;

  for (let sgtIdx = 0; sgtIdx < extractSGTNodes.length; sgtIdx++) {
    const sgtNode = extractSGTNodes[sgtIdx];

    for (let stationIdx = 0; stationIdx < seismogramsPerSGT; stationIdx++) {
      const globalIdx = sgtIdx * seismogramsPerSGT + stationIdx;
      const totalSeismograms = numRuptures * seismogramsPerSGT;
      const xPos = globalIdx * (4 / Math.max(totalSeismograms - 1, 1));

      const node = createNode(
        `SeismogramSynthesis-${globalIdx + 1}`,
        2,
        xPos,
        `Synthesize seismogram for station ${stationIdx + 1} (rupture ${sgtIdx + 1})`
      );
      nodes.push(node);
      seismogramNodes.push(node);

      // Connect SGT to its seismogram syntheses
      sgtNode.connections.push(createEdge(sgtNode, node));
    }
  }

  // ============================================================================
  // LEVEL 3: ZipSeis - Aggregate and compress seismogram data
  // ============================================================================
  const zipSeisNode = createNode(
    'ZipSeis',
    3,
    2,
    'Aggregate and compress all seismogram data for peak value analysis'
  );
  nodes.push(zipSeisNode);

  // All seismogram nodes connect to ZipSeis (aggregation point)
  for (const seismogramNode of seismogramNodes) {
    seismogramNode.connections.push(createEdge(seismogramNode, zipSeisNode));
  }

  // ============================================================================
  // LEVEL 4: PeakValCalcOkaya - Calculate peak ground motion values
  // ============================================================================
  // Calculate peak values for each station across all rupture scenarios
  const peakValNodes: WorkflowNode[] = [];
  const numPeakCalcs = numRuptures * numStations;

  for (let i = 0; i < numPeakCalcs; i++) {
    const xPos = i * (4 / Math.max(numPeakCalcs - 1, 1));
    const rupture = Math.floor(i / numStations) + 1;
    const station = (i % numStations) + 1;

    const node = createNode(
      `PeakValCalcOkaya-${i + 1}`,
      4,
      xPos,
      `Calculate peak spectral acceleration (station ${station}, rupture ${rupture})`
    );
    nodes.push(node);
    peakValNodes.push(node);

    // ZipSeis broadcasts to all peak value calculations
    zipSeisNode.connections.push(createEdge(zipSeisNode, node));
  }

  // ============================================================================
  // LEVEL 5: ZipPSA - Aggregate Probabilistic Seismic Analysis results
  // ============================================================================
  const zipPSANode = createNode('ZipPSA', 5, 2, 'Aggregate PSA results and generate hazard curves');
  nodes.push(zipPSANode);

  // All peak value calculations connect to ZipPSA (final aggregation)
  for (const peakValNode of peakValNodes) {
    peakValNode.connections.push(createEdge(peakValNode, zipPSANode));
  }

  // ============================================================================
  // LEVEL 6: END NODE
  // ============================================================================
  const endNode = createNode(
    'Complete',
    6,
    2,
    'CyberShake PSHA workflow complete - hazard analysis ready'
  );
  nodes.push(endNode);
  zipPSANode.connections.push(createEdge(zipPSANode, endNode));

  console.log('Generated deterministic CyberShake workflow:', {
    totalNodes: nodes.length,
    numRuptures,
    numStations,
    levels: endNode.level + 1,
    structure: {
      ExtractSGT: numRuptures,
      SeismogramSynthesis: numRuptures * numStations,
      ZipSeis: 1,
      PeakValCalcOkaya: numPeakCalcs,
      ZipPSA: 1,
    },
    totalSeismograms: seismogramNodes.length,
    totalPeakCalcs: peakValNodes.length,
  });

  return nodes;
}

/**
 * Wrapper function that matches the existing workflow preset interface
 */
export const createCybershakeWorkflow = (nodeCount: number): WorkflowNode[] => {
  // CyberShake scales with: numRuptures * numStations
  // Typical ratio: 2-4 ruptures, 4-8 stations per rupture

  // Map nodeCount to ruptures and stations
  // Target structure: ExtractSGT (R) → Seismograms (R*S) → ZipSeis → PeakVal (R*S) → ZipPSA
  // Total nodes ≈ 1 + R + R*S + 1 + R*S + 1 + 1 = 2*R*S + R + 4

  // Solve for R and S given nodeCount
  // For balanced workflows: R = sqrt(nodeCount/8), S = 4
  // For large workflows: R = sqrt(nodeCount/4), S = sqrt(nodeCount/4)

  let numRuptures: number;
  let numStations: number;

  if (nodeCount <= 30) {
    // Small workflow: 2 ruptures, scale stations
    numRuptures = 2;
    numStations = Math.max(2, Math.floor((nodeCount - 6) / 6));
  } else if (nodeCount <= 100) {
    // Medium workflow: balanced scaling
    numRuptures = Math.max(2, Math.floor(Math.sqrt(nodeCount / 6)));
    numStations = Math.max(2, Math.floor(nodeCount / (6 * numRuptures)));
  } else {
    // Large workflow: scale both dimensions
    numRuptures = Math.max(3, Math.floor(Math.sqrt(nodeCount / 4)));
    numStations = Math.max(4, Math.floor(nodeCount / (4 * numRuptures)));
  }

  return createDeterministicCyberShakeWorkflow(numRuptures, numStations);
};
