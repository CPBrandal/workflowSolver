import { randomGamma } from 'd3-random';
import type { GammaParams } from '../types';

export function createGammaParam(params: GammaParams): number {
  const gammaRng = randomGamma(params.shape, params.scale);
  return gammaRng();
}
