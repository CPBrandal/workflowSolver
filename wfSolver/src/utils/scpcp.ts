import type { ScheduledTask, Worker, WorkflowNode } from '../types';

interface TaskScheduleInfo {
  EST: number;
  EFT: number;
  LFT: number;
  selectedWorker: string | null;
  scheduled: boolean;
}

interface ScheduleResult {
  schedule: ScheduledTask[];
  success: boolean;
}

function getTransferTime(
  sourceNodeId: string,
  targetNodeId: string,
  nodes: WorkflowNode[]
): number {
  const sourceNode = nodes.find(n => n.id === sourceNodeId);
  if (!sourceNode) return 0;
  const connection = sourceNode.connections.find(conn => conn.targetNodeId === targetNodeId);
  return connection ? connection.transferTime : 0;
}

function getPredecessors(nodeId: string, nodes: WorkflowNode[]): string[] {
  return nodes
    .filter(node => node.connections.some(conn => conn.targetNodeId === nodeId))
    .map(node => node.id);
}

function getSuccessors(nodeId: string, nodes: WorkflowNode[]): string[] {
  const node = nodes.find(n => n.id === nodeId);
  return node ? node.connections.map(conn => conn.targetNodeId) : [];
}

function getFastestWorker(workers: Worker[]): Worker {
  return workers[0];
}

function computeEST(
  nodeId: string,
  scheduleInfo: Map<string, TaskScheduleInfo>,
  nodes: WorkflowNode[]
): number {
  const predecessors = getPredecessors(nodeId, nodes);
  if (predecessors.length === 0) return 0;

  return Math.max(
    ...predecessors.map(predId => {
      const predInfo = scheduleInfo.get(predId);
      if (!predInfo) return 0;
      const transferTime = getTransferTime(predId, nodeId, nodes);
      return predInfo.EFT + transferTime;
    })
  );
}

function computeEFT(
  nodeId: string,
  scheduleInfo: Map<string, TaskScheduleInfo>,
  nodes: WorkflowNode[]
): number {
  const node = nodes.find(n => n.id === nodeId);
  const info = scheduleInfo.get(nodeId);
  if (!node || !info) return 0;
  return info.EST + (node.executionTime || 0);
}

function computeLFT(
  nodeId: string,
  scheduleInfo: Map<string, TaskScheduleInfo>,
  nodes: WorkflowNode[],
  deadline: number
): number {
  const successors = getSuccessors(nodeId, nodes);
  if (successors.length === 0) return deadline;

  return Math.min(
    ...successors.map(succId => {
      const succNode = nodes.find(n => n.id === succId);
      const succInfo = scheduleInfo.get(succId);
      if (!succNode || !succInfo) return deadline;
      const transferTime = getTransferTime(nodeId, succId, nodes);
      return succInfo.LFT - (succNode.executionTime || 0) - transferTime;
    })
  );
}

function getCriticalParent(
  nodeId: string,
  scheduleInfo: Map<string, TaskScheduleInfo>,
  nodes: WorkflowNode[]
): string | null {
  const predecessors = getPredecessors(nodeId, nodes).filter(predId => {
    const info = scheduleInfo.get(predId);
    return info && !info.scheduled;
  });

  if (predecessors.length === 0) return null;

  let maxArrivalTime = -1;
  let criticalParent: string | null = null;

  for (const predId of predecessors) {
    const predInfo = scheduleInfo.get(predId);
    if (!predInfo) continue;
    const transferTime = getTransferTime(predId, nodeId, nodes);
    const arrivalTime = predInfo.EST + predInfo.EFT - predInfo.EST + transferTime;

    if (arrivalTime > maxArrivalTime) {
      maxArrivalTime = arrivalTime;
      criticalParent = predId;
    }
  }

  return criticalParent;
}

function scheduleWorkflow(
  nodes: WorkflowNode[],
  workers: Worker[],
  deadline: number
): ScheduleResult {
  const scheduleInfo = new Map<string, TaskScheduleInfo>();

  for (const node of nodes) {
    scheduleInfo.set(node.id, {
      EST: 0,
      EFT: 0,
      LFT: 0,
      selectedWorker: getFastestWorker(workers).id,
      scheduled: false,
    });
  }

  for (const node of nodes) {
    const info = scheduleInfo.get(node.id)!;
    info.EST = computeEST(node.id, scheduleInfo, nodes);
    info.EFT = computeEFT(node.id, scheduleInfo, nodes);
  }

  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    const info = scheduleInfo.get(node.id)!;
    info.LFT = computeLFT(node.id, scheduleInfo, nodes, deadline);
  }

  const exitNodes = nodes.filter(node => node.connections.length === 0);
  if (exitNodes.length === 0) {
    return { schedule: [], success: false };
  }

  const fastestScheduleFeasible = nodes.every(node => {
    const info = scheduleInfo.get(node.id)!;
    return info.EFT <= info.LFT;
  });

  if (!fastestScheduleFeasible) {
    return { schedule: [], success: false };
  }

  for (const exitNode of exitNodes) {
    scheduleInfo.get(exitNode.id)!.scheduled = true;
  }

  for (const exitNode of exitNodes) {
    scheduleParents(exitNode.id, scheduleInfo, nodes, workers);
  }

  const schedule: ScheduledTask[] = [];
  for (const node of nodes) {
    const info = scheduleInfo.get(node.id)!;
    schedule.push({
      nodeId: node.id,
      startTime: info.EST,
      endTime: info.EFT,
      workerId: info.selectedWorker || workers[0].id,
    });
  }
  console.log('Final Schedule Info:', schedule);
  return { schedule, success: true };
}

function scheduleParents(
  nodeId: string,
  scheduleInfo: Map<string, TaskScheduleInfo>,
  nodes: WorkflowNode[],
  workers: Worker[]
): void {
  let currentNode = nodeId;

  while (true) {
    const unscheduledParents = getPredecessors(currentNode, nodes).filter(
      predId => !scheduleInfo.get(predId)?.scheduled
    );

    if (unscheduledParents.length === 0) break;

    const PCP: string[] = [];
    let ti = currentNode;

    while (true) {
      const unscheduledParent = getPredecessors(ti, nodes).find(
        predId => !scheduleInfo.get(predId)?.scheduled
      );

      if (!unscheduledParent) break;

      const criticalParent = getCriticalParent(ti, scheduleInfo, nodes);
      if (!criticalParent) break;

      PCP.unshift(criticalParent);
      ti = criticalParent;
    }

    if (PCP.length === 0) break;

    schedulePath(PCP, scheduleInfo, nodes, workers);

    for (const taskId of PCP) {
      const successors = getSuccessors(taskId, nodes);
      for (const succId of successors) {
        const succInfo = scheduleInfo.get(succId);
        if (succInfo) {
          succInfo.EST = computeEST(succId, scheduleInfo, nodes);
          succInfo.EFT = computeEFT(succId, scheduleInfo, nodes);
        }
      }

      const predecessors = getPredecessors(taskId, nodes);
      for (const predId of predecessors) {
        const predInfo = scheduleInfo.get(predId);
        if (predInfo) {
          predInfo.LFT = computeLFT(
            predId,
            scheduleInfo,
            nodes,
            scheduleInfo.get(currentNode)!.LFT
          );
        }
      }

      scheduleParents(taskId, scheduleInfo, nodes, workers);
    }
  }
}

function schedulePath(
  path: string[],
  scheduleInfo: Map<string, TaskScheduleInfo>,
  nodes: WorkflowNode[],
  workers: Worker[]
): void {
  if (path.length === 0) return;

  const lastTask = path[path.length - 1];
  const lastInfo = scheduleInfo.get(lastTask)!;

  const costMatrix: number[][] = [];

  for (let k = 0; k < path.length; k++) {
    const taskId = path[k];
    const taskNode = nodes.find(n => n.id === taskId)!;
    const taskInfo = scheduleInfo.get(taskId)!;

    costMatrix[k] = [];

    for (let d = Math.floor(taskInfo.EST); d < Math.floor(taskInfo.EFT); d++) {
      costMatrix[k][d] = Infinity;
    }

    for (let t = Math.floor(taskInfo.EFT); t <= Math.floor(taskInfo.LFT); t++) {
      if (k === 0) {
        costMatrix[k][t] = (taskNode.executionTime || 0) * workers[0].costPerHour!;
      } else {
        let minCost = Infinity;
        const prevTaskId = path[k - 1];
        const prevInfo = scheduleInfo.get(prevTaskId)!;

        for (let prevT = Math.floor(prevInfo.EFT); prevT <= Math.floor(prevInfo.LFT); prevT++) {
          if (costMatrix[k - 1][prevT] !== undefined && costMatrix[k - 1][prevT] < Infinity) {
            const cost =
              costMatrix[k - 1][prevT] + (taskNode.executionTime || 0) * workers[0].costPerHour!;
            if (cost < minCost) {
              minCost = cost;
            }
          }
        }
        costMatrix[k][t] = minCost;
      }
    }

    for (let t = Math.floor(taskInfo.LFT) + 1; t <= Math.floor(lastInfo.LFT); t++) {
      costMatrix[k][t] = Infinity;
    }
  }

  let optimalTime = Math.floor(lastInfo.LFT);
  let minCost = Infinity;

  for (let t = Math.floor(lastInfo.EFT); t <= Math.floor(lastInfo.LFT); t++) {
    const lastTaskIdx = path.length - 1;
    if (costMatrix[lastTaskIdx][t] !== undefined && costMatrix[lastTaskIdx][t] < minCost) {
      minCost = costMatrix[lastTaskIdx][t];
      optimalTime = t;
    }
  }

  for (const taskId of path) {
    const info = scheduleInfo.get(taskId)!;
    info.EST = computeEST(taskId, scheduleInfo, nodes);
    info.EFT = computeEFT(taskId, scheduleInfo, nodes);
    info.LFT = optimalTime;
    info.selectedWorker = getFastestWorker(workers).id;
    info.scheduled = true;
  }
}

export { scheduleParents, schedulePath, scheduleWorkflow };
export type { ScheduleResult, TaskScheduleInfo };
