import type { ProcessorSlot, WorkflowNode } from '../../types';
import { getNodeDependencies } from '../../utils/getNodeDependencies';
import { findEarliestSlot } from './findEarliestSlot';

/**
 * Calculate Earliest Finish Time (EFT) for a task on a specific processor
 */
export function calculateEFT(
  task: WorkflowNode,
  workerId: string,
  allNodes: WorkflowNode[],
  processorSchedules: Map<string, ProcessorSlot[]>,
  completionTimes: Map<string, number>,
  includeTransferTimes: boolean
) {
  const taskDuration = task.executionTime || 0;

  // Calculate earliest start time based on dependencies
  const dependencies = getNodeDependencies(task.id, allNodes);
  let dataReadyTime = 0;

  for (const depId of dependencies) {
    const depCompletionTime = completionTimes.get(depId) || 0;

    // Find which processor the dependency is on
    let depWorkerId = '';
    for (const [pid, schedule] of processorSchedules.entries()) {
      if (schedule.some(slot => slot.taskId === depId)) {
        depWorkerId = pid;
        break;
      }
    }

    // Add transfer time if dependency is on a different processor
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
