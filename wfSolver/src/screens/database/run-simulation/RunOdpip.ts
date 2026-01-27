import type { ScheduledTask, Worker, Workflow } from '../../../types';
import { analyzeCriticalPath, getProjectDuration } from '../../../utils/criticalPathAnalyzer';
import { gammaSampler } from '../../../utils/gammaSampler';
import { getNodeDependencies } from '../../../utils/getNodeDependencies';
import { SimulationService } from '../services/simulationService';

export async function runOdpip(
  workflow: Workflow,
  workflowId: string,
  simulationNumber: number,
  partition: number[][],
  workers: Worker[],
  useTransferTime: boolean = true
): Promise<string | null> {
  // 1. Sample execution and transfer times from gamma distributions
  const simulatedWorkflow = sampleExecutionTimes(workflow, useTransferTime);

  // 2. Store original edge transfer times before any modifications
  const originalEdgeTransferTimes: Record<string, number> = {};
  simulatedWorkflow.tasks.forEach(node => {
    node.connections.forEach(edge => {
      const key = `${edge.sourceNodeId}->${edge.targetNodeId}`;
      originalEdgeTransferTimes[key] = edge.transferTime;
    });
  });

  // 3. Analyze critical path
  const cpmResult = analyzeCriticalPath(simulatedWorkflow.tasks, true);

  // 4. Mark nodes that are on the critical path
  //   simulatedWorkflow.tasks = simulatedWorkflow.tasks.map(task => ({
  //     ...task,
  //     criticalPath: cpmResult.orderedCriticalPath.some(n => n.id === task.id),
  //   }));

  // 5. Store critical path in workflow
  simulatedWorkflow.criticalPath = cpmResult.orderedCriticalPath;
  simulatedWorkflow.criticalPathResult = cpmResult;

  // 6. Schedule tasks according to the partition
  const schedule = scheduleWithPartition(simulatedWorkflow, partition, workers, useTransferTime);

  // 7. Calculate theoretical runtime (execution times only, no transfer times)
  const theoreticalRuntime = getProjectDuration(simulatedWorkflow.tasks, false);

  // 8. Calculate actual runtime
  const actualRuntime = schedule.length > 0 ? Math.max(...schedule.map(task => task.endTime)) : 0;

  // 9. Calculate final worker states
  const finalWorkers = calculateFinalWorkerStates(workers, schedule);

  // 10. Save to database
  const simId = await SimulationService.saveSimulation(
    workflowId,
    simulationNumber,
    actualRuntime,
    theoreticalRuntime,
    simulatedWorkflow,
    finalWorkers,
    originalEdgeTransferTimes,
    'ODPIP'
  );

  return simId;
}

function sampleExecutionTimes(workflow: Workflow, useTransferTime: boolean): Workflow {
  const sampledWorkflow = JSON.parse(JSON.stringify(workflow)) as Workflow;

  sampledWorkflow.tasks.forEach(task => {
    const executionTimeSampler = gammaSampler(task.gammaDistribution);
    task.executionTime = executionTimeSampler();

    task.connections.forEach(edge => {
      const transferTimeSampler = gammaSampler(edge.gammaDistribution);
      edge.transferTime = useTransferTime ? transferTimeSampler() : 0;
    });
  });

  return sampledWorkflow;
}

function scheduleWithPartition(
  workflow: Workflow,
  partition: number[][],
  workers: Worker[],
  includeTransferTimes: boolean
): ScheduledTask[] {
  const allNodes = workflow.tasks;
  const criticalPathNodes = allNodes.filter(task => task.criticalPath);
  const nonCriticalPathNodes = allNodes.filter(task => !task.criticalPath);

  // Build worker assignments: critical path gets worker 0, each coalition gets subsequent workers
  const workerAssignments: Map<string, string> = new Map();
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

  // Schedule tasks respecting dependencies and transfer times
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

  return scheduledTasks;
}

function calculateFinalWorkerStates(workers: Worker[], schedule: ScheduledTask[]): Worker[] {
  const finalWorkers = workers.map(w => ({ ...w }));

  schedule.forEach(task => {
    const worker = finalWorkers.find(w => w.id === task.workerId);
    if (worker) {
      worker.time += task.endTime - task.startTime;
    }
  });

  return finalWorkers;
}
