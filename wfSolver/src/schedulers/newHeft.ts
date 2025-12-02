import type { ScheduledTask, Worker, WorkflowNode } from '../utils/../types';
import { getNodeDependencies } from '../utils/getNodeDependencies';

interface ProcessorSlot {
  startTime: number;
  endTime: number;
  taskId: string;
}

interface TaskRank {
  nodeId: string;
  rank: number;
}

// TODO CHECK AND FIX THIS CLAUDE CODE

/**
 * HEFT (Heterogeneous Earliest Finish Time) Scheduler
 *
 * Standard HEFT algorithm implementation:
 * 1. Calculate upward rank for each task (average execution time + max successor rank + avg communication cost)
 * 2. Sort tasks by rank in descending order
 * 3. For each task (in rank order), assign it to the processor that gives the earliest finish time
 * 4. Use insertion-based scheduling to fill gaps in processor schedules
 *
 * @param nodes - Array of workflow nodes with execution times and connections
 * @param workers - Array of available workers/processors
 * @param includeTransferTimes - Whether to include transfer times between tasks on different workers
 * @returns Array of scheduled tasks with assigned workers and time windows
 */
export function heftSchedule(
  nodes: WorkflowNode[],
  workers: Worker[],
  includeTransferTimes: boolean = true
): ScheduledTask[] {
  if (nodes.length === 0 || workers.length === 0) {
    return [];
  }

  console.log('\n=== HEFT Algorithm Starting ===');
  console.log(`Tasks: ${nodes.length}, Workers: ${workers.length}`);
  console.log(`Transfer times: ${includeTransferTimes ? 'ENABLED' : 'DISABLED'}`);

  // Step 1: Calculate upward ranks for all nodes
  const ranks = calculateUpwardRanks(nodes, includeTransferTimes);

  // Step 2: Sort nodes by rank (descending order - highest priority first)
  const sortedTasks = ranks
    .sort((a, b) => b.rank - a.rank)
    .map(r => nodes.find(n => n.id === r.nodeId)!);

  console.log('\n=== Task Priority Ranking ===');
  sortedTasks.forEach((task, idx) => {
    const rank = ranks.find(r => r.nodeId === task.id)!.rank;
    const cpIndicator = task.criticalPath ? ' [CP]' : '';
    console.log(
      `${idx + 1}. ${task.name} (${task.id.slice(0, 8)}): rank=${rank.toFixed(2)}${cpIndicator}`
    );
  });

  // Initialize processor schedules
  const processorSchedules: Map<string, ProcessorSlot[]> = new Map();
  workers.forEach(worker => {
    processorSchedules.set(worker.id, []);
  });

  const scheduledTasks: ScheduledTask[] = [];
  const completionTimes: Map<string, number> = new Map();

  console.log('\n=== Scheduling Tasks ===');

  // Step 3: Schedule each task in priority order
  for (const task of sortedTasks) {
    let minEFT = Infinity;
    let bestWorkerId = workers[0].id;
    let bestStartTime = 0;

    // Try scheduling on each processor and find the one with earliest finish time
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

    // Add to processor schedule and keep sorted by start time
    const schedule = processorSchedules.get(bestWorkerId)!;
    schedule.push({
      startTime: bestStartTime,
      endTime: minEFT,
      taskId: task.id,
    });
    schedule.sort((a, b) => a.startTime - b.startTime);

    const cpIndicator = task.criticalPath ? ' [CP]' : '';
    console.log(
      `→ ${task.name}${cpIndicator} on ${bestWorkerId}: [${bestStartTime.toFixed(2)}s - ${minEFT.toFixed(2)}s]`
    );
  }

  const makespan = Math.max(...scheduledTasks.map(t => t.endTime));
  console.log(`\n=== HEFT Complete ===`);
  console.log(`Makespan: ${makespan.toFixed(2)}s`);
  console.log(`Tasks scheduled: ${scheduledTasks.length}/${nodes.length}`);

  return scheduledTasks;
}

/**
 * Calculate upward rank for all nodes using recursive approach
 *
 * Upward rank = average execution time + max(upward rank of successors + avg communication cost)
 * This represents the length of the critical path from this node to the exit node
 */
function calculateUpwardRanks(nodes: WorkflowNode[], includeTransferTimes: boolean): TaskRank[] {
  const ranks = new Map<string, number>();
  const visited = new Set<string>();

  // Helper function to get all successor nodes
  function getSuccessors(nodeId: string): string[] {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return [];
    return node.connections.map(conn => conn.targetNodeId);
  }

  // Helper function to get average transfer time for an edge
  function getAvgTransferTime(sourceId: string, targetId: string): number {
    if (!includeTransferTimes) return 0;

    const sourceNode = nodes.find(n => n.id === sourceId);
    if (!sourceNode) return 0;

    const connection = sourceNode.connections.find(c => c.targetNodeId === targetId);
    if (!connection) return 0;

    // Average transfer time across all workers (assuming heterogeneous environment)
    // In homogeneous case, this is just the transfer time
    return connection.transferTime || 0;
  }

  // Recursive function to calculate rank for a node
  function calculateRank(nodeId: string): number {
    // If already calculated, return cached value
    if (ranks.has(nodeId)) {
      return ranks.get(nodeId)!;
    }

    // Prevent infinite recursion
    if (visited.has(nodeId)) {
      return 0;
    }
    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      return 0;
    }

    const successors = getSuccessors(nodeId);

    // If node has no successors (exit node), rank is just its execution time
    if (successors.length === 0) {
      const rank = node.executionTime || 0;
      ranks.set(nodeId, rank);
      return rank;
    }

    // Calculate max successor cost
    let maxSuccessorCost = 0;
    for (const successorId of successors) {
      const successorRank = calculateRank(successorId);
      const avgCommCost = getAvgTransferTime(nodeId, successorId);
      const successorCost = successorRank + avgCommCost;

      if (successorCost > maxSuccessorCost) {
        maxSuccessorCost = successorCost;
      }
    }

    // Rank = average execution time + max successor cost
    const avgExecutionTime = node.executionTime || 0;
    const rank = avgExecutionTime + maxSuccessorCost;
    ranks.set(nodeId, rank);

    return rank;
  }

  // Calculate ranks for all nodes
  nodes.forEach(node => {
    if (!ranks.has(node.id)) {
      calculateRank(node.id);
    }
  });

  // Convert to array format
  return Array.from(ranks.entries()).map(([nodeId, rank]) => ({
    nodeId,
    rank,
  }));
}

/**
 * Calculate Earliest Finish Time (EFT) for a task on a specific processor
 *
 * This implements insertion-based scheduling:
 * 1. Calculate earliest time when all input data is ready (considering predecessors)
 * 2. Find the earliest available slot on the processor that fits the task
 * 3. Try to insert into gaps between existing tasks if possible
 */
function calculateEFT(
  task: WorkflowNode,
  workerId: string,
  nodes: WorkflowNode[],
  processorSchedules: Map<string, ProcessorSlot[]>,
  completionTimes: Map<string, number>,
  includeTransferTimes: boolean
): { eft: number; startTime: number } {
  // Step 1: Calculate data ready time (when all predecessor data is available)
  let dataReadyTime = 0;

  const dependencies = getNodeDependencies(task.id, nodes);

  for (const depId of dependencies) {
    const depCompletionTime = completionTimes.get(depId) || 0;
    const depNode = nodes.find(n => n.id === depId);

    if (!depNode) continue;

    // Find which worker the dependency is scheduled on
    const depSchedule = Array.from(processorSchedules.entries()).find(([_, slots]) =>
      slots.some(slot => slot.taskId === depId)
    );

    const depWorkerId = depSchedule ? depSchedule[0] : workerId;

    let transferTime = 0;

    // Add communication cost if dependency is on a different worker
    if (includeTransferTimes && depWorkerId !== workerId) {
      const connection = depNode.connections.find(c => c.targetNodeId === task.id);
      if (connection) {
        transferTime = connection.transferTime || 0;
      }
    }

    const readyTime = depCompletionTime + transferTime;
    dataReadyTime = Math.max(dataReadyTime, readyTime);
  }

  // Step 2: Find earliest available slot on this processor using insertion-based scheduling
  const taskDuration = task.executionTime || 0;
  const schedule = processorSchedules.get(workerId) || [];

  const startTime = findEarliestSlot(schedule, dataReadyTime, taskDuration);
  const eft = startTime + taskDuration;

  return { eft, startTime };
}

/**
 * Find the earliest time slot that can accommodate a task
 *
 * This implements insertion-based scheduling to utilize gaps in the schedule:
 * 1. Try to insert before the first task if there's room
 * 2. Try to insert in gaps between existing tasks
 * 3. If no gap fits, schedule after the last task
 */
function findEarliestSlot(
  schedule: ProcessorSlot[],
  earliestStartTime: number,
  duration: number
): number {
  // If processor is empty, start at the earliest possible time
  if (schedule.length === 0) {
    return earliestStartTime;
  }

  // Sort schedule by start time (should already be sorted, but ensure it)
  const sortedSchedule = [...schedule].sort((a, b) => a.startTime - b.startTime);

  // Try to insert before the first task
  const firstTask = sortedSchedule[0];
  if (earliestStartTime + duration <= firstTask.startTime) {
    return earliestStartTime;
  }

  // Try to find a gap between existing tasks
  for (let i = 0; i < sortedSchedule.length - 1; i++) {
    const currentTask = sortedSchedule[i];
    const nextTask = sortedSchedule[i + 1];

    // Calculate the available gap
    const gapStart = Math.max(currentTask.endTime, earliestStartTime);
    const gapEnd = nextTask.startTime;
    const gapDuration = gapEnd - gapStart;

    // If the task fits in this gap, schedule it here
    if (gapDuration >= duration) {
      return gapStart;
    }
  }

  // No gap found, schedule after the last task
  const lastTask = sortedSchedule[sortedSchedule.length - 1];
  return Math.max(lastTask.endTime, earliestStartTime);
}
