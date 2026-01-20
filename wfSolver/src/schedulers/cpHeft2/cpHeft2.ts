import type { ProcessorSlot, ScheduledTask, Worker, WorkflowNode } from '../../types';
import { getNodeDependencies } from '../../utils/getNodeDependencies';
import { calculateEFT } from './calculateEFT';
import { calculateUpwardRanks } from './calculateUpwardsRank';

/**
 * CP-HEFT Scheduler with Critical Path Priority
 *
 * 1. Schedules tasks using ready-queue approach (respects all dependencies)
 * 2. Critical path tasks are assigned to the CP worker
 * 3. Non-CP tasks can use any worker (including CP worker gaps)
 * 4. Transfer time = 0 when tasks are on the same worker
 */
export function cpHeftSchedule(
  nodes: WorkflowNode[],
  workers: Worker[],
  includeTransferTimes: boolean = true
): ScheduledTask[] {
  if (nodes.length === 0 || workers.length === 0) {
    return [];
  }

  const criticalPathWorker = workers.find(w => w.criticalPathWorker === true);
  const cpTaskIds = new Set(nodes.filter(n => n.criticalPath).map(t => t.id));

  const processorSchedules = new Map<string, ProcessorSlot[]>();
  workers.forEach(w => processorSchedules.set(w.id, []));

  const scheduledTasks: ScheduledTask[] = [];
  const completionTimes = new Map<string, number>();
  const scheduledNodeIds = new Set<string>();

  const ranks = calculateUpwardRanks(nodes, includeTransferTimes);
  const rankMap = new Map(ranks.map(r => [r.nodeId, r.rank]));
  const sortedNodes = [...nodes].sort(
    (a, b) => (rankMap.get(b.id) ?? 0) - (rankMap.get(a.id) ?? 0)
  );

  while (scheduledNodeIds.size < nodes.length) {
    let progress = false;

    for (const task of sortedNodes) {
      if (scheduledNodeIds.has(task.id)) continue;

      const deps = getNodeDependencies(task.id, nodes);
      if (!deps.every(d => scheduledNodeIds.has(d))) continue;

      const candidateWorkers = cpTaskIds.has(task.id)
        ? [criticalPathWorker ?? workers[0]]
        : workers;

      let minEFT = Infinity;
      let bestWorkerId = candidateWorkers[0].id;
      let bestStartTime = 0;

      for (const worker of candidateWorkers) {
        const { eft, startTime } = calculateEFT(
          task,
          worker.id,
          nodes,
          processorSchedules,
          completionTimes,
          includeTransferTimes
        );
        if (eft < minEFT) {
          minEFT = eft;
          bestWorkerId = worker.id;
          bestStartTime = startTime;
        }
      }

      scheduledTasks.push({
        nodeId: task.id,
        startTime: bestStartTime,
        endTime: minEFT,
        workerId: bestWorkerId,
      });
      completionTimes.set(task.id, minEFT);
      scheduledNodeIds.add(task.id);
      progress = true;

      const schedule = processorSchedules.get(bestWorkerId)!;
      schedule.push({ startTime: bestStartTime, endTime: minEFT, taskId: task.id });
      schedule.sort((a, b) => a.startTime - b.startTime);
    }

    if (!progress && scheduledNodeIds.size < nodes.length) {
      console.error('Could not schedule all tasks - dependency cycle or missing nodes');
      break;
    }
  }

  return scheduledTasks;
}
