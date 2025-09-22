import { randomGamma } from 'd3-random';
import type { GammaParams } from '../types';

export function gammaSampler(params: GammaParams): () => number {
  const gammaRng = randomGamma(params.shape, params.scale);

  return () => {
    let value = gammaRng();

    return Math.round(value * 100) / 100;
  };
}
