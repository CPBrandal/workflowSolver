import type { ProcessorSlot } from '../../types';

/**
 * Find the earliest time slot that can accommodate a task
 * This implements insertion-based scheduling to utilize gaps in the schedule
 */
export function findEarliestSlot(
  schedule: ProcessorSlot[],
  earliestStartTime: number,
  duration: number
): number {
  if (schedule.length === 0) {
    return earliestStartTime;
  }

  for (let i = 0; i < schedule.length; i++) {
    const slot = schedule[i];

    if (i === 0) {
      const candidateStart = earliestStartTime;
      const candidateEnd = candidateStart + duration;
      if (candidateEnd <= slot.startTime) {
        return candidateStart;
      }
    }

    if (i < schedule.length - 1) {
      const nextSlot = schedule[i + 1];
      const gapStart = Math.max(slot.endTime, earliestStartTime);
      const gapEnd = nextSlot.startTime;

      if (gapEnd - gapStart >= duration) {
        return gapStart;
      }
    }
  }

  const lastSlot = schedule[schedule.length - 1];
  return Math.max(lastSlot.endTime, earliestStartTime);
}
