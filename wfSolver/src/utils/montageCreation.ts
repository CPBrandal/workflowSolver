// utils/montageWorkflowGenerator.ts - Deterministic Montage Workflow Generator

import type { WorkflowNode, Edge } from '../types';
import { createGammaParam } from './createGammaParam';
import { gammaSampler } from './gammaSampler';
import {
  EXECUTION_PARAM_DISTRIBUTIONS,
  TRANSFER_PARAM_DISTRIBUTIONS,
} from '../constants/constants';

/**
 * Montage Workflow Structure:
 *
 * The Montage workflow is used in astronomy to create image mosaics from multiple input images.
 * It has a diamond-shaped structure with specific task types at each stage.
 *
 * Stages:
 * 1. mProjectPP: Re-project individual images to a common coordinate system
 * 2. mDiffFit: Calculate differences between overlapping images
 * 3. mConcatFit: Combine all difference measurements (coordination point)
 * 4. mBgModel: Model background radiation levels
 * 5. mBackground: Apply background corrections to images
 * 6. mImgTbl: Create image table metadata
 * 7. mAdd: Add/combine corrected images
 * 8. mShrink: Reduce image size
 * 9. mJPEG: Convert final mosaic to JPEG format
 */

export interface MontageConfig {
  numImages: number; // Number of input images (affects parallelism)
}

/**
 * Create a deterministic Montage workflow matching the actual structure
 */
export function createDeterministicMontageWorkflow(numImages: number = 4): WorkflowNode[] {
  if (numImages < 2) {
    throw new Error('Montage workflow requires at least 2 images');
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
  const startNode = createNode('Start', 0, 2, 'Initialize Montage workflow');
  nodes.push(startNode);

  // ============================================================================
  // LEVEL 1: mProjectPP - Re-project images to common coordinate system
  // ============================================================================
  const mProjectPPNodes: WorkflowNode[] = [];
  for (let i = 0; i < numImages; i++) {
    const xPos = i * (4 / (numImages - 1 || 1));
    const node = createNode(
      `mProjectPP-${i + 1}`,
      1,
      xPos,
      `Re-project image ${i + 1} to common coordinate system`
    );
    nodes.push(node);
    mProjectPPNodes.push(node);

    // Connect start to all mProjectPP nodes
    startNode.connections.push(createEdge(startNode, node));
  }

  // ============================================================================
  // LEVEL 2: mDiffFit - Calculate differences between overlapping images
  // ============================================================================
  // Number of mDiffFit tasks depends on overlapping image pairs
  // Typically ~1.5x the number of images for moderate overlap
  const numDiffFit = Math.max(Math.ceil(numImages * 1.5), numImages);
  const mDiffFitNodes: WorkflowNode[] = [];

  for (let i = 0; i < numDiffFit; i++) {
    const xPos = i * (4 / (numDiffFit - 1 || 1));
    const node = createNode(
      `mDiffFit-${i + 1}`,
      2,
      xPos,
      `Calculate differences for image pair ${i + 1}`
    );
    nodes.push(node);
    mDiffFitNodes.push(node);
  }

  // Connect mProjectPP to mDiffFit nodes
  // Each mProjectPP node connects to subset of mDiffFit nodes (overlapping pairs)
  for (let i = 0; i < mProjectPPNodes.length; i++) {
    const sourceNode = mProjectPPNodes[i];

    // Connect to nearby mDiffFit nodes (simulating overlap relationships)
    const startIdx = Math.floor(i * (numDiffFit / numImages));
    const endIdx = Math.min(startIdx + Math.ceil(numDiffFit / numImages) + 1, numDiffFit);

    for (let j = startIdx; j < endIdx; j++) {
      sourceNode.connections.push(createEdge(sourceNode, mDiffFitNodes[j]));
    }
  }

  // ============================================================================
  // LEVEL 3: mConcatFit - Combine all difference measurements (COORDINATION)
  // ============================================================================
  const mConcatFitNode = createNode(
    'mConcatFit',
    3,
    2,
    'Concatenate and fit all difference measurements'
  );
  nodes.push(mConcatFitNode);

  // All mDiffFit nodes connect to mConcatFit (aggregation point)
  for (const diffFitNode of mDiffFitNodes) {
    diffFitNode.connections.push(createEdge(diffFitNode, mConcatFitNode));
  }

  // ============================================================================
  // LEVEL 4: mBgModel - Model background radiation
  // ============================================================================
  const mBgModelNode = createNode(
    'mBgModel',
    4,
    2,
    'Model background radiation levels from fit data'
  );
  nodes.push(mBgModelNode);
  mConcatFitNode.connections.push(createEdge(mConcatFitNode, mBgModelNode));

  // ============================================================================
  // LEVEL 5: mBackground - Apply background corrections
  // ============================================================================
  const mBackgroundNodes: WorkflowNode[] = [];
  for (let i = 0; i < numImages; i++) {
    const xPos = i * (4 / (numImages - 1 || 1));
    const node = createNode(
      `mBackground-${i + 1}`,
      5,
      xPos,
      `Apply background correction to image ${i + 1}`
    );
    nodes.push(node);
    mBackgroundNodes.push(node);

    // mBgModel broadcasts to all mBackground nodes
    mBgModelNode.connections.push(createEdge(mBgModelNode, node));
  }

  // Also connect mProjectPP directly to corresponding mBackground
  // (to pass original image data)
  for (let i = 0; i < Math.min(mProjectPPNodes.length, mBackgroundNodes.length); i++) {
    mProjectPPNodes[i].connections.push(createEdge(mProjectPPNodes[i], mBackgroundNodes[i]));
  }

  // ============================================================================
  // LEVEL 6: mImgTbl - Create image metadata tables
  // ============================================================================
  // Create 2 mImgTbl nodes (metadata generation can be split)
  const numImgTbl = Math.min(2, Math.ceil(numImages / 2));
  const mImgTblNodes: WorkflowNode[] = [];

  for (let i = 0; i < numImgTbl; i++) {
    const xPos = i * 2 + 1;
    const node = createNode(`mImgTbl-${i + 1}`, 6, xPos, `Create image metadata table ${i + 1}`);
    nodes.push(node);
    mImgTblNodes.push(node);
  }

  // Connect mBackground nodes to mImgTbl nodes (distribute load)
  for (let i = 0; i < mBackgroundNodes.length; i++) {
    const targetIdx = i % mImgTblNodes.length;
    mBackgroundNodes[i].connections.push(createEdge(mBackgroundNodes[i], mImgTblNodes[targetIdx]));
  }

  // ============================================================================
  // LEVEL 7: mAdd - Add/combine corrected images
  // ============================================================================
  // Create 2 mAdd nodes (combining can be done in parallel then merged)
  const numAdd = Math.min(2, Math.ceil(numImages / 2));
  const mAddNodes: WorkflowNode[] = [];

  for (let i = 0; i < numAdd; i++) {
    const xPos = i * 2 + 1;
    const node = createNode(`mAdd-${i + 1}`, 7, xPos, `Add/combine corrected images ${i + 1}`);
    nodes.push(node);
    mAddNodes.push(node);
  }

  // Connect mImgTbl to mAdd
  for (const imgTblNode of mImgTblNodes) {
    for (const addNode of mAddNodes) {
      imgTblNode.connections.push(createEdge(imgTblNode, addNode));
    }
  }

  // ============================================================================
  // LEVEL 8: mShrink - Reduce image size
  // ============================================================================
  const numShrink = numAdd;
  const mShrinkNodes: WorkflowNode[] = [];

  for (let i = 0; i < numShrink; i++) {
    const xPos = i * 2 + 1;
    const node = createNode(`mShrink-${i + 1}`, 8, xPos, `Shrink combined image ${i + 1}`);
    nodes.push(node);
    mShrinkNodes.push(node);

    // Connect corresponding mAdd to mShrink
    if (i < mAddNodes.length) {
      mAddNodes[i].connections.push(createEdge(mAddNodes[i], node));
    }
  }

  // ============================================================================
  // LEVEL 9: Final merge (if multiple shrink nodes)
  // ============================================================================
  let finalImageNodes = mShrinkNodes;

  if (mShrinkNodes.length > 1) {
    // Create a merge node to combine multiple shrunk images
    const mergeNode = createNode('mMerge', 9, 2, 'Merge final image sections');
    nodes.push(mergeNode);

    // Connect all shrink nodes to merge
    for (const shrinkNode of mShrinkNodes) {
      shrinkNode.connections.push(createEdge(shrinkNode, mergeNode));
    }

    finalImageNodes = [mergeNode];
  }

  // ============================================================================
  // LEVEL 10: mJPEG - Convert to JPEG
  // ============================================================================
  const levelBeforeEnd = finalImageNodes[0].level + 1;
  const mJPEGNode = createNode('mJPEG', levelBeforeEnd, 2, 'Convert final mosaic to JPEG format');
  nodes.push(mJPEGNode);

  // Connect final image node(s) to JPEG
  for (const imageNode of finalImageNodes) {
    imageNode.connections.push(createEdge(imageNode, mJPEGNode));
  }

  // ============================================================================
  // FINAL LEVEL: END NODE
  // ============================================================================
  const endNode = createNode('Complete', levelBeforeEnd + 1, 2, 'Montage workflow complete');
  nodes.push(endNode);
  mJPEGNode.connections.push(createEdge(mJPEGNode, endNode));

  console.log('Generated deterministic Montage workflow:', {
    totalNodes: nodes.length,
    numImages,
    levels: endNode.level + 1,
    structure: {
      mProjectPP: numImages,
      mDiffFit: numDiffFit,
      mConcatFit: 1,
      mBgModel: 1,
      mBackground: numImages,
      mImgTbl: numImgTbl,
      mAdd: numAdd,
      mShrink: numShrink,
      mJPEG: 1,
    },
  });

  return nodes;
}

/**
 * Wrapper function that matches the existing workflow preset interface
 */
export const createMontageWorkflow = (nodeCount: number): WorkflowNode[] => {
  // Map nodeCount to number of input images
  // Montage structure scales with number of images
  const numImages = Math.max(2, Math.ceil(nodeCount / 6));

  return createDeterministicMontageWorkflow(numImages);
};
