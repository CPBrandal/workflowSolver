import type { ScheduledTask, Worker, WorkflowNode } from '../../types';
import { calculateEFT } from './calculateEFT';
import { calculateUpwardRanks } from './calculateUpwardsRank';

interface ProcessorSlot {
  startTime: number;
  endTime: number;
  taskId: string;
}

/**
 * HEFT (Heterogeneous Earliest Finish Time) Scheduler
 *
 * This implements the HEFT algorithm for scheduling tasks on heterogeneous processors.
 * The algorithm:
 * 1. Calculates upward rank for each task (average execution time + max successor rank)
 * 2. Sorts tasks by rank in descending order
 * 3. For each task, assigns it to the processor that gives the earliest finish time
 */
export function heftSchedule(
  nodes: WorkflowNode[],
  workers: Worker[],
  includeTransferTimes: boolean = true
) {
  if (nodes.length === 0 || workers.length === 0) {
    return [];
  }

  // first phase
  const ranks = calculateUpwardRanks(nodes, includeTransferTimes);

  const rankSortedTasks = ranks
    .sort((a, b) => b.rank - a.rank)
    .map(r => nodes.find(n => n.id === r.nodeId)!);

  console.log('=== HEFT Task Ranking ===');
  rankSortedTasks.forEach((task, idx) => {
    const rank = ranks.find(r => r.nodeId === task.id)!.rank;
    console.log(`${idx + 1}. ${task.name} (${task.id}): rank=${rank.toFixed(2)}`);
  });

  // Initialize processor schedules
  const processorSchedules: Map<string, ProcessorSlot[]> = new Map();
  workers.forEach(worker => {
    processorSchedules.set(worker.id, []);
  });

  const scheduledTasks: ScheduledTask[] = [];
  const completionTimes: Map<string, number> = new Map();

  // Schedule each task
  for (const task of rankSortedTasks) {
    let minEFT = Infinity;
    let bestWorkerId = workers[0].id;
    let bestStartTime = 0;

    // Try scheduling on each processor
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

    // Schedule the task on the best processor
    const scheduledTask: ScheduledTask = {
      nodeId: task.id,
      startTime: bestStartTime,
      endTime: minEFT,
      workerId: bestWorkerId,
    };

    scheduledTasks.push(scheduledTask);
    completionTimes.set(task.id, minEFT);

    // Add to processor schedule
    const schedule = processorSchedules.get(bestWorkerId)!;
    schedule.push({
      startTime: bestStartTime,
      endTime: minEFT,
      taskId: task.id,
    });
    schedule.sort((a, b) => a.startTime - b.startTime);

    console.log(
      `Scheduled ${task.name} on ${bestWorkerId}: [${bestStartTime.toFixed(2)}s - ${minEFT.toFixed(2)}s]`
    );
  }

  const makespan = Math.max(...scheduledTasks.map(t => t.endTime));
  console.log(`\n=== HEFT Schedule Complete ===`);
  console.log(`Total makespan: ${makespan.toFixed(2)}s`);
  console.log(`Transfer times: ${includeTransferTimes ? 'ENABLED' : 'DISABLED'}`);

  return scheduledTasks;
}
