import type { ProcessorSlot, WorkflowNode } from '../../types';
import { getNodeDependencies } from '../../utils';

export function calculateEFT(
  task: WorkflowNode,
  workerId: string,
  allNodes: WorkflowNode[],
  processorSchedules: Map<string, ProcessorSlot[]>,
  completionTimes: Map<string, number>,
  includeTransferTimes: boolean
) {
  const taskDuration = task.executionTime || 0;

  const dependencies = getNodeDependencies(task.id, allNodes);
  let dataReadyTime = 0;

  for (const depId of dependencies) {
    const depCompletionTime = completionTimes.get(depId) || 0;

    let depWorkerId = '';
    for (const [pid, schedule] of processorSchedules.entries()) {
      if (schedule.some(slot => slot.taskId === depId)) {
        depWorkerId = pid;
        break;
      }
    }

    let transferTime = 0;
    if (includeTransferTimes && depWorkerId !== workerId) {
      const depNode = allNodes.find(n => n.id === depId);
      if (depNode) {
        const connection = depNode.connections.find(c => c.targetNodeId === task.id);
        transferTime = connection ? connection.transferTime : 0;
      }
    }

    dataReadyTime = Math.max(dataReadyTime, depCompletionTime + transferTime);
  }

  // Find earliest available slot on this processor
  const schedule = processorSchedules.get(workerId) || [];
  const startTime = findEarliestSlot(schedule, dataReadyTime, taskDuration);
  const eft = startTime + taskDuration;

  return { eft, startTime };
}

/**
 * Find the earliest time slot that can accommodate a task
 * This implements insertion-based scheduling to utilize gaps in the schedule
 */
function findEarliestSlot(schedule: ProcessorSlot[], earliestStartTime: number, duration: number) {
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
