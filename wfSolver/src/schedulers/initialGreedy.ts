import type { ScheduledTask, Worker, WorkflowNode } from '../utils/../types';
import { getNodeDependencies } from '../utils/getNodeDependencies';

export function initialGreedy(
  nodes: WorkflowNode[],
  workers: Worker[],
  includeTransferTimes: boolean = true
) {
  const scheduledTasks: ScheduledTask[] = [];
  const completionTimes: { [nodeId: string]: number } = {};
  const processedNodes = new Set<string>();
  const nodeToWorker: { [nodeId: string]: string } = {};

  // Track when each worker becomes available
  const workerAvailability: { [workerId: string]: number } = {};
  workers.forEach(worker => {
    workerAvailability[worker.id] = 0;
  });

  // Helper: get transfer time between two nodes on different workers
  function getTransferTime(
    sourceNodeId: string,
    targetNodeId: string,
    sourceWorkerId: string,
    targetWorkerId: string
  ): number {
    if (!includeTransferTimes) return 0;
    if (sourceWorkerId === targetWorkerId) return 0;

    const sourceNode = nodes.find(n => n.id === sourceNodeId);
    if (!sourceNode) return 0;

    const connection = sourceNode.connections.find(conn => conn.targetNodeId === targetNodeId);
    return connection?.transferTime ?? 0;
  }

  // Process nodes until all are scheduled
  const pending = [...nodes];

  while (pending.length > 0) {
    // Find all ready nodes (dependencies satisfied)
    const readyNodes = pending.filter(node => {
      const deps = getNodeDependencies(node.id, nodes);
      return deps.every(depId => processedNodes.has(depId));
    });

    if (readyNodes.length === 0) {
      console.error('Circular dependency detected or missing dependencies');
      break;
    }

    // Sort ready nodes by execution time (shorter first)
    readyNodes.sort((a, b) => (a.executionTime || 0) - (b.executionTime || 0));

    // Schedule each ready node on the best worker
    for (const node of readyNodes) {
      const dependencies = getNodeDependencies(node.id, nodes);

      let bestWorkerId: string | null = null;
      let bestStartTime = Infinity;
      let bestEndTime = Infinity;

      // Try each worker and pick the one with earliest finish time
      for (const worker of workers) {
        const workerId = worker.id;

        // Calculate earliest start based on dependencies + transfer times
        let earliestStart = 0;
        if (dependencies.length > 0) {
          earliestStart = Math.max(
            ...dependencies.map(depId => {
              const depCompletion = completionTimes[depId] || 0;
              const depWorker = nodeToWorker[depId];
              const transfer = getTransferTime(depId, node.id, depWorker, workerId);
              return depCompletion + transfer;
            })
          );
        }

        // Actual start = max of (dependencies ready, worker available)
        const startTime = Math.max(earliestStart, workerAvailability[workerId]);
        const endTime = startTime + (node.executionTime || 0);

        // Pick worker with earliest end time
        if (endTime < bestEndTime) {
          bestWorkerId = workerId;
          bestStartTime = startTime;
          bestEndTime = endTime;
        }
      }

      if (!bestWorkerId) {
        console.error(`No worker available for task ${node.name}`);
        continue;
      }

      // Schedule the task
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

      // Remove from pending
      const index = pending.findIndex(n => n.id === node.id);
      if (index > -1) {
        pending.splice(index, 1);
      }
    }
  }

  return scheduledTasks;
}
