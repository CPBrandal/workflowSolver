import type { ScheduledTask, Worker, WorkflowNode } from '../../types';
import { getNodeDependencies } from '../getNodeDependencies';

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

    readyNodes.sort((a, b) => {
      if (a.criticalPath && !b.criticalPath) return -1;
      if (!a.criticalPath && b.criticalPath) return 1;
      return (a.executionTime || 1) - (b.executionTime || 1);
    });

    for (const node of readyNodes) {
      const dependencies = getNodeDependencies(node.id, nodes);

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
        workerId = criticalPathWorkerId!;
        workerAvailableTime = workerAvailability[criticalPathWorkerId!] || 0;
        console.log(`Critical path task ${node.name} assigned to ${criticalPathWorkerId}`);
      } else {
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

        if (nonCriticalWorkers.length > 0) {
          [workerId, workerAvailableTime] = nonCriticalWorkers[0];
        } else {
          [workerId, workerAvailableTime] = availableWorkers[0];
        }

        if (criticalPathWorker && workerId === criticalPathWorkerId) {
          console.log(
            `Non-critical task ${node.name} using critical path worker (no other workers available)`
          );
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
