import type { WorkflowNode } from '../types';
import { createGammaSampler, type GammaParams } from './generateArbitraryWorkflow';

export function generateTransferTimes(
  nodes: WorkflowNode[],
  gammaParams: GammaParams
): WorkflowNode[] {
  const gammaSampler = createGammaSampler(gammaParams);

  return nodes.map(node => ({
    ...node,
    transferTime: gammaSampler(),
  }));
}
