import type { ScheduledTask, Worker, WorkflowNode } from '../utils/../types';
import { getNodeDependencies } from '../utils/getNodeDependencies';

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

/**
 * Calculate upward rank for all nodes using recursive approach
 */
function calculateUpwardRanks(nodes: WorkflowNode[], includeTransferTimes: boolean) {
  const ranks = new Map<string, number>();
  const visited = new Set<string>();

  // TODO: if nodes are sorted, we can just call calculateRank(nodes[0])
  nodes.forEach(node => calculateRank(node));

  function calculateRank(node: WorkflowNode) {
    if (ranks.has(node.id)) {
      return ranks.get(node.id)!;
    }

    if (visited.has(node.id)) {
      return 0;
    }

    visited.add(node.id);

    const executionTime = node.executionTime || 0;
    const successors = getSuccessors(node);

    if (successors.length === 0) {
      ranks.set(node.id, executionTime);
      return executionTime;
    }

    // Calculate max(communication + successor rank) for all successors
    let maxSuccessorRank = 0;
    for (const successorId of successors) {
      const transferTime = getTransferTime(node.id, successorId);
      const successorNode = nodes.find(n => n.id === successorId)!;
      const successorRank = calculateRank(successorNode);
      maxSuccessorRank = Math.max(maxSuccessorRank, transferTime + successorRank);
    }

    const rank = executionTime + maxSuccessorRank;
    ranks.set(node.id, rank);
    return rank;
  }

  function getSuccessors(node: WorkflowNode) {
    return node.connections.map(conn => conn.targetNodeId);
  }

  function getTransferTime(sourceId: string, targetId: string) {
    if (!includeTransferTimes) return 0;
    const sourceNode = nodes.find(n => n.id === sourceId);
    if (!sourceNode) return 0;
    const connection = sourceNode.connections.find(c => c.targetNodeId === targetId);
    return connection ? connection.transferTime : 0;
  }

  return Array.from(ranks.entries()).map(([nodeId, rank]) => ({ nodeId, rank }));
}

/**
 * Calculate Earliest Finish Time (EFT) for a task on a specific processor
 */
function calculateEFT(
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

/**
 * Find the earliest time slot that can accommodate a task
 * This implements insertion-based scheduling to utilize gaps in the schedule
 */
function findEarliestSlot(
  schedule: ProcessorSlot[],
  earliestStartTime: number,
  duration: number
): number {
  if (schedule.length === 0) {
    return earliestStartTime;
  }

  // Try to insert in gaps between existing tasks
  for (let i = 0; i < schedule.length; i++) {
    const slot = schedule[i];

    // Check if we can fit before the first task
    if (i === 0) {
      const candidateStart = earliestStartTime;
      const candidateEnd = candidateStart + duration;
      if (candidateEnd <= slot.startTime) {
        return candidateStart;
      }
    }

    // Check gap between current and next task
    if (i < schedule.length - 1) {
      const nextSlot = schedule[i + 1];
      const gapStart = Math.max(slot.endTime, earliestStartTime);
      const gapEnd = nextSlot.startTime;

      if (gapEnd - gapStart >= duration) {
        return gapStart;
      }
    }
  }

  // If no gap found, schedule after the last task
  const lastSlot = schedule[schedule.length - 1];
  return Math.max(lastSlot.endTime, earliestStartTime);
}
