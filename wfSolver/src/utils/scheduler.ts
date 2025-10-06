import type { ScheduledTask, Worker, WorkflowNode } from '../types';
import { getNodeDependencies } from './getNodeDependencies';

export function scheduleWithWorkerConstraints(
  nodes: WorkflowNode[],
  workers: Worker[],
  includeTransferTimes: boolean = true
): ScheduledTask[] {
  const scheduledTasks: ScheduledTask[] = [];
  const completionTimes: { [nodeId: string]: number } = {};
  const processedNodes = new Set<string>();
  const nodesToProcess = [...nodes];

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

  function findTransferTime(sourceNodeId: string, targetNodeId: string): number {
    if (!includeTransferTimes) return 0;

    const sourceNode = nodes.find(n => n.id === sourceNodeId);
    if (!sourceNode) return 0;
    const connection = sourceNode.connections.find(conn => conn.targetNodeId === targetNodeId);
    return connection ? connection.transferTime : 0;
  }

  while (nodesToProcess.length > 0) {
    const readyNodes = nodesToProcess.filter(node => {
      const dependencies = getNodeDependencies(node.id, nodes);
      return dependencies.every(depId => processedNodes.has(depId));
    });

    if (readyNodes.length === 0) {
      console.warn(
        'No ready nodes found, but nodes remain unprocessed. Possible circular dependency.'
      );
      break;
    }

    // Sort: Critical path tasks first, then by execution time
    readyNodes.sort((a, b) => {
      if (a.criticalPath && !b.criticalPath) return -1;
      if (!a.criticalPath && b.criticalPath) return 1;
      return (a.executionTime || 1) - (b.executionTime || 1);
    });

    for (const node of readyNodes) {
      const dependencies = getNodeDependencies(node.id, nodes);

      // Calculate earliest possible start time based on dependencies
      let earliestStart = 0;
      if (dependencies.length > 0) {
        earliestStart = Math.max(
          ...dependencies.map(depId => {
            const depCompletionTime = completionTimes[depId] || 0;
            const transferTime = findTransferTime(depId, node.id);
            return depCompletionTime + transferTime;
          })
        );
      }

      let workerId: string;
      let workerAvailableTime: number;

      if (node.criticalPath && criticalPathWorker) {
        // Critical path task: always use critical path worker
        workerId = criticalPathWorkerId!;
        workerAvailableTime = workerAvailability[criticalPathWorkerId!] || 0;
        console.log(`Critical path task ${node.name} assigned to ${criticalPathWorkerId}`);
      } else {
        // Non-critical path task: check if we can use critical path worker without delaying ANY critical path tasks

        // Find all unprocessed critical path tasks
        const unprocessedCriticalTasks = nodesToProcess.filter(
          n => n.criticalPath && n.id !== node.id
        );

        // Calculate when the next critical path task could be ready
        let nextCriticalTaskEarliestStart = Infinity;
        for (const criticalTask of unprocessedCriticalTasks) {
          const criticalDeps = getNodeDependencies(criticalTask.id, nodes);
          const allDepsProcessed = criticalDeps.every(depId => processedNodes.has(depId));

          if (allDepsProcessed) {
            // This critical task is ready now or soon
            let criticalEarliestStart = 0;
            if (criticalDeps.length > 0) {
              criticalEarliestStart = Math.max(
                ...criticalDeps.map(depId => {
                  const depCompletionTime = completionTimes[depId] || 0;
                  const transferTime = findTransferTime(depId, criticalTask.id);
                  return depCompletionTime + transferTime;
                })
              );
            }
            nextCriticalTaskEarliestStart = Math.min(
              nextCriticalTaskEarliestStart,
              criticalEarliestStart
            );
          }
        }

        const criticalPathWorkerTime = criticalPathWorker
          ? workerAvailability[criticalPathWorkerId!] || 0
          : Infinity;

        // Find the earliest available non-critical worker
        const availableWorkers = Object.entries(workerAvailability).sort(
          ([, timeA], [, timeB]) => timeA - timeB
        );

        if (availableWorkers.length === 0) {
          console.error('No workers available!');
          continue;
        }

        const nonCriticalWorkers = availableWorkers.filter(([id]) =>
          criticalPathWorker ? id !== criticalPathWorkerId : true
        );

        let bestNonCriticalWorkerTime = Infinity;
        let bestNonCriticalWorkerId: string | null = null;

        if (nonCriticalWorkers.length > 0) {
          [bestNonCriticalWorkerId, bestNonCriticalWorkerTime] = nonCriticalWorkers[0];
        }

        // Calculate actual start times for both options
        const startTimeWithCriticalWorker = Math.max(earliestStart, criticalPathWorkerTime);
        const taskDuration = node.executionTime || 0;
        const completionTimeWithCriticalWorker = startTimeWithCriticalWorker + taskDuration;

        const startTimeWithNonCriticalWorker = bestNonCriticalWorkerId
          ? Math.max(earliestStart, bestNonCriticalWorkerTime)
          : Infinity;

        // Check if using critical path worker would delay any critical path tasks
        const wouldDelayCriticalPath =
          criticalPathWorker &&
          nextCriticalTaskEarliestStart !== Infinity &&
          completionTimeWithCriticalWorker > nextCriticalTaskEarliestStart;

        // Use critical path worker ONLY if:
        // 1. It exists
        // 2. It doesn't delay this task compared to other workers
        // 3. It won't delay any future critical path tasks
        // 4. Either it's faster OR there are no other workers AND it won't block critical tasks
        if (
          criticalPathWorker &&
          !wouldDelayCriticalPath &&
          startTimeWithCriticalWorker <= startTimeWithNonCriticalWorker
        ) {
          workerId = criticalPathWorkerId!;
          workerAvailableTime = criticalPathWorkerTime;

          if (startTimeWithCriticalWorker < startTimeWithNonCriticalWorker) {
            console.log(
              `Non-critical task ${node.name} using critical path worker (faster: ${startTimeWithCriticalWorker}s vs ${startTimeWithNonCriticalWorker}s, safe from critical tasks)`
            );
          } else {
            console.log(
              `Non-critical task ${node.name} using critical path worker (same start time: ${startTimeWithCriticalWorker}s, safe from critical tasks)`
            );
          }
        } else {
          // Use the best non-critical worker, or fail if none available
          if (bestNonCriticalWorkerId) {
            workerId = bestNonCriticalWorkerId;
            workerAvailableTime = bestNonCriticalWorkerTime;
            if (wouldDelayCriticalPath) {
              console.log(
                `Non-critical task ${node.name} using worker ${workerId} (would delay critical task at ${nextCriticalTaskEarliestStart}s if using critical worker)`
              );
            } else {
              console.log(
                `Non-critical task ${node.name} using worker ${workerId} (avoids using critical worker: ${startTimeWithNonCriticalWorker}s vs ${startTimeWithCriticalWorker}s)`
              );
            }
          } else {
            console.error(
              `Cannot schedule non-critical task ${node.name}: no non-critical workers available and using critical worker would delay critical tasks`
            );
            continue;
          }
        }
      }

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
      workerAvailability[workerId] = completionTime;

      const index = nodesToProcess.findIndex(n => n.id === node.id);
      if (index > -1) {
        nodesToProcess.splice(index, 1);
      }

      const criticalPathIndicator = node.criticalPath ? ' (Critical Path)' : '';
      console.log(
        `Scheduled task ${node.name} (${node.id}) on worker ${workerId}: ${actualStartTime}s - ${completionTime}s${criticalPathIndicator}`
      );
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

  return scheduledTasks;
}
