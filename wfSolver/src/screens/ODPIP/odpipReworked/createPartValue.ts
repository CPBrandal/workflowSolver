import type { Workflow, WorkflowNode } from '../../../types';
import { analyzeCriticalPath } from '../../../utils/criticalPathAnalyzer';
import { gammaSampler } from '../../../utils/gammaSampler';
import { getNodeDependencies } from '../../../utils/getNodeDependencies';

export const w1 = 1;
export const w2 = 1;

/**
 * Generates subset values for ODP-IP algorithm.
 * Returns an array where index i contains the value of the subset
 * represented by the binary encoding of i.
 *
 * Example for 4 nodes: index 5 = binary 0101 = {node0, node2}
 */
export function createSubsetValues2(workflow: Workflow, alreadyInitialized: boolean = true) {
  const tasks = workflow.tasks.map(task => {
    if (!alreadyInitialized) {
      return {
        ...task,
        executionTime: gammaSampler(task.gammaDistribution)(),
        connections: task.connections.map(edge => ({
          ...edge,
          transferTime: gammaSampler(edge.gammaDistribution)(),
        })),
      };
    }
    return task;
  });

  const cpmResult = analyzeCriticalPath(tasks);

  const processedTasks = tasks.map(task => ({
    ...task,
    criticalPath: cpmResult.orderedCriticalPath.some(n => n.id === task.id),
  }));

  const criticalPathDuration = cpmResult.criticalPathDuration;
  console.log('Expected Critical Path Duration: ', criticalPathDuration);
  console.log('Number of agents: ', processedTasks.length - cpmResult.criticalPath.length);

  const cpDependenciesMap = getCriticalPathExternalDependencies(
    processedTasks,
    cpmResult.orderedCriticalPath
  );

  console.log('CP Dependencies Map: ', cpDependenciesMap);

  const subsetValuesPerCpNode: {
    cpNodeId: string;
    values: number[];
    goalValue: number;
    dependencyChain: WorkflowNode[];
  }[] = [];

  // Track the index of the previous CP node with external dependencies
  let previousCpNodeWithDepsIndex = -1;

  for (const [cpNodeId, dependencyChain] of cpDependenciesMap) {
    const currentCpIndex = cpmResult.orderedCriticalPath.findIndex(n => n.id === cpNodeId);

    // Calculate goal value: sum of exec times of CP nodes from previous entry to this one
    // Example: CP = start → 1 → 2 → 3 → 4 → end, nodes 1 and 3 have external deps
    // For node 1: sum from start (idx 0) to node 1 (exclusive) = exec(start)
    // For node 3: sum from node 1 (idx 1) to node 3 (exclusive) = exec(1) + exec(2)
    let goalValue = 0;
    const startIndex = previousCpNodeWithDepsIndex === -1 ? 0 : previousCpNodeWithDepsIndex;
    for (let i = startIndex; i < currentCpIndex; i++) {
      goalValue += cpmResult.orderedCriticalPath[i].executionTime ?? 0;
    }

    const n = dependencyChain.length;
    const numSubsets = Math.pow(2, n);
    const values: number[] = new Array(numSubsets);

    for (let mask = 0; mask < numSubsets; mask++) {
      const subset = maskToSubset(mask, dependencyChain);
      values[mask] = calculateSubsetValue2(subset, cpNodeId, goalValue);
    }

    subsetValuesPerCpNode.push({
      cpNodeId,
      values,
      goalValue,
      dependencyChain,
    });

    previousCpNodeWithDepsIndex = currentCpIndex;
  }

  return subsetValuesPerCpNode;
}

/**
 * Convert bitmask to actual subset of nodes.
 * Bit i being set means nodes[i] is in the subset.
 */
function maskToSubset(mask: number, nodes: WorkflowNode[]): WorkflowNode[] {
  const subset: WorkflowNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if ((mask & (1 << i)) !== 0) {
      subset.push(nodes[i]);
    }
  }
  return subset;
}

/**
 * Convert a subset back to its bitmask representation.
 */
export function subsetToMask(subset: WorkflowNode[], allNodes: WorkflowNode[]): number {
  let mask = 0;
  for (const node of subset) {
    const index = allNodes.findIndex(n => n.id === node.id);
    if (index !== -1) {
      mask |= 1 << index;
    }
  }
  return mask;
}

/**
 * Calculate the total expected execution time for a subset.
 * This represents the total time a single worker would need to execute all tasks in the subset.
 */
function calculateSubsetExecutionTime(subset: WorkflowNode[]): number {
  let totalTime = 0;
  for (const node of subset) {
    totalTime += node.executionTime ?? 0;
  }
  return totalTime;
}

function calculateSubsetExecutionTime2(subset: WorkflowNode[], cpNodeId: string) {
  let totalTime = 0;
  for (const node of subset) {
    totalTime += node.executionTime ?? 0;
    if (node.connections.some(edge => edge.targetNodeId === cpNodeId)) {
      totalTime += node.connections.find(edge => edge.targetNodeId === cpNodeId)?.transferTime ?? 0;
    }
    if (node.connections.some(edge => edge.sourceNodeId === cpNodeId)) {
      totalTime += node.connections.find(edge => edge.sourceNodeId === cpNodeId)?.transferTime ?? 0;
    }
  }
  return totalTime;
}

function calculateExternalCommunicationTime(subset: WorkflowNode[]) {
  if (subset.length < 2) {
    return 0;
  }
  let totalTime = 0;
  for (const node of subset) {
    for (const edge of node.connections) {
      if (subset.some(n => n.id === edge.targetNodeId)) {
        totalTime += edge.transferTime ?? 0;
      }
    }
  }
  return totalTime;
}

function calculateSubsetValue2(subset: WorkflowNode[], cpNodeId: string, maxValue: number): number {
  if (subset.length === 0) {
    return 0;
  }

  const subsetTime = calculateSubsetExecutionTime2(subset, cpNodeId);
  console.log('Subset Time: ', subsetTime);
  const externalCommunicationTime = calculateExternalCommunicationTime(subset);
  console.log('External Communication Time: ', externalCommunicationTime);
  const alpha = w1 * Math.exp(-Math.pow(subsetTime - maxValue, 2));
  console.log('Alpha: ', alpha);
  const beta = w2 * (1 - Math.exp(-Math.pow(externalCommunicationTime, 2)));
  console.log('Beta: ', beta);
  const totalValue = alpha + beta;
  console.log('Total Value: ', totalValue); // Round to 2 decimal places
  return totalValue;
}

/**
 * Export subset values to a .txt file in ODP-IP format.
 * Format: one value per line.
 */
export function exportSubsetValuesToFile(values: number[], filename = 'subset-values.txt'): void {
  const content = values.join('\n');

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Helper to get a human-readable description of all subsets and their values.
 * Uses pre-computed values to avoid recalculating.
 */
export function getSubsetValuesDescription(
  workflow: Workflow,
  values: number[],
  criticalPathDuration: number
): string {
  const nodes = workflow.tasks.filter(task => !task.criticalPath);

  const lines: string[] = [];
  lines.push(`Critical Path Duration: ${criticalPathDuration.toFixed(2)}`);
  lines.push(`Non-critical tasks: ${nodes.length}`);
  lines.push(`Total subsets: ${values.length}`);
  lines.push('---');

  for (let mask = 0; mask < values.length; mask++) {
    const subset = maskToSubset(mask, nodes);
    const binary = mask.toString(2).padStart(nodes.length, '0');
    const subsetNames = subset.length > 0 ? `{${subset.map(n => n.name).join(', ')}}` : '{}';
    const execTime = calculateSubsetExecutionTime(subset);
    lines.push(
      `[${mask}] ${binary} = ${subsetNames}\n` +
        `    Exec time: ${execTime.toFixed(2)}, Value: ${values[mask]}`
    );
  }

  return lines.join('\n');
}

/**
 * Find non-critical-path dependency chains for each critical path node.
 *
 * For each CP node that depends on non-CP tasks, recursively collects
 * the full chain of non-CP predecessors. CP nodes are processed in
 * ascending level order so that lower-level CP nodes claim their
 * non-CP dependencies first. Each non-CP task is assigned to exactly
 * one CP node (no duplicates across maps).
 */
export function getCriticalPathExternalDependencies(
  allTasks: WorkflowNode[],
  criticalPathNodes: WorkflowNode[]
): Map<string, WorkflowNode[]> {
  const cpIds = new Set(criticalPathNodes.map(n => n.id));
  const cpTasks = [...criticalPathNodes].sort((a, b) => a.level - b.level);

  const assigned = new Set<string>();
  const result = new Map<string, WorkflowNode[]>();

  for (const cpNode of cpTasks) {
    const chain: WorkflowNode[] = [];
    collectNonCpDependencies(cpNode.id, allTasks, cpIds, assigned, chain);

    if (chain.length > 0) {
      result.set(cpNode.id, chain);
    }
  }

  return result;
}

export function getCpNodeEarliestStart(
  cpNodeId: string,
  allTasks: WorkflowNode[],
  criticalPathNodes: WorkflowNode[]
): number {
  const cpIds = new Set(criticalPathNodes.map(n => n.id));
  let total = 0;
  let currentId = cpNodeId;

  while (true) {
    const predecessorIds = getNodeDependencies(currentId, allTasks);
    const cpPredecessor = predecessorIds.find(id => cpIds.has(id));
    if (!cpPredecessor) break;

    const predNode = allTasks.find(t => t.id === cpPredecessor);
    if (!predNode) break;

    total += predNode.executionTime ?? 0;
    currentId = cpPredecessor;
  }

  return total;
}

function collectNonCpDependencies(
  nodeId: string,
  allTasks: WorkflowNode[],
  cpIds: Set<string>,
  assigned: Set<string>,
  chain: WorkflowNode[]
): void {
  const predecessorIds = getNodeDependencies(nodeId, allTasks);

  for (const predId of predecessorIds) {
    if (cpIds.has(predId) || assigned.has(predId)) continue;

    const predNode = allTasks.find(t => t.id === predId);
    if (!predNode) continue;

    assigned.add(predId);
    chain.push(predNode);

    // Recurse further up the non-CP chain
    collectNonCpDependencies(predId, allTasks, cpIds, assigned, chain);
  }
}
