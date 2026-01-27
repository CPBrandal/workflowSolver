import { createSubsetValues } from '../screens/ODPIP/createPartitionValues';
import { solveODPIP } from '../services/odpipService';
import type { ScheduledTask, Worker, Workflow } from '../types';
import { getNodeDependencies } from '../utils/getNodeDependencies';

export async function odpipScheduler(
  workflow: Workflow,
  workers: Worker[],
  includeTransferTimes: boolean = true
) {
  const { values, criticalPathDuration } = createSubsetValues(workflow);
  const numOfAgents = Math.log2(values.length);

  let partition: number[][];
  try {
    const result = await solveODPIP(numOfAgents, values);
    partition = result.partition;
    console.log('ODP-IP result:', result);
  } catch (error) {
    console.error(error);
    throw new Error('Failed to solve ODP-IP');
  }

  const allNodes = workflow.tasks;
  const criticalPathNodes = allNodes.filter(task => task.criticalPath);
  const nonCriticalPathNodes = allNodes.filter(task => !task.criticalPath);

  // Build worker assignments: each coalition gets a worker, plus one for critical path
  const workerAssignments: Map<string, string> = new Map(); // nodeId -> workerId
  let workerIndex = 0;

  // Assign critical path nodes to first worker
  const cpWorkerId = workers[workerIndex]?.id ?? `worker-${workerIndex}`;
  for (const node of criticalPathNodes) {
    workerAssignments.set(node.id, cpWorkerId);
  }
  workerIndex++;

  // Assign each coalition from partition to a worker
  // Partition indices are 1-indexed (agents 1, 2, 3, ...), so subtract 1 for array access
  for (const coalition of partition) {
    const workerId = workers[workerIndex]?.id ?? `worker-${workerIndex}`;
    for (const agentIndex of coalition) {
      const node = nonCriticalPathNodes[agentIndex - 1];
      if (node) {
        workerAssignments.set(node.id, workerId);
      }
    }
    workerIndex++;
  }

  // Now schedule tasks respecting dependencies and transfer times
  const scheduledTasks: ScheduledTask[] = [];
  const completionTimes: Map<string, number> = new Map();
  const processedNodes = new Set<string>();

  function findTransferTime(sourceNodeId: string, targetNodeId: string): number {
    if (!includeTransferTimes) return 0;

    const sourceWorkerId = workerAssignments.get(sourceNodeId);
    const targetWorkerId = workerAssignments.get(targetNodeId);

    // No transfer time if on same worker
    if (sourceWorkerId && targetWorkerId && sourceWorkerId === targetWorkerId) {
      return 0;
    }

    const sourceNode = allNodes.find(n => n.id === sourceNodeId);
    if (!sourceNode) return 0;

    const connection = sourceNode.connections.find(conn => conn.targetNodeId === targetNodeId);
    return connection?.transferTime ?? 0;
  }

  // Schedule nodes in dependency order
  const nodesToProcess = [...allNodes];
  const workerAvailability: Map<string, number> = new Map();

  while (nodesToProcess.length > 0) {
    // Find ready nodes (all dependencies scheduled)
    const readyNodes = nodesToProcess.filter(node => {
      const dependencies = getNodeDependencies(node.id, allNodes);
      return dependencies.every(depId => processedNodes.has(depId));
    });

    if (readyNodes.length === 0) {
      console.error('Cycle detected or missing dependencies');
      break;
    }

    for (const node of readyNodes) {
      const workerId = workerAssignments.get(node.id);
      if (!workerId) {
        console.error(`No worker assigned for node ${node.id}`);
        continue;
      }

      const dependencies = getNodeDependencies(node.id, allNodes);

      // Calculate earliest start based on dependencies + transfer times
      let earliestStart = 0;
      for (const depId of dependencies) {
        const depCompletionTime = completionTimes.get(depId) ?? 0;
        const transferTime = findTransferTime(depId, node.id);
        earliestStart = Math.max(earliestStart, depCompletionTime + transferTime);
      }

      // Also respect worker availability
      const workerAvailableTime = workerAvailability.get(workerId) ?? 0;
      const startTime = Math.max(earliestStart, workerAvailableTime);
      const endTime = startTime + (node.executionTime ?? 0);

      scheduledTasks.push({
        nodeId: node.id,
        startTime,
        endTime,
        workerId,
      });

      completionTimes.set(node.id, endTime);
      workerAvailability.set(workerId, endTime);
      processedNodes.add(node.id);

      // Remove from processing list
      const index = nodesToProcess.findIndex(n => n.id === node.id);
      if (index > -1) {
        nodesToProcess.splice(index, 1);
      }
    }
  }

  console.log('=== ODP-IP Schedule ===');
  console.log(`Critical path duration: ${criticalPathDuration}`);
  console.log(`Workers used: ${workerIndex}`);
  scheduledTasks.forEach(task => {
    const node = allNodes.find(n => n.id === task.nodeId);
    const cpIndicator = node?.criticalPath ? ' (CP)' : '';
    console.log(
      `${node?.name}${cpIndicator}: ${task.startTime}s - ${task.endTime}s (Worker: ${task.workerId})`
    );
  });

  return scheduledTasks;
}
