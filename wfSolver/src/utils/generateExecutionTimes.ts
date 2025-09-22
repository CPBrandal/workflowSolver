import type { GammaParams, WorkflowNode } from '../types';
import { gammaSampler } from './gammaSampler';

export function generateExecutionTimes(
  nodes: WorkflowNode[],
  gammaParams: GammaParams
): WorkflowNode[] {
  const sampler = gammaSampler(gammaParams);
  return nodes.map(node => ({
    ...node,
    duration: sampler(),
  }));
}
