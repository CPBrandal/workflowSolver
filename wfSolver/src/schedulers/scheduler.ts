import type { ScheduledTask, Worker, WorkflowNode } from '../utils/../types';
import { getNodeDependencies } from '../utils/getNodeDependencies';

export function cpGreedy(
  nodes: WorkflowNode[],
  workers: Worker[],
  includeTransferTimes: boolean = true
) {
  const scheduledTasks: ScheduledTask[] = [];
  const completionTimes: { [nodeId: string]: number } = {};
  const processedNodes = new Set<string>();

  // Map to track which worker each node is scheduled on
  const nodeToWorker: { [nodeId: string]: string } = {};

  // Track worker availability times
  const workerAvailability: { [workerId: string]: number } = {};
  workers.forEach(worker => {
    workerAvailability[worker.id] = 0;
  });

  // Find the dedicated critical path worker
  const criticalPathWorker = workers.find(worker => worker.criticalPathWorker);
  const criticalPathWorkerId = criticalPathWorker?.id;

  if (!criticalPathWorker) {
    console.warn('No critical path worker found! Falling back to regular scheduling.');
  } else {
    console.log(`Using ${criticalPathWorkerId} as dedicated critical path worker`);
  }

  // Helper function to find transfer time
  function findTransferTime(
    sourceNodeId: string,
    targetNodeId: string,
    sourceWorkerId?: string,
    targetWorkerId?: string
  ): number {
    if (!includeTransferTimes) return 0;

    // Transfer time is 0 if both tasks are on the same worker
    if (sourceWorkerId && targetWorkerId && sourceWorkerId === targetWorkerId) {
      return 0;
    }

    const sourceNode = nodes.find(n => n.id === sourceNodeId);
    if (!sourceNode) return 0;
    const connection = sourceNode.connections.find(conn => conn.targetNodeId === targetNodeId);
    return connection ? connection.transferTime : 0;
  }

  // Helper to check if scheduling a task on CP worker would interfere with CP tasks
  function wouldInterfereWithCP(taskStartTime: number, taskEndTime: number, cpWorkerId: string) {
    // Get all CP tasks scheduled on CP worker
    const cpTasksOnCPWorker = scheduledTasks.filter(task => {
      const node = nodes.find(n => n.id === task.nodeId);
      return node?.criticalPath && task.workerId === cpWorkerId;
    });

    // Check if the task would overlap with any CP task
    for (const cpTask of cpTasksOnCPWorker) {
      // If tasks overlap (not completely before or after), it interferes
      if (!(taskEndTime <= cpTask.startTime || taskStartTime >= cpTask.endTime)) {
        return true;
      }
    }
    return false;
  }

  // ========== Unified scheduling: Prioritize CP tasks, but schedule all nodes ==========
  console.log('=== Scheduling Tasks (CP greedy ) ===');
  const allNodesToProcess = [...nodes];

  while (allNodesToProcess.length > 0) {
    // Find all ready nodes (all dependencies are scheduled)
    const readyNodes = allNodesToProcess.filter(node => {
      const dependencies = getNodeDependencies(node.id, nodes);
      return dependencies.every(depId => processedNodes.has(depId));
    });

    if (readyNodes.length === 0) {
      const remainingNodeNames = allNodesToProcess.map(n => n.name).join(', ');
      console.error(
        `No ready nodes found, but ${allNodesToProcess.length} nodes remain unprocessed: ${remainingNodeNames}`
      );
      console.error('Possible circular dependency or missing dependencies.');
      break;
    }

    // Separate ready nodes into CP and non-CP
    const readyCPNodes = readyNodes.filter(n => n.criticalPath);
    const readyNonCPNodes = readyNodes.filter(n => !n.criticalPath);

    // Schedule CP nodes first (if any are ready)
    if (readyCPNodes.length > 0) {
      // Sort CP nodes by execution time (greedy: shorter tasks first)
      readyCPNodes.sort((a, b) => (a.executionTime || 1) - (b.executionTime || 1));

      for (const node of readyCPNodes) {
        if (!criticalPathWorker) {
          console.error('Cannot schedule CP task without CP worker');
          continue;
        }

        const dependencies = getNodeDependencies(node.id, nodes);

        // Calculate earliest start time based on dependencies
        let earliestStart = 0;
        if (dependencies.length > 0) {
          earliestStart = Math.max(
            ...dependencies.map(depId => {
              const depCompletionTime = completionTimes[depId] || 0;
              const depWorkerId = nodeToWorker[depId];
              // CP tasks are all on CP worker, so transfer time between them is 0
              // Transfer time only needed if dependency is not on CP worker
              const transferTime = findTransferTime(
                depId,
                node.id,
                depWorkerId,
                criticalPathWorkerId
              );
              return depCompletionTime + transferTime;
            })
          );
        }

        // Schedule on critical path worker
        const workerId = criticalPathWorkerId!;
        const workerAvailableTime = workerAvailability[workerId] || 0;
        const actualStartTime = Math.max(earliestStart, workerAvailableTime);
        const taskDuration = node.executionTime || 0;
        const completionTime = actualStartTime + taskDuration;

        const scheduledTask: ScheduledTask = {
          nodeId: node.id,
          startTime: actualStartTime,
          endTime: completionTime,
          workerId: workerId,
        };

        scheduledTasks.push(scheduledTask);
        completionTimes[node.id] = completionTime;
        processedNodes.add(node.id);
        nodeToWorker[node.id] = workerId;
        workerAvailability[workerId] = completionTime;

        // Remove from processing list
        const index = allNodesToProcess.findIndex(n => n.id === node.id);
        if (index > -1) {
          allNodesToProcess.splice(index, 1);
        }

        console.log(
          `[CP] Scheduled ${node.name} on ${workerId}: ${actualStartTime}s - ${completionTime}s`
        );
      }
    }

    // Then schedule non-CP nodes (if any are ready)
    if (readyNonCPNodes.length > 0) {
      // Sort non-CP nodes by execution time (greedy: shorter tasks first)
      readyNonCPNodes.sort((a, b) => (a.executionTime || 1) - (b.executionTime || 1));

      for (const node of readyNonCPNodes) {
        const dependencies = getNodeDependencies(node.id, nodes);

        // Calculate earliest start time based on dependencies
        let earliestStart = 0;
        if (dependencies.length > 0) {
          earliestStart = Math.max(
            ...dependencies.map(depId => {
              const depCompletionTime = completionTimes[depId] || 0;
              const depWorkerId = nodeToWorker[depId];
              // We don't know target worker yet, so use original transfer time
              // Will be recalculated when we pick the worker
              const transferTime = findTransferTime(depId, node.id, depWorkerId, undefined);
              return depCompletionTime + transferTime;
            })
          );
        }

        // Greedily find the best worker (earliest available)
        let bestWorkerId: string | null = null;
        let bestStartTime = Infinity;
        let bestEndTime = Infinity;

        for (const [workerId, workerAvailableTime] of Object.entries(workerAvailability)) {
          // Recalculate with actual transfer times for this worker
          let adjustedEarliestStart = earliestStart;
          if (dependencies.length > 0) {
            adjustedEarliestStart = Math.max(
              ...dependencies.map(depId => {
                const depCompletionTime = completionTimes[depId] || 0;
                const depWorkerId = nodeToWorker[depId];
                const transferTime = findTransferTime(depId, node.id, depWorkerId, workerId);
                return depCompletionTime + transferTime;
              })
            );
          }

          const adjustedStartTime = Math.max(adjustedEarliestStart, workerAvailableTime);
          const taskDuration = node.executionTime || 0;
          const adjustedEndTime = adjustedStartTime + taskDuration;

          // If this is the CP worker, check for interference
          if (criticalPathWorkerId && workerId === criticalPathWorkerId) {
            if (wouldInterfereWithCP(adjustedStartTime, adjustedEndTime, workerId)) {
              continue; // Skip this worker, it would interfere
            }
          }

          // Choose the worker that gives the earliest completion time
          if (adjustedEndTime < bestEndTime) {
            bestWorkerId = workerId;
            bestStartTime = adjustedStartTime;
            bestEndTime = adjustedEndTime;
          }
        }

        if (!bestWorkerId) {
          console.error(`No available worker for task ${node.name}`);
          continue;
        }

        const scheduledTask: ScheduledTask = {
          nodeId: node.id,
          startTime: bestStartTime,
          endTime: bestEndTime,
          workerId: bestWorkerId,
        };

        scheduledTasks.push(scheduledTask);
        completionTimes[node.id] = bestEndTime;
        processedNodes.add(node.id);
        nodeToWorker[node.id] = bestWorkerId;
        workerAvailability[bestWorkerId] = bestEndTime;

        // Remove from processing list
        const index = allNodesToProcess.findIndex(n => n.id === node.id);
        if (index > -1) {
          allNodesToProcess.splice(index, 1);
        }

        const cpWorkerNote =
          criticalPathWorkerId && bestWorkerId === criticalPathWorkerId ? ' (on CP worker)' : '';
        console.log(
          `[Non-CP] Scheduled ${node.name} on ${bestWorkerId}: ${bestStartTime}s - ${bestEndTime}s${cpWorkerNote}`
        );
      }
      9;
    }
  }

  console.log('=== Final Schedule ===');
  console.log(`Transfer times: ${includeTransferTimes ? 'ENABLED' : 'DISABLED'}`);
  scheduledTasks.forEach(task => {
    const node = nodes.find(n => n.id === task.nodeId);
    const criticalPathIndicator = node?.criticalPath ? ' (Critical Path)' : '';
    console.log(
      `${node?.name}: ${task.startTime}s - ${task.endTime}s (Worker: ${task.workerId})${criticalPathIndicator}`
    );
  });

  const maxConcurrentWorkers = calculateMaxConcurrentWorkers(scheduledTasks);
  console.log(`=============== Max concurrent workers: ${maxConcurrentWorkers} ==============`);

  return scheduledTasks;
}

export function calculateMaxConcurrentWorkers(scheduledTasks: ScheduledTask[]): number {
  if (scheduledTasks.length === 0) return 0;

  const events: Array<{ time: number; type: 'start' | 'end' }> = [];

  scheduledTasks.forEach(task => {
    events.push({ time: task.startTime, type: 'start' });
    events.push({ time: task.endTime, type: 'end' });
  });

  events.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    return a.type === 'end' ? -1 : 1;
  });

  let currentActive = 0;
  let maxConcurrent = 0;

  events.forEach(event => {
    currentActive += event.type === 'start' ? 1 : -1;
    maxConcurrent = Math.max(maxConcurrent, currentActive);
  });

  return maxConcurrent;
}
