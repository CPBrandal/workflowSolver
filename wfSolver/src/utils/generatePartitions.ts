/**
 * Generates all set partitions of an array of elements.
 * A partition divides the set into non-empty, non-overlapping subsets.
 *
 * Example: partitions of [A, B, C] are:
 * - [[A], [B], [C]]
 * - [[A, B], [C]]
 * - [[A, C], [B]]
 * - [[B, C], [A]]
 * - [[A, B, C]]
 *
 * Note: The number of partitions follows Bell numbers (1, 1, 2, 5, 15, 52, 203, 877...)
 */
export function generatePartitions<T>(elements: T[]) {
  if (elements.length === 0) return [[]];
  if (elements.length === 1) return [[[elements[0]]]];

  const [first, ...rest] = elements;
  const partitionsOfRest = generatePartitions(rest);
  const result: T[][][] = [];

  for (const partition of partitionsOfRest) {
    result.push([[first], ...partition]);

    for (let i = 0; i < partition.length; i++) {
      const newPartition = partition.map((subset, j) =>
        j === i ? [first, ...subset] : [...subset]
      );
      result.push(newPartition);
    }
  }
  return result;
}
