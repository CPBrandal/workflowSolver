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
