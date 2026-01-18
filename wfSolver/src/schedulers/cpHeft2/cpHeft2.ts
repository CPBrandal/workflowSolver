import type {
  CriticalPathResult,
  ProcessorSlot,
  ScheduledTask,
  Worker,
  WorkflowNode,
} from '../../types';
import { analyzeCriticalPath } from '../../utils/criticalPathAnalyzer';
import { getNodeDependencies } from '../../utils/getNodeDependencies';
import { calculateUpwardRanks } from './calculateUpwardsRank';

/**
 * CP-HEFT Scheduler with Critical Path Priority
 *
 * Two-phase approach:
 * 1. CP tasks are prioritized and scheduled on the CP worker using earliestStart from CP analysis
 * 2. Non-CP tasks are scheduled by upward rank on any worker (including CP worker gaps)
 *
 * Key behaviors:
 * - CP tasks are sorted by their theoretical earliestStart (from CP analysis)
 * - Non-CP tasks are sorted by upward rank (descending)
 * - Transfer time = 0 when tasks are on the same worker
 * - When a non-CP predecessor is placed on CP worker, subsequent CP tasks benefit from zero transfer time
 */
export function cpHeftSchedule(
  nodes: WorkflowNode[],
  workers: Worker[],
  includeTransferTimes: boolean = true,
  cpAnalysis?: CriticalPathResult
): ScheduledTask[] {
  if (nodes.length === 0 || workers.length === 0) {
    return [];
  }

  // Find CP worker (warn if not found)
  const cpWorker = workers.find(w => w.criticalPathWorker === true);
  if (!cpWorker && nodes.some(n => n.criticalPath)) {
    console.warn('No CP worker designated - CP tasks will be assigned to first worker');
  }

  const cpTaskIds = new Set(nodes.filter(n => n.criticalPath).map(n => n.id));

  // Get or compute CP analysis for scheduling order
  const analysis = cpAnalysis ?? analyzeCriticalPath(nodes, includeTransferTimes);
  const cpEarliestStart = new Map<string, number>();
  for (const node of analysis.nodes) {
    cpEarliestStart.set(node.id, node.earliestStart);
  }

  // Calculate upward ranks for non-CP task ordering
  const ranks = calculateUpwardRanks(nodes, includeTransferTimes);
  const rankMap = new Map(ranks.map(r => [r.nodeId, r.rank]));

  // Sort: CP tasks first (by earliestStart ascending), then non-CP by upward rank (descending)
  const sortedNodes = [...nodes].sort((a, b) => {
    const aIsCp = cpTaskIds.has(a.id);
    const bIsCp = cpTaskIds.has(b.id);

    // Primary criterion: CP tasks before non-CP tasks
    if (aIsCp && !bIsCp) return -1;
    if (!aIsCp && bIsCp) return 1;

    // Within CP tasks: sort by earliestStart (ascending) to follow CP order
    if (aIsCp && bIsCp) {
      const aStart = cpEarliestStart.get(a.id) ?? 0;
      const bStart = cpEarliestStart.get(b.id) ?? 0;
      if (aStart !== bStart) return aStart - bStart;
      // Tiebreaker: upward rank descending
      return (rankMap.get(b.id) ?? 0) - (rankMap.get(a.id) ?? 0);
    }

    // Non-CP tasks: sort by upward rank (descending)
    return (rankMap.get(b.id) ?? 0) - (rankMap.get(a.id) ?? 0);
  });

  // Initialize scheduling state
  const processorSchedules = new Map<string, ProcessorSlot[]>();
  workers.forEach(w => processorSchedules.set(w.id, []));

  const scheduledTasks: ScheduledTask[] = [];
  const completionTimes = new Map<string, number>();
  const scheduledNodeIds = new Set<string>();

  // O(1) lookup for task -> worker mapping (efficiency improvement)
  const taskWorkerMap = new Map<string, string>();

  // Ready-queue scheduling loop
  while (scheduledNodeIds.size < nodes.length) {
    let progress = false;

    for (const task of sortedNodes) {
      if (scheduledNodeIds.has(task.id)) continue;

      // Check if all dependencies are scheduled
      const deps = getNodeDependencies(task.id, nodes);
      if (!deps.every(d => scheduledNodeIds.has(d))) continue;

      const isCpTask = cpTaskIds.has(task.id);

      // Determine candidate workers
      const candidateWorkers = isCpTask ? [cpWorker ?? workers[0]] : workers;

      // Find best worker by EFT
      let minEFT = Infinity;
      let bestWorkerId = candidateWorkers[0].id;
      let bestStartTime = 0;

      for (const worker of candidateWorkers) {
        const { eft, startTime } = calculateEFTWithMap(
          task,
          worker.id,
          nodes,
          processorSchedules,
          completionTimes,
          taskWorkerMap,
          includeTransferTimes
        );

        if (eft < minEFT) {
          minEFT = eft;
          bestWorkerId = worker.id;
          bestStartTime = startTime;
        }
      }

      // Schedule the task
      scheduledTasks.push({
        nodeId: task.id,
        startTime: bestStartTime,
        endTime: minEFT,
        workerId: bestWorkerId,
      });

      completionTimes.set(task.id, minEFT);
      scheduledNodeIds.add(task.id);
      taskWorkerMap.set(task.id, bestWorkerId);
      progress = true;

      // Update processor schedule
      const schedule = processorSchedules.get(bestWorkerId)!;
      schedule.push({ startTime: bestStartTime, endTime: minEFT, taskId: task.id });
      schedule.sort((a, b) => a.startTime - b.startTime);
    }

    // Safety check for infinite loops
    if (!progress && scheduledNodeIds.size < nodes.length) {
      console.error('Could not schedule all tasks - dependency cycle or missing nodes');
      break;
    }
  }

  return scheduledTasks;
}

/**
 * Optimized EFT calculation using direct task-worker map lookup
 */
function calculateEFTWithMap(
  task: WorkflowNode,
  workerId: string,
  allNodes: WorkflowNode[],
  processorSchedules: Map<string, ProcessorSlot[]>,
  completionTimes: Map<string, number>,
  taskWorkerMap: Map<string, string>,
  includeTransferTimes: boolean
) {
  const taskDuration = task.executionTime || 0;
  const dependencies = getNodeDependencies(task.id, allNodes);

  let dataReadyTime = 0;

  for (const depId of dependencies) {
    const depCompletionTime = completionTimes.get(depId) || 0;

    // O(1) lookup instead of O(workers * tasks)
    const depWorkerId = taskWorkerMap.get(depId) || '';

    let transferTime = 0;
    if (includeTransferTimes && depWorkerId !== workerId) {
      const depNode = allNodes.find(n => n.id === depId);
      if (depNode) {
        const connection = depNode.connections.find(c => c.targetNodeId === task.id);
        transferTime = connection?.transferTime ?? 0;
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
 * Implements insertion-based scheduling to utilize gaps in the schedule
 */
function findEarliestSlot(
  schedule: ProcessorSlot[],
  earliestStartTime: number,
  duration: number
): number {
  if (schedule.length === 0) {
    return earliestStartTime;
  }

  // Check if task fits before the first scheduled slot
  const firstSlot = schedule[0];
  if (earliestStartTime + duration <= firstSlot.startTime) {
    return earliestStartTime;
  }

  // Check gaps between scheduled slots
  for (let i = 0; i < schedule.length - 1; i++) {
    const currentSlot = schedule[i];
    const nextSlot = schedule[i + 1];

    const gapStart = Math.max(currentSlot.endTime, earliestStartTime);
    const gapEnd = nextSlot.startTime;

    if (gapEnd - gapStart >= duration) {
      return gapStart;
    }
  }

  // Schedule after the last slot
  const lastSlot = schedule[schedule.length - 1];
  return Math.max(lastSlot.endTime, earliestStartTime);
}
