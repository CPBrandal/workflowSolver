import type { ProcessorSlot, ScheduledTask, Worker, WorkflowNode } from '../../types';
import { calculateEFT } from './calculateEFT';
import { calculateUpwardRanks } from './calculateUpwardsRank';

export function cpHeft2Schedule(
  nodes: WorkflowNode[],
  workers: Worker[],
  includeTransferTimes: boolean = true
) {
  if (nodes.length === 0 || workers.length === 0) {
    return [];
  }

  const cpWorkerId = workers[0].id;

  const cpTasks = nodes.filter(n => n.criticalPath).sort((a, b) => a.level - b.level);
  const nonCpTasks = nodes.filter(n => !n.criticalPath);

  const processorSchedules: Map<string, ProcessorSlot[]> = new Map();
  workers.forEach(worker => {
    processorSchedules.set(worker.id, []);
  });

  const scheduledTasks: ScheduledTask[] = [];
  const completionTimes: Map<string, number> = new Map();

  for (const task of cpTasks) {
    const { eft, startTime } = calculateEFT(
      task,
      cpWorkerId,
      nodes,
      processorSchedules,
      completionTimes,
      includeTransferTimes
    );

    const scheduledTask: ScheduledTask = {
      nodeId: task.id,
      startTime: startTime,
      endTime: eft,
      workerId: cpWorkerId,
    };

    scheduledTasks.push(scheduledTask);
    completionTimes.set(task.id, eft);

    const schedule = processorSchedules.get(cpWorkerId)!;
    schedule.push({
      startTime: startTime,
      endTime: eft,
      taskId: task.id,
    });
    schedule.sort((a, b) => a.startTime - b.startTime);
  }

  // Phase 2: Schedule non-critical path tasks by rank using standard HEFT
  // Calculate ranks on ALL nodes to preserve correct rank values
  const ranks = calculateUpwardRanks(nodes, includeTransferTimes);
  const cpTaskIds = new Set(cpTasks.map(t => t.id));
  const rankSortedTasks = ranks
    .sort((a, b) => b.rank - a.rank)
    .map(r => nodes.find(n => n.id === r.nodeId)!);

  for (const task of rankSortedTasks) {
    if (cpTaskIds.has(task.id)) {
      continue;
    }
    let minEFT = Infinity;
    let bestWorkerId = workers[0].id;
    let bestStartTime = 0;

    for (const worker of workers) {
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

    const scheduledTask: ScheduledTask = {
      nodeId: task.id,
      startTime: bestStartTime,
      endTime: minEFT,
      workerId: bestWorkerId,
    };

    scheduledTasks.push(scheduledTask);
    completionTimes.set(task.id, minEFT);

    const schedule = processorSchedules.get(bestWorkerId)!;
    schedule.push({
      startTime: bestStartTime,
      endTime: minEFT,
      taskId: task.id,
    });
    schedule.sort((a, b) => a.startTime - b.startTime);
  }

  const makespan = Math.max(...scheduledTasks.map(t => t.endTime));
  console.log(`\n=== CP-HEFT2 Schedule Complete ===`);
  console.log(`Critical path tasks: ${cpTasks.length} (on ${cpWorkerId})`);
  console.log(`Non-CP tasks: ${nonCpTasks.length}`);
  console.log(`Total makespan: ${makespan.toFixed(2)}s`);
  console.log(`Transfer times: ${includeTransferTimes ? 'ENABLED' : 'DISABLED'}`);

  return scheduledTasks;
}
