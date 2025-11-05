// utils/siphtWorkflowGenerator.ts - Deterministic SIPHT Workflow Generator

import {
  EXECUTION_PARAM_DISTRIBUTIONS,
  TRANSFER_PARAM_DISTRIBUTIONS,
} from '../../constants/constants';
import type { Edge, WorkflowNode } from '../../types';
import { createGammaParam } from '../createGammaParam';
import { gammaSampler } from '../gammaSampler';

/**
 * SIPHT Workflow Structure:
 *
 * The SIPHT workflow is used at Harvard for discovering small untranslated RNAs (sRNAs)
 * that regulate processes like secretion and virulence in bacteria.
 *
 * Stages:
 * 1. Initial Analysis: Multiple independent search methods
 *    - Transterm: Terminator identification
 *    - Findterm: Alternative terminator finding
 *    - RNA_Motif: RNA structure motif search
 *    - Blast: Initial BLAST search
 *    - Patser: Pattern search (multiple parallel instances)
 *
 * 2. SRNA: Aggregate all initial findings
 *    - Central coordination point
 *    - Combines results from all search methods
 *
 * 3. FFN_Parse: Parse feature file
 *    - Prepares data for detailed BLAST analysis
 *
 * 4. BLAST Operations: Multiple parallel BLAST analyses
 *    - Blast_synteny: Synteny analysis
 *    - Blast_Candidate: Candidate sequence search
 *    - Blast_QRNA: QRNA comparative analysis
 *    - Blast_paralogues: Paralogue identification
 *
 * 5. Patser: Massive parallel pattern searches
 *    - Each BLAST operation spawns multiple Patser instances
 *    - Pattern matching across candidate sequences
 *
 * 6. Patser_Concate: Aggregate all Patser results
 *    - Second major aggregation point
 *    - Combines all pattern search results
 *
 * 7. SRNA_annotate: Final annotation and verification
 *    - Generates final sRNA annotations
 *
 * Structure: Complex multi-stage with two major aggregation points (SRNA, Patser_Concate)
 */

export interface SiphtConfig {
  numInitialSearches: number; // Number of initial search tasks (minimum 5)
  numBlastOps: number; // Number of BLAST operations (minimum 4)
  patserPerBlast: number; // Number of Patser tasks per BLAST (minimum 3)
}

/**
 * Create a deterministic SIPHT workflow matching the actual structure
 */
export function createDeterministicSiphtWorkflow(
  numInitialSearches: number = 5,
  numBlastOps: number = 4,
  patserPerBlast: number = 4
): WorkflowNode[] {
  if (numInitialSearches < 1) {
    throw new Error('SIPHT workflow requires at least 1 initial search task');
  }
  if (numBlastOps < 1) {
    throw new Error('SIPHT workflow requires at least 1 BLAST operation');
  }
  if (patserPerBlast < 1) {
    throw new Error('SIPHT workflow requires at least 1 Patser per BLAST');
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

  // Task names for initial searches
  const initialSearchNames = ['Transterm', 'Findterm', 'RNA_Motif', 'Blast', 'Patser'];

  // BLAST operation names
  const blastOpNames = ['Blast_synteny', 'Blast_Candidate', 'Blast_QRNA', 'Blast_paralogues'];

  // ============================================================================
  // LEVEL 0: START NODE
  // ============================================================================
  const startNode = createNode('Start', 0, 2, 'Initialize SIPHT sRNA discovery workflow');
  nodes.push(startNode);

  // ============================================================================
  // LEVEL 1: Initial Search Tasks (Transterm, Findterm, RNA_Motif, Blast, Patser)
  // ============================================================================
  const initialSearchNodes: WorkflowNode[] = [];

  for (let i = 0; i < numInitialSearches; i++) {
    const taskName = initialSearchNames[i % initialSearchNames.length];
    const suffix =
      i >= initialSearchNames.length ? `-${Math.floor(i / initialSearchNames.length) + 1}` : '';
    const xPos = i * (4 / Math.max(numInitialSearches - 1, 1));

    const node = createNode(
      `${taskName}${suffix}`,
      1,
      xPos,
      `${taskName}: ${getInitialSearchDescription(taskName)}`
    );
    nodes.push(node);
    initialSearchNodes.push(node);

    // Connect start to all initial search nodes
    startNode.connections.push(createEdge(startNode, node));
  }

  // ============================================================================
  // LEVEL 2: SRNA - First aggregation point
  // ============================================================================
  const srnaNode = createNode(
    'SRNA',
    2,
    2,
    'Aggregate and coordinate all initial sRNA search results'
  );
  nodes.push(srnaNode);

  // All initial searches connect to SRNA (fan-in)
  for (const searchNode of initialSearchNodes) {
    searchNode.connections.push(createEdge(searchNode, srnaNode));
  }

  // ============================================================================
  // LEVEL 3: FFN_Parse - Parse feature file
  // ============================================================================
  const ffnParseNode = createNode(
    'FFN_Parse',
    3,
    2,
    'Parse feature file and prepare for detailed BLAST analysis'
  );
  nodes.push(ffnParseNode);
  srnaNode.connections.push(createEdge(srnaNode, ffnParseNode));

  // ============================================================================
  // LEVEL 4: BLAST Operations - Multiple parallel analyses
  // ============================================================================
  const blastNodes: WorkflowNode[] = [];

  for (let i = 0; i < numBlastOps; i++) {
    const blastName = blastOpNames[i % blastOpNames.length];
    const suffix = i >= blastOpNames.length ? `-${Math.floor(i / blastOpNames.length) + 1}` : '';
    const xPos = i * (4 / Math.max(numBlastOps - 1, 1));

    const node = createNode(
      `${blastName}${suffix}`,
      4,
      xPos,
      `${blastName}: ${getBlastDescription(blastName)}`
    );
    nodes.push(node);
    blastNodes.push(node);

    // FFN_Parse fans out to all BLAST operations
    ffnParseNode.connections.push(createEdge(ffnParseNode, node));
  }

  // ============================================================================
  // LEVEL 5: Patser - Massive parallel pattern searches
  // ============================================================================
  const patserNodes: WorkflowNode[] = [];

  for (let blastIdx = 0; blastIdx < blastNodes.length; blastIdx++) {
    const blastNode = blastNodes[blastIdx];

    for (let patserIdx = 0; patserIdx < patserPerBlast; patserIdx++) {
      const globalIdx = blastIdx * patserPerBlast + patserIdx;
      const totalPatser = numBlastOps * patserPerBlast;
      const xPos = globalIdx * (4 / Math.max(totalPatser - 1, 1));

      const node = createNode(
        `Patser-${globalIdx + 1}`,
        5,
        xPos,
        `Pattern search for candidate ${globalIdx + 1} (from ${blastNode.name})`
      );
      nodes.push(node);
      patserNodes.push(node);

      // Each BLAST fans out to multiple Patser operations
      blastNode.connections.push(createEdge(blastNode, node));
    }
  }

  // ============================================================================
  // LEVEL 6: Patser_Concate - Second aggregation point
  // ============================================================================
  const patserConcateNode = createNode(
    'Patser_Concate',
    6,
    2,
    'Concatenate and aggregate all pattern search results'
  );
  nodes.push(patserConcateNode);

  // All Patser nodes connect to Patser_Concate (fan-in)
  for (const patserNode of patserNodes) {
    patserNode.connections.push(createEdge(patserNode, patserConcateNode));
  }

  // ============================================================================
  // LEVEL 7: SRNA_annotate - Final annotation
  // ============================================================================
  const srnaAnnotateNode = createNode(
    'SRNA_annotate',
    7,
    2,
    'Generate final sRNA annotations and verification'
  );
  nodes.push(srnaAnnotateNode);
  patserConcateNode.connections.push(createEdge(patserConcateNode, srnaAnnotateNode));

  // ============================================================================
  // LEVEL 8: END NODE
  // ============================================================================
  const endNode = createNode('Complete', 8, 2, 'SIPHT sRNA discovery workflow complete');
  nodes.push(endNode);
  srnaAnnotateNode.connections.push(createEdge(srnaAnnotateNode, endNode));

  console.log('Generated deterministic SIPHT workflow:', {
    totalNodes: nodes.length,
    numInitialSearches,
    numBlastOps,
    patserPerBlast,
    levels: endNode.level + 1,
    structure: {
      initialSearches: numInitialSearches,
      SRNA: 1,
      FFN_Parse: 1,
      blastOps: numBlastOps,
      patser: numBlastOps * patserPerBlast,
      Patser_Concate: 1,
      SRNA_annotate: 1,
    },
    aggregationPoints: ['SRNA', 'Patser_Concate'],
  });

  return nodes;
}

/**
 * Get description for initial search tasks
 */
function getInitialSearchDescription(taskName: string): string {
  const descriptions: { [key: string]: string } = {
    Transterm: 'Identify transcription terminators',
    Findterm: 'Alternative terminator finding method',
    RNA_Motif: 'Search for RNA structure motifs',
    Blast: 'Initial BLAST homology search',
    Patser: 'Pattern search for regulatory elements',
  };
  return descriptions[taskName] || 'Search for sRNA candidates';
}

/**
 * Get description for BLAST operations
 */
function getBlastDescription(blastName: string): string {
  const descriptions: { [key: string]: string } = {
    Blast_synteny: 'Analyze genomic synteny',
    Blast_Candidate: 'Search candidate sequences',
    Blast_QRNA: 'QRNA comparative RNA analysis',
    Blast_paralogues: 'Identify paralogue sequences',
  };
  return descriptions[blastName] || 'BLAST analysis';
}

/**
 * Calculate optimal parameters from total node count
 */
function calculateSiphtParameters(nodeCount: number): {
  numInitialSearches: number;
  numBlastOps: number;
  patserPerBlast: number;
} {
  // SIPHT structure:
  // Start + initial + SRNA + FFN_Parse + blast + patser + Patser_Concate + SRNA_annotate + End
  // Total = 1 + I + 1 + 1 + B + B*P + 1 + 1 + 1 = I + B + B*P + 6 = I + B(1 + P) + 6

  // Minimum structure: 5 initial, 4 BLAST, 3 Patser per BLAST
  // Min = 5 + 4(1 + 3) + 6 = 5 + 16 + 6 = 27 nodes

  const minNodes = 27;

  if (nodeCount < minNodes) {
    // Use minimum configuration
    return { numInitialSearches: 5, numBlastOps: 4, patserPerBlast: 3 };
  }

  const workingNodes = nodeCount - 6; // Remove fixed nodes

  // Small workflows: Keep initial at 5, scale BLAST and Patser
  if (nodeCount <= 40) {
    const numInitialSearches = 5;
    const remaining = workingNodes - numInitialSearches;
    const numBlastOps = Math.max(4, Math.floor(Math.sqrt(remaining)));
    const patserPerBlast = Math.max(3, Math.floor((remaining - numBlastOps) / numBlastOps));
    return { numInitialSearches, numBlastOps, patserPerBlast };
  }

  // Medium workflows: Scale all parameters
  if (nodeCount <= 80) {
    const numInitialSearches = Math.max(5, Math.floor(workingNodes * 0.15));
    const remaining = workingNodes - numInitialSearches;
    const numBlastOps = Math.max(4, Math.floor(Math.sqrt(remaining * 0.8)));
    const patserPerBlast = Math.max(4, Math.floor((remaining - numBlastOps) / numBlastOps));
    return { numInitialSearches, numBlastOps, patserPerBlast };
  }

  // Large workflows: Emphasize Patser parallelism
  const numInitialSearches = Math.max(6, Math.floor(workingNodes * 0.1));
  const remaining = workingNodes - numInitialSearches;
  const numBlastOps = Math.max(5, Math.floor(Math.sqrt(remaining * 0.6)));
  const patserPerBlast = Math.max(5, Math.floor((remaining - numBlastOps) / numBlastOps));

  return { numInitialSearches, numBlastOps, patserPerBlast };
}

/**
 * Wrapper function that matches the existing workflow preset interface
 */
export const createSiphtWorkflow = (nodeCount: number): WorkflowNode[] => {
  const { numInitialSearches, numBlastOps, patserPerBlast } = calculateSiphtParameters(nodeCount);
  return createDeterministicSiphtWorkflow(numInitialSearches, numBlastOps, patserPerBlast);
};
