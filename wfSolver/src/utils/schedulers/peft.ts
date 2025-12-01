import type { ScheduledTask, Worker, WorkflowNode } from '../../types';
import { getNodeDependencies } from '../getNodeDependencies';

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

interface OptimisticCostTable {
  [nodeId: string]: number[]; // OCT value for each processor
}

/**
 * PEFT (Predictive Earliest Finish Time) Scheduler
 *
 * This implements the PEFT algorithm from Arabnejad & Barbosa (2014).
 * PEFT improves upon HEFT by using an Optimistic Cost Table (OCT) that
 * represents the best-case remaining execution time from each task.
 *
 * Algorithm steps:
 * 1. Calculate OCT for each (task, processor) pair bottom-up
 * 2. Calculate upward rank = average OCT across processors
 * 3. Sort tasks by rank (descending)
 * 4. For each task, select processor that minimizes: EFT + OCT
 *
 * This tends to produce better schedules than HEFT on heterogeneous systems.
 *
 * @param nodes - Array of workflow nodes
 * @param workers - Array of available workers/processors
 * @param includeTransferTimes - Whether to include communication costs
 * @returns Array of scheduled tasks
 */
export function peftSchedule(
  nodes: WorkflowNode[],
  workers: Worker[],
  includeTransferTimes: boolean = true
): ScheduledTask[] {
  if (nodes.length === 0 || workers.length === 0) {
    return [];
  }

  console.log('\n=== PEFT Algorithm Starting ===');
  console.log(`Tasks: ${nodes.length}, Workers: ${workers.length}`);
  console.log(`Transfer times: ${includeTransferTimes ? 'ENABLED' : 'DISABLED'}`);

  const numProcessors = workers.length;

  // Step 1: Build Optimistic Cost Table (OCT)
  console.log('\n=== Computing Optimistic Cost Table ===');
  const oct = computeOptimisticCostTable(nodes, numProcessors, includeTransferTimes);

  // Step 2: Calculate ranks based on OCT (average OCT across processors)
  const ranks: TaskRank[] = nodes.map(node => {
    const octValues = oct[node.id];
    const avgOCT = octValues.reduce((sum, val) => sum + val, 0) / octValues.length;
    return {
      nodeId: node.id,
      rank: avgOCT,
    };
  });

  // Step 3: Sort tasks by rank (descending)
  const sortedTasks = ranks
    .sort((a, b) => b.rank - a.rank)
    .map(r => nodes.find(n => n.id === r.nodeId)!);

  console.log('\n=== Task Priority Ranking (by avg OCT) ===');
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

  // Step 4: Schedule each task using EFT + OCT criterion
  for (const task of sortedTasks) {
    let minOptimisticFinish = Infinity;
    let bestWorkerId = workers[0].id;
    let bestStartTime = 0;
    let bestEFT = 0;

    // Try each processor and select the one that minimizes EFT + OCT
    for (let procIdx = 0; procIdx < workers.length; procIdx++) {
      const worker = workers[procIdx];

      const { eft, startTime } = calculateEFT(
        task,
        worker.id,
        nodes,
        processorSchedules,
        completionTimes,
        includeTransferTimes,
        workers
      );

      // PEFT criterion: minimize EFT + OCT
      const octValue = oct[task.id][procIdx];
      const optimisticFinish = eft + octValue;

      if (optimisticFinish < minOptimisticFinish) {
        minOptimisticFinish = optimisticFinish;
        bestWorkerId = worker.id;
        bestStartTime = startTime;
        bestEFT = eft;
      }
    }

    // Schedule the task on the best processor
    const scheduledTask: ScheduledTask = {
      nodeId: task.id,
      startTime: bestStartTime,
      endTime: bestEFT,
      workerId: bestWorkerId,
    };

    scheduledTasks.push(scheduledTask);
    completionTimes.set(task.id, bestEFT);

    // Add to processor schedule
    const schedule = processorSchedules.get(bestWorkerId)!;
    schedule.push({
      startTime: bestStartTime,
      endTime: bestEFT,
      taskId: task.id,
    });
    schedule.sort((a, b) => a.startTime - b.startTime);

    const cpIndicator = task.criticalPath ? ' [CP]' : '';
    const taskOCT = oct[task.id][workers.findIndex(w => w.id === bestWorkerId)];
    console.log(
      `→ ${task.name}${cpIndicator} on ${bestWorkerId}: [${bestStartTime.toFixed(2)}s - ${bestEFT.toFixed(2)}s] (OCT: ${taskOCT.toFixed(2)})`
    );
  }

  const makespan = Math.max(...scheduledTasks.map(t => t.endTime));
  console.log(`\n=== PEFT Complete ===`);
  console.log(`Makespan: ${makespan.toFixed(2)}s`);
  console.log(`Tasks scheduled: ${scheduledTasks.length}/${nodes.length}`);

  return scheduledTasks;
}

/**
 * Compute Optimistic Cost Table using bottom-up traversal
 *
 * OCT[task][processor] = best-case remaining execution time if task
 * is scheduled on that processor.
 *
 * For exit tasks: OCT = execution time on that processor
 * For other tasks: OCT = execution time + min over successors of:
 *                  (OCT of successor + comm cost if different processor)
 *
 * This is computed bottom-up starting from exit tasks.
 */
function computeOptimisticCostTable(
  nodes: WorkflowNode[],
  numProcessors: number,
  includeTransferTimes: boolean
): OptimisticCostTable {
  const oct: OptimisticCostTable = {};
  const processed = new Set<string>();

  // Helper functions
  function getSuccessors(nodeId: string): string[] {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return [];
    return node.connections.map(conn => conn.targetNodeId);
  }

  function getPredecessors(nodeId: string): string[] {
    return nodes.filter(n => n.connections.some(c => c.targetNodeId === nodeId)).map(n => n.id);
  }

  function getTransferTime(sourceId: string, targetId: string): number {
    if (!includeTransferTimes) return 0;

    const sourceNode = nodes.find(n => n.id === sourceId);
    if (!sourceNode) return 0;

    const connection = sourceNode.connections.find(c => c.targetNodeId === targetId);
    return connection?.transferTime || 0;
  }

  function canProcess(nodeId: string): boolean {
    const successors = getSuccessors(nodeId);
    return successors.every(succId => processed.has(succId));
  }

  // Find exit tasks (tasks with no successors)
  const exitTasks = nodes.filter(node => getSuccessors(node.id).length === 0);

  // Initialize OCT for exit tasks
  exitTasks.forEach(task => {
    oct[task.id] = new Array(numProcessors).fill(0);
    processed.add(task.id);
  });

  console.log(`Initialized OCT for ${exitTasks.length} exit tasks`);

  // Process tasks in reverse topological order (bottom-up)
  const queue: string[] = [];

  // Add all tasks that can be processed (all successors are done)
  nodes.forEach(node => {
    if (!processed.has(node.id) && canProcess(node.id)) {
      queue.push(node.id);
    }
  });

  let iterationCount = 0;
  const maxIterations = nodes.length * 2; // Safety limit

  while (queue.length > 0 && iterationCount < maxIterations) {
    iterationCount++;
    const nodeId = queue.shift()!;

    if (processed.has(nodeId)) continue;

    // Ensure all successors are processed
    if (!canProcess(nodeId)) {
      queue.push(nodeId); // Re-queue for later
      continue;
    }

    const node = nodes.find(n => n.id === nodeId)!;
    const successors = getSuccessors(nodeId);

    oct[nodeId] = new Array(numProcessors).fill(0);

    // Compute OCT for this task on each processor
    for (let currProc = 0; currProc < numProcessors; currProc++) {
      let maxSuccessorCost = 0;

      // If task has successors, compute the optimistic cost
      if (successors.length > 0) {
        for (const succId of successors) {
          // Find minimum cost across all processors for this successor
          let minProcCost = Infinity;

          for (let succProc = 0; succProc < numProcessors; succProc++) {
            const succOCT = oct[succId][succProc];
            const succExecTime = nodes.find(n => n.id === succId)?.executionTime || 0;

            // Communication cost if on different processor
            const commCost = currProc !== succProc ? getTransferTime(nodeId, succId) : 0;

            const procCost = succOCT + succExecTime + commCost;
            minProcCost = Math.min(minProcCost, procCost);
          }

          maxSuccessorCost = Math.max(maxSuccessorCost, minProcCost);
        }
      }

      // OCT = execution time on this processor + max successor cost
      oct[nodeId][currProc] = maxSuccessorCost;
    }

    processed.add(nodeId);

    // Add predecessors that are now ready to process
    const predecessors = getPredecessors(nodeId);
    predecessors.forEach(predId => {
      if (!processed.has(predId) && !queue.includes(predId) && canProcess(predId)) {
        queue.push(predId);
      }
    });
  }

  if (iterationCount >= maxIterations) {
    console.warn('OCT computation hit iteration limit - possible circular dependency');
  }

  console.log(`OCT computation complete after ${iterationCount} iterations`);
  console.log(`Processed ${processed.size}/${nodes.length} tasks`);

  return oct;
}

/**
 * Calculate Earliest Finish Time (EFT) for a task on a specific processor
 * Same as HEFT's EFT calculation with insertion-based scheduling
 */
function calculateEFT(
  task: WorkflowNode,
  workerId: string,
  nodes: WorkflowNode[],
  processorSchedules: Map<string, ProcessorSlot[]>,
  completionTimes: Map<string, number>,
  includeTransferTimes: boolean,
  workers: Worker[]
): { eft: number; startTime: number } {
  let dataReadyTime = 0;

  const dependencies = getNodeDependencies(task.id, nodes);

  for (const depId of dependencies) {
    const depCompletionTime = completionTimes.get(depId) || 0;
    const depNode = nodes.find(n => n.id === depId);

    if (!depNode) continue;

    const depSchedule = Array.from(processorSchedules.entries()).find(([_, slots]) =>
      slots.some(slot => slot.taskId === depId)
    );

    const depWorkerId = depSchedule ? depSchedule[0] : workerId;

    let transferTime = 0;

    if (includeTransferTimes && depWorkerId !== workerId) {
      const connection = depNode.connections.find(c => c.targetNodeId === task.id);
      if (connection) {
        transferTime = connection.transferTime || 0;
      }
    }

    const readyTime = depCompletionTime + transferTime;
    dataReadyTime = Math.max(dataReadyTime, readyTime);
  }

  const taskDuration = task.executionTime || 0;
  const schedule = processorSchedules.get(workerId) || [];

  const startTime = findEarliestSlot(schedule, dataReadyTime, taskDuration);
  const eft = startTime + taskDuration;

  return { eft, startTime };
}

/**
 * Find earliest available time slot using insertion-based scheduling
 */
function findEarliestSlot(
  schedule: ProcessorSlot[],
  earliestStartTime: number,
  duration: number
): number {
  if (schedule.length === 0) {
    return earliestStartTime;
  }

  const sortedSchedule = [...schedule].sort((a, b) => a.startTime - b.startTime);

  // Try before first task
  if (earliestStartTime + duration <= sortedSchedule[0].startTime) {
    return earliestStartTime;
  }

  // Try gaps between tasks
  for (let i = 0; i < sortedSchedule.length - 1; i++) {
    const gapStart = Math.max(sortedSchedule[i].endTime, earliestStartTime);
    const gapEnd = sortedSchedule[i + 1].startTime;

    if (gapEnd - gapStart >= duration) {
      return gapStart;
    }
  }

  // Schedule after last task
  const lastTask = sortedSchedule[sortedSchedule.length - 1];
  return Math.max(lastTask.endTime, earliestStartTime);
}
