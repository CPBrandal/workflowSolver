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

/**
 * Modified HEFT Scheduler with Critical Path Priority
 *
 * This scheduler:
 * 1. Schedules critical path nodes on the critical path worker when possible
 * 2. Uses HEFT for non-critical nodes
 * 3. Ensures ALL dependencies are met before scheduling any task
 */
export function CP_HEFT_Schedule(
  nodes: WorkflowNode[],
  workers: Worker[],
  includeTransferTimes: boolean = true
): ScheduledTask[] {
  if (nodes.length === 0 || workers.length === 0) {
    return [];
  }

  // Find the critical path worker and nodes
  const criticalPathWorker = workers.find(w => w.criticalPathWorker === true);
  const criticalPathNodes = new Set(nodes.filter(n => n.criticalPath === true).map(n => n.id));

  // Initialize processor schedules and tracking maps
  const processorSchedules: Map<string, ProcessorSlot[]> = new Map();
  workers.forEach(worker => {
    processorSchedules.set(worker.id, []);
  });

  const scheduledTasks: ScheduledTask[] = [];
  const completionTimes: Map<string, number> = new Map();
  const scheduledNodeIds = new Set<string>();

  // Calculate upward ranks for all nodes
  const ranks = calculateUpwardRanks(nodes, includeTransferTimes);

  // Sort all nodes by rank (maintaining HEFT priority)
  const sortedNodes = nodes
    .map(node => ({
      node,
      rank: ranks.find(r => r.nodeId === node.id)?.rank || 0,
    }))
    .sort((a, b) => b.rank - a.rank)
    .map(item => item.node);

  console.log('=== CP-HEFT Scheduling ===');
  console.log(`Critical Path Worker: ${criticalPathWorker?.id || 'None'}`);
  console.log(
    `Critical Path Nodes: ${nodes
      .filter(n => n.criticalPath)
      .map(n => n.name)
      .join(', ')}`
  );
  console.log('\nTask Ranking:');
  sortedNodes.forEach((task, idx) => {
    const rank = ranks.find(r => r.nodeId === task.id)!.rank;
    const cpMarker = task.criticalPath ? ' (CP)' : '';
    console.log(`${idx + 1}. ${task.name}${cpMarker}: rank=${rank.toFixed(2)}`);
  });
  console.log('');

  // Schedule all nodes respecting dependencies and critical path constraints
  while (scheduledNodeIds.size < nodes.length) {
    let scheduledInThisIteration = false;

    for (const task of sortedNodes) {
      if (scheduledNodeIds.has(task.id)) continue;

      // Check if ALL dependencies are scheduled
      const dependencies = getNodeDependencies(task.id, nodes);
      const allDepsScheduled = dependencies.every(depId => scheduledNodeIds.has(depId));

      if (!allDepsScheduled) {
        // Dependencies not ready, skip for now
        continue;
      }

      // Determine which workers to consider for this task
      let candidateWorkers: Worker[];

      if (task.criticalPath && criticalPathWorker) {
        // Critical path tasks MUST go on the critical path worker
        candidateWorkers = [criticalPathWorker];
      } else {
        // Non-critical tasks can go on any worker
        candidateWorkers = workers;
      }

      // Find the best worker using HEFT's EFT criterion
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

      // Schedule the task
      const scheduledTask: ScheduledTask = {
        nodeId: task.id,
        startTime: bestStartTime,
        endTime: minEFT,
        workerId: bestWorkerId,
      };

      scheduledTasks.push(scheduledTask);
      completionTimes.set(task.id, minEFT);
      scheduledNodeIds.add(task.id);
      scheduledInThisIteration = true;

      // Add to processor schedule
      const schedule = processorSchedules.get(bestWorkerId)!;
      schedule.push({
        startTime: bestStartTime,
        endTime: minEFT,
        taskId: task.id,
      });
      schedule.sort((a, b) => a.startTime - b.startTime);

      const cpMarker = task.criticalPath ? ' (CP)' : '';
      console.log(
        `Scheduled ${task.name}${cpMarker} on ${bestWorkerId}: [${bestStartTime.toFixed(2)}s - ${minEFT.toFixed(2)}s]`
      );
    }

    // Safety check to prevent infinite loops
    if (!scheduledInThisIteration && scheduledNodeIds.size < nodes.length) {
      console.error('\nWarning: Could not schedule remaining tasks due to dependency issues');
      const unscheduledTasks = sortedNodes.filter(n => !scheduledNodeIds.has(n.id));
      console.log(
        'Unscheduled tasks:',
        unscheduledTasks.map(n => n.name)
      );

      // Debug: Show why each unscheduled task can't be scheduled
      for (const task of unscheduledTasks) {
        const deps = getNodeDependencies(task.id, nodes);
        const unscheduledDeps = deps.filter(d => !scheduledNodeIds.has(d));
        if (unscheduledDeps.length > 0) {
          console.log(`  ${task.name} waiting for: ${unscheduledDeps.join(', ')}`);
        }
      }
      break;
    }
  }

  const makespan = Math.max(...scheduledTasks.map(t => t.endTime));
  console.log(`\n=== CP-HEFT Schedule Complete ===`);
  console.log(`Total makespan: ${makespan.toFixed(2)}s`);
  console.log(`Transfer times: ${includeTransferTimes ? 'ENABLED' : 'DISABLED'}`);
  console.log(
    `Critical path nodes scheduled: ${[...criticalPathNodes].filter(id => scheduledNodeIds.has(id)).length}/${criticalPathNodes.size}`
  );
  console.log(`Total scheduled: ${scheduledTasks.length}/${nodes.length}`);

  // Verify no dependency violations
  verifySchedule(scheduledTasks, nodes, includeTransferTimes);

  return scheduledTasks;
}

/**
 * Verify that the schedule respects all dependencies
 */
function verifySchedule(
  scheduledTasks: ScheduledTask[],
  nodes: WorkflowNode[],
  includeTransferTimes: boolean
): void {
  console.log('\n=== Schedule Verification ===');
  let violations = 0;

  for (const task of scheduledTasks) {
    const node = nodes.find(n => n.id === task.nodeId);
    if (!node) continue;

    const dependencies = getNodeDependencies(task.nodeId, nodes);

    for (const depId of dependencies) {
      const depTask = scheduledTasks.find(t => t.nodeId === depId);
      if (!depTask) {
        console.error(`ERROR: Dependency ${depId} not scheduled for task ${task.nodeId}`);
        violations++;
        continue;
      }

      // Check if task starts after dependency ends (considering transfer time)
      let requiredStartTime = depTask.endTime;

      if (includeTransferTimes && depTask.workerId !== task.workerId) {
        const depNode = nodes.find(n => n.id === depId);
        if (depNode) {
          const connection = depNode.connections.find(c => c.targetNodeId === task.nodeId);
          if (connection) {
            requiredStartTime += connection.transferTime;
          }
        }
      }

      if (task.startTime < requiredStartTime - 0.001) {
        // Small epsilon for floating point
        console.error(
          `ERROR: Task ${node.name} starts at ${task.startTime.toFixed(2)} ` +
            `but dependency ${depId} requires start at ${requiredStartTime.toFixed(2)} or later`
        );
        violations++;
      }
    }
  }

  if (violations === 0) {
    console.log('✓ Schedule is valid - all dependencies respected');
  } else {
    console.log(`✗ Schedule has ${violations} dependency violation(s)`);
  }
}

/**
 * Calculate upward rank for all nodes using recursive approach
 */
function calculateUpwardRanks(nodes: WorkflowNode[], includeTransferTimes: boolean): TaskRank[] {
  const ranks = new Map<string, number>();
  const visited = new Set<string>();

  function getSuccessors(nodeId: string): string[] {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return [];
    return node.connections.map(conn => conn.targetNodeId);
  }

  function getTransferTime(sourceId: string, targetId: string): number {
    if (!includeTransferTimes) return 0;
    const sourceNode = nodes.find(n => n.id === sourceId);
    if (!sourceNode) return 0;
    const connection = sourceNode.connections.find(c => c.targetNodeId === targetId);
    return connection ? connection.transferTime : 0;
  }

  function calculateRank(nodeId: string): number {
    if (ranks.has(nodeId)) {
      return ranks.get(nodeId)!;
    }

    if (visited.has(nodeId)) {
      // Circular dependency detected
      return 0;
    }

    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return 0;

    const executionTime = node.executionTime || 0;
    const successors = getSuccessors(nodeId);

    if (successors.length === 0) {
      // Exit node
      ranks.set(nodeId, executionTime);
      return executionTime;
    }

    // Calculate max(communication + successor rank) for all successors
    let maxSuccessorRank = 0;
    for (const successorId of successors) {
      const transferTime = getTransferTime(nodeId, successorId);
      const successorRank = calculateRank(successorId);
      maxSuccessorRank = Math.max(maxSuccessorRank, transferTime + successorRank);
    }

    const rank = executionTime + maxSuccessorRank;
    ranks.set(nodeId, rank);
    return rank;
  }

  // Calculate ranks for all nodes
  nodes.forEach(node => calculateRank(node.id));

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
): { eft: number; startTime: number } {
  const taskDuration = task.executionTime || 0;

  // Calculate earliest start time based on dependencies
  const dependencies = getNodeDependencies(task.id, allNodes);
  let dataReadyTime = 0;

  for (const depId of dependencies) {
    const depCompletionTime = completionTimes.get(depId);

    // If dependency is not scheduled yet, this shouldn't happen with our new approach
    if (depCompletionTime === undefined) {
      console.warn(`Warning: Dependency ${depId} not completed for task ${task.id}`);
      continue;
    }

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
    if (includeTransferTimes && depWorkerId && depWorkerId !== workerId) {
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
