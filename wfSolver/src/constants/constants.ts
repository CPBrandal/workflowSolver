import type { GammaParams } from '../types';

export const EXECUTION_PARAM_DISTRIBUTIONS = {
  SHAPE: {
    shape: 9,
    scale: 0.67,
  } as GammaParams,
  SCALE: {
    shape: 4,
    scale: 0.5,
  } as GammaParams,
};

export const TRANSFER_PARAM_DISTRIBUTIONS = {
  SHAPE: {
    shape: 4,
    scale: 0.75,
  } as GammaParams,
  SCALE: {
    shape: 2,
    scale: 0.75,
  } as GammaParams,
};

export const ALGORITHMS = ['Greedy', 'CP_Greedy', 'HEFT', 'CP_HEFT', 'CP_HEFT2'] as const;
export type SchedulingAlgorithm = (typeof ALGORITHMS)[number];

export const TOPOLOGY_TYPES = ['arbitrary', 'scientific'] as const;
export type TopologyType = (typeof TOPOLOGY_TYPES)[number];

export const VALID_WORKERS = [4, 5, 6, 7, 8];
