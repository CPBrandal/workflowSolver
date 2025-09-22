import type { GammaParams, WorkflowNode } from '../types';
import { gammaSampler } from './gammaSampler';

export function generateTransferTimes(
  nodes: WorkflowNode[],
  gammaParams: GammaParams
): WorkflowNode[] {
  const sampler = gammaSampler(gammaParams);

  return nodes.map(node => ({
    ...node,
    transferTime: sampler(),
  }));
}
