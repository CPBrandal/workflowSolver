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

/**
 * Critical Path First Scheduler with Dynamic Worker Creation
 *
 * This scheduler ensures the critical path runs uninterrupted by:
 * 1. Scheduling all CP tasks on a dedicated CP worker first (0 transfer time between them)
 * 2. Scheduling non-CP tasks on other workers
 * 3. Creating new workers when scheduling would violate CP timing
 *
 */
export function CP_First_Schedule(
  nodes: WorkflowNode[],
  workers: Worker[],
  includeTransferTimes: boolean = true
): { scheduledTasks: ScheduledTask[]; availableWorkers: Worker[] } {
  if (nodes.length === 0 || workers.length === 0) {
    return { scheduledTasks: [], availableWorkers: [] };
  }

  // Find critical path worker and nodes
  const criticalPathWorker = workers.find(w => w.criticalPathWorker === true) || workers[0];
  const criticalPathNodes = nodes.filter(n => n.criticalPath === true);
  const criticalPathNodeIds = new Set(criticalPathNodes.map(n => n.id));

  // Create a mutable copy of workers array for dynamic worker creation
  const availableWorkers = [...workers];

  // Extract highest worker number from existing workers to avoid duplicates
  const maxWorkerId = workers.reduce((max, worker) => {
    const match = worker.id.match(/worker-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      return Math.max(max, num);
    }
    return max;
  }, 0);

  let nextWorkerId = maxWorkerId + 1;

  // Initialize tracking structures
  const processorSchedules: Map<string, ProcessorSlot[]> = new Map();
  availableWorkers.forEach(worker => {
    processorSchedules.set(worker.id, []);
  });

  const scheduledTasks: ScheduledTask[] = [];
  const completionTimes: Map<string, number> = new Map();
  const scheduledNodeIds = new Set<string>();
  const nodeToWorker: Map<string, string> = new Map();

  console.log('=== CP-First Scheduling with Dynamic Workers (Multi-Pass) ===');
  console.log(`Critical Path Worker: ${criticalPathWorker.id}`);
  console.log(`Critical Path Nodes: ${criticalPathNodes.map(n => n.name).join(' → ')}`);
  console.log('');

  // Sort CP nodes by their position in the critical path (using dependencies)
  const cpNodesSorted = topologicalSort(criticalPathNodes, nodes);

  // Calculate ranks for all nodes to determine scheduling order for non-CP tasks
  const ranks = calculateUpwardRanks(nodes, includeTransferTimes);

  // PRE-CALCULATE IDEAL CP SCHEDULE (ignoring non-CP dependencies temporarily)
  // This establishes the timing constraints that non-CP tasks must respect
  console.log('PRE-CALCULATION: Establishing CP timing constraints');
  console.log('---------------------------------------------------');

  const idealCpSchedule = new Map<string, { startTime: number; endTime: number }>();

  for (const cpNode of cpNodesSorted) {
    // Only consider CP dependencies for this ideal schedule
    const cpDependencies = getNodeDependencies(cpNode.id, nodes).filter(depId =>
      criticalPathNodeIds.has(depId)
    );

    let cpStartTime = 0;
    for (const depId of cpDependencies) {
      const depIdeal = idealCpSchedule.get(depId);
      if (depIdeal) {
        // No transfer time between CP tasks (same worker)
        cpStartTime = Math.max(cpStartTime, depIdeal.endTime);
      }
    }

    const cpEndTime = cpStartTime + (cpNode.executionTime || 0);
    idealCpSchedule.set(cpNode.id, { startTime: cpStartTime, endTime: cpEndTime });

    console.log(
      `  CP task ${cpNode.name} ideal window: [${cpStartTime.toFixed(2)}s - ${cpEndTime.toFixed(2)}s]`
    );
  }

  console.log('');

  /**
   * Helper function to schedule a single task
   */
  function scheduleTask(
    task: WorkflowNode,
    isCpTask: boolean
  ): { scheduled: boolean; workerId: string | null } {
    // Check if all dependencies are scheduled
    const dependencies = getNodeDependencies(task.id, nodes);
    const unscheduledDeps = dependencies.filter(depId => !scheduledNodeIds.has(depId));

    if (unscheduledDeps.length > 0) {
      // Cannot schedule yet - dependencies not ready
      return { scheduled: false, workerId: null };
    }

    // Calculate start time based on all dependencies (both CP and non-CP)
    let dataReadyTime = 0;
    for (const depId of dependencies) {
      const depEndTime = completionTimes.get(depId);
      const depWorkerId = nodeToWorker.get(depId);

      if (depEndTime !== undefined && depWorkerId !== undefined) {
        let transferTime = 0;

        // For CP tasks, check if coming from another worker
        if (isCpTask && includeTransferTimes && depWorkerId !== criticalPathWorker.id) {
          const depNode = nodes.find(n => n.id === depId);
          if (depNode) {
            const connection = depNode.connections.find(c => c.targetNodeId === task.id);
            transferTime = connection ? connection.transferTime : 0;
          }
        } else if (!isCpTask && includeTransferTimes) {
          // For non-CP tasks, transfer time will be calculated per-worker below
        }

        if (isCpTask) {
          // CP tasks: no transfer time between CP tasks, but include from non-CP
          dataReadyTime = Math.max(dataReadyTime, depEndTime + transferTime);
        } else {
          // Non-CP tasks: just track when data is ready from dependencies
          dataReadyTime = Math.max(dataReadyTime, depEndTime);
        }
      }
    }

    if (isCpTask) {
      // Schedule CP task on the CP worker
      const startTime = dataReadyTime;
      const endTime = startTime + (task.executionTime || 0);

      const scheduledTask: ScheduledTask = {
        nodeId: task.id,
        startTime,
        endTime,
        workerId: criticalPathWorker.id,
      };

      scheduledTasks.push(scheduledTask);
      completionTimes.set(task.id, endTime);
      scheduledNodeIds.add(task.id);
      nodeToWorker.set(task.id, criticalPathWorker.id);

      // Update processor schedule
      const schedule = processorSchedules.get(criticalPathWorker.id)!;
      schedule.push({
        startTime,
        endTime,
        taskId: task.id,
      });

      console.log(
        `  Scheduled CP task ${task.name} on ${criticalPathWorker.id}: [${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s]`
      );

      return { scheduled: true, workerId: criticalPathWorker.id };
    } else {
      // Schedule non-CP task - find best worker or create new one
      // Use pre-calculated ideal CP schedule as timing constraints
      const cpTimingConstraints = new Map<string, { mustStartBy: number }>();

      // Use ideal CP times if available, otherwise use actual scheduled times
      for (const [cpNodeId, idealTiming] of idealCpSchedule) {
        cpTimingConstraints.set(cpNodeId, { mustStartBy: idealTiming.startTime });
      }

      // Override with actual scheduled times if they exist (more accurate)
      for (const scheduledTask of scheduledTasks) {
        if (criticalPathNodeIds.has(scheduledTask.nodeId)) {
          cpTimingConstraints.set(scheduledTask.nodeId, { mustStartBy: scheduledTask.startTime });
        }
      }

      let bestWorkerId: string | null = null;
      let bestStartTime = Infinity;
      let bestEndTime = Infinity;
      let wouldViolateCp = false;

      // Try scheduling on each existing worker
      for (const worker of availableWorkers) {
        const { startTime, endTime, violatesCp } = calculateTaskTiming(
          task,
          worker.id,
          nodes,
          processorSchedules,
          completionTimes,
          nodeToWorker,
          cpTimingConstraints,
          includeTransferTimes,
          criticalPathWorker.id
        );

        if (!violatesCp && endTime < bestEndTime) {
          bestWorkerId = worker.id;
          bestStartTime = startTime;
          bestEndTime = endTime;
          wouldViolateCp = false;
        } else if (violatesCp && bestWorkerId === null) {
          wouldViolateCp = true;
        }
      }

      // If scheduling on any existing worker would violate CP, create a new worker
      if (wouldViolateCp || bestWorkerId === null) {
        if (wouldViolateCp) {
          console.log(`  → Creating new worker to avoid CP violation for task ${task.name}`);
        } else {
          console.log(`  → Creating new worker for task ${task.name} (no suitable worker found)`);
        }

        const newWorker: Worker = {
          id: `worker-${nextWorkerId}`,
          criticalPathWorker: false,
          time: 0,
          isActive: false,
          currentTask: null,
        };
        nextWorkerId++;
        availableWorkers.push(newWorker);
        processorSchedules.set(newWorker.id, []);

        // Calculate timing for the new worker
        const { startTime, endTime } = calculateTaskTiming(
          task,
          newWorker.id,
          nodes,
          processorSchedules,
          completionTimes,
          nodeToWorker,
          cpTimingConstraints,
          includeTransferTimes,
          criticalPathWorker.id
        );

        bestWorkerId = newWorker.id;
        bestStartTime = startTime;
        bestEndTime = endTime;
      }

      // Schedule the task
      const scheduledTask: ScheduledTask = {
        nodeId: task.id,
        startTime: bestStartTime,
        endTime: bestEndTime,
        workerId: bestWorkerId!,
      };

      scheduledTasks.push(scheduledTask);
      completionTimes.set(task.id, bestEndTime);
      scheduledNodeIds.add(task.id);
      nodeToWorker.set(task.id, bestWorkerId!);

      // Update processor schedule
      const schedule = processorSchedules.get(bestWorkerId!)!;
      schedule.push({
        startTime: bestStartTime,
        endTime: bestEndTime,
        taskId: task.id,
      });
      schedule.sort((a, b) => a.startTime - b.startTime);

      console.log(
        `  Scheduled non-CP task ${task.name} on ${bestWorkerId}: [${bestStartTime.toFixed(2)}s - ${bestEndTime.toFixed(2)}s]`
      );

      return { scheduled: true, workerId: bestWorkerId! };
    }
  }

  /**
   * Recursively schedule a task and all its unscheduled dependencies
   */
  function scheduleTaskWithDependencies(task: WorkflowNode, isCpTask: boolean): boolean {
    // If already scheduled, return true
    if (scheduledNodeIds.has(task.id)) {
      return true;
    }

    // Get all dependencies
    const dependencies = getNodeDependencies(task.id, nodes);

    // First, recursively schedule all unscheduled dependencies
    for (const depId of dependencies) {
      if (!scheduledNodeIds.has(depId)) {
        const depNode = nodes.find(n => n.id === depId);
        if (!depNode) {
          console.error(`Dependency node ${depId} not found`);
          return false;
        }

        const depIsCp = criticalPathNodeIds.has(depId);
        const success = scheduleTaskWithDependencies(depNode, depIsCp);
        if (!success) {
          console.error(`Failed to schedule dependency ${depNode.name} for ${task.name}`);
          return false;
        }
      }
    }

    // Now all dependencies are scheduled, schedule this task
    const result = scheduleTask(task, isCpTask);
    return result.scheduled;
  }

  // MULTI-PASS APPROACH:
  // Pass 1: Schedule all CP tasks (and their non-CP dependencies recursively)
  console.log('PASS 1: Scheduling Critical Path Tasks (and their dependencies)');
  console.log('----------------------------------------------------------------');

  for (const cpNode of cpNodesSorted) {
    if (!scheduledNodeIds.has(cpNode.id)) {
      const success = scheduleTaskWithDependencies(cpNode, true);
      if (!success) {
        console.error(`Failed to schedule CP task ${cpNode.name}`);
      }
    }
  }

  console.log('\nPASS 2: Scheduling Remaining Non-Critical Path Tasks');
  console.log('---------------------------------------------------');

  // Pass 2: Schedule remaining non-CP tasks
  const remainingNonCpNodes = nodes
    .filter(n => !scheduledNodeIds.has(n.id))
    .map(node => ({
      node,
      rank: ranks.find(r => r.nodeId === node.id)?.rank || 0,
    }))
    .sort((a, b) => b.rank - a.rank)
    .map(item => item.node);

  for (const task of remainingNonCpNodes) {
    if (!scheduledNodeIds.has(task.id)) {
      const success = scheduleTaskWithDependencies(task, false);
      if (!success) {
        console.warn(`Could not schedule ${task.name}`);
      }
    }
  }

  // Calculate final metrics
  const makespan = Math.max(...scheduledTasks.map(t => t.endTime));
  const totalWorkers = availableWorkers.length;
  const workersCreated = totalWorkers - workers.length;

  console.log('\n=== CP-First Schedule Complete ===');
  console.log(`Total makespan: ${makespan.toFixed(2)}s`);
  console.log(`Transfer times: ${includeTransferTimes ? 'ENABLED' : 'DISABLED'}`);
  console.log(`Total workers used: ${totalWorkers} (${workersCreated} dynamically created)`);
  console.log(`Tasks scheduled: ${scheduledTasks.length}/${nodes.length}`);

  // Calculate CP length for comparison
  const cpLength = criticalPathNodes.reduce((sum, node) => sum + (node.executionTime || 0), 0);
  console.log(`Critical Path Length: ${cpLength.toFixed(2)}s`);
  console.log(
    `Overhead: ${(makespan - cpLength).toFixed(2)}s (${((makespan / cpLength - 1) * 100).toFixed(1)}%)`
  );

  // Verify the schedule
  verifySchedule(scheduledTasks, nodes, includeTransferTimes);

  return { scheduledTasks, availableWorkers };
}

/**
 * Calculate when a task can be scheduled on a specific worker
 * and check if it would violate critical path timing
 */
function calculateTaskTiming(
  task: WorkflowNode,
  workerId: string,
  allNodes: WorkflowNode[],
  processorSchedules: Map<string, ProcessorSlot[]>,
  completionTimes: Map<string, number>,
  nodeToWorker: Map<string, string>,
  cpTimingConstraints: Map<string, { mustStartBy: number }>,
  includeTransferTimes: boolean,
  cpWorkerId: string
): { startTime: number; endTime: number; violatesCp: boolean } {
  const taskDuration = task.executionTime || 0;

  // Calculate earliest start time based on dependencies
  const dependencies = getNodeDependencies(task.id, allNodes);
  let dataReadyTime = 0;

  for (const depId of dependencies) {
    const depCompletionTime = completionTimes.get(depId);
    if (depCompletionTime === undefined) continue;

    const depWorkerId = nodeToWorker.get(depId);
    if (!depWorkerId) continue;

    // Add transfer time if on different workers
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
  const endTime = startTime + taskDuration;

  // Check if this task is a dependency of any CP task
  let violatesCp = false;
  for (const connection of task.connections) {
    const targetConstraint = cpTimingConstraints.get(connection.targetNodeId);
    if (targetConstraint) {
      // This task feeds into a CP task

      // IMPORTANT: If the CP task is already scheduled, we can't violate it anymore!
      // It's already completed, so skip this constraint check
      const cpTaskAlreadyScheduled = completionTimes.has(connection.targetNodeId);
      if (cpTaskAlreadyScheduled) {
        continue; // Skip - this CP task is already done, can't violate it
      }

      // Calculate the ACTUAL earliest start time for the CP task considering all its scheduled dependencies
      const cpTask = allNodes.find(n => n.id === connection.targetNodeId);
      if (!cpTask) continue;

      const cpDependencies = getNodeDependencies(cpTask.id, allNodes);
      let cpActualEarliestStart = 0;

      for (const cpDepId of cpDependencies) {
        const cpDepTime = completionTimes.get(cpDepId);
        if (cpDepTime === undefined) continue; // Not scheduled yet

        const cpDepWorkerId = nodeToWorker.get(cpDepId);
        if (!cpDepWorkerId) continue;

        // Add transfer time if dependency is on different worker than CP worker
        let cpTransferTime = 0;
        if (includeTransferTimes && cpDepWorkerId !== cpWorkerId) {
          const cpDepNode = allNodes.find(n => n.id === cpDepId);
          if (cpDepNode) {
            const cpConnection = cpDepNode.connections.find(c => c.targetNodeId === cpTask.id);
            cpTransferTime = cpConnection ? cpConnection.transferTime : 0;
          }
        }

        cpActualEarliestStart = Math.max(cpActualEarliestStart, cpDepTime + cpTransferTime);
      }

      // Now calculate when this non-CP task would let the CP task start
      let transferTime = 0;
      if (includeTransferTimes && workerId !== cpWorkerId) {
        transferTime = connection.transferTime;
      }

      const thisTaskWouldAllowCpAt = endTime + transferTime;

      // The CP task is "delayed" only if this task would push it beyond what's already unavoidable
      // Compare against the max of (ideal time, actual earliest based on other deps)
      const effectiveConstraint = Math.max(targetConstraint.mustStartBy, cpActualEarliestStart);

      if (thisTaskWouldAllowCpAt > effectiveConstraint) {
        violatesCp = true;
        break;
      }
    }
  }

  return { startTime, endTime, violatesCp };
}

/**
 * Topological sort for ordering tasks respecting dependencies
 */
function topologicalSort(nodesToSort: WorkflowNode[], allNodes: WorkflowNode[]): WorkflowNode[] {
  const sorted: WorkflowNode[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(nodeId: string): void {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) {
      console.warn(`Circular dependency detected at ${nodeId}`);
      return;
    }

    visiting.add(nodeId);

    const node = nodesToSort.find(n => n.id === nodeId);
    if (node) {
      // Visit dependencies first
      const deps = getNodeDependencies(node.id, allNodes);
      for (const depId of deps) {
        if (nodesToSort.some(n => n.id === depId)) {
          visit(depId);
        }
      }

      sorted.push(node);
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  for (const node of nodesToSort) {
    visit(node.id);
  }

  return sorted;
}

/**
 * Calculate upward rank for all nodes
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
      return 0; // Circular dependency
    }

    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return 0;

    const executionTime = node.executionTime || 0;
    const successors = getSuccessors(nodeId);

    if (successors.length === 0) {
      ranks.set(nodeId, executionTime);
      return executionTime;
    }

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

  nodes.forEach(node => calculateRank(node.id));
  return Array.from(ranks.entries()).map(([nodeId, rank]) => ({ nodeId, rank }));
}

/**
 * Find the earliest time slot that can accommodate a task
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
      const candidateEnd = earliestStartTime + duration;
      if (candidateEnd <= slot.startTime) {
        return earliestStartTime;
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

  // Schedule after the last task
  const lastSlot = schedule[schedule.length - 1];
  return Math.max(lastSlot.endTime, earliestStartTime);
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
    console.log('✓ Critical path runs uninterrupted');
  } else {
    console.log(`✗ Schedule has ${violations} dependency violation(s)`);
  }
}
