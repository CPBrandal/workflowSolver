import type { Workflow, WorkflowNode } from '../../types';
import { analyzeCriticalPath } from '../../utils/criticalPathAnalyzer';

/**
 * Generates subset values for ODP-IP algorithm.
 * Returns an array where index i contains the value of the subset
 * represented by the binary encoding of i.
 * 
 * Example for 4 nodes: index 5 = binary 0101 = {node0, node2}
 */
export function createSubsetValues(workflow: Workflow) {
  for(const task of workflow.tasks) {
    task.executionTime = getExpectedExecutionTime(task);
  }
  const cpmResult = analyzeCriticalPath(workflow.tasks);

  workflow.tasks = workflow.tasks.map(task => ({
    ...task,
    criticalPath: cpmResult.orderedCriticalPath.some(n => n.id === task.id),
  }));

  const criticalPathDuration = cpmResult.criticalPathDuration;
  console.log(criticalPathDuration);

  const nodes = workflow.tasks.filter(task => !task.criticalPath);
  const n = nodes.length;
  const numSubsets = Math.pow(2, n);
  
  const values: number[] = new Array(numSubsets);
  
  // Generate value for each subset based on bitmask
  for (let mask = 0; mask < numSubsets; mask++) {
    const subset = maskToSubset(mask, nodes);
    values[mask] = calculateSubsetValue(subset, criticalPathDuration);
  }
  
  return {values, criticalPathDuration};
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
      mask |= (1 << index);
    }
  }
  return mask;
}

/**
 * Get the expected execution time from gamma distribution.
 * Mean of Gamma(shape, scale) = shape × scale
 */
function getExpectedExecutionTime(node: WorkflowNode): number {
  const gamma = node.gammaDistribution;
  if (gamma) {
    return gamma.shape * gamma.scale;
  }
  // Fallback to fixed execution time if no gamma params
  return node.executionTime ?? 0;
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

/**
 * Calculate the value for a subset of nodes.
 * 
 * The value represents how "good" this subset is as a coalition (tasks on one worker).
 * Higher value = better.
 * 
 * Logic:
 * - If subsetTime ≤ criticalPath: Value = subsetTime (more work = better utilization)
 * - If subsetTime > criticalPath: Value = 0 (exceeds limit, need more workers)
 * 
 * This rewards filling a worker's time as close to the critical path as possible,
 * but any subset that exceeds the critical path is worthless (would increase makespan).
 */
function calculateSubsetValue(subset: WorkflowNode[], criticalPathDuration: number): number {
  if (subset.length === 0) {
    return 0;
  }

  const subsetTime = calculateSubsetExecutionTime(subset);
  
  // If we exceed critical path, this subset is not viable for one worker
  if (subsetTime > criticalPathDuration) {
    return 0;
  }
  
  // Otherwise, value = execution time (higher = better utilization)
  return Math.round(subsetTime * 100) / 100; // Round to 2 decimal places
}

/**
 * Export subset values to a .txt file in ODP-IP format.
 * Format: space-separated values on a single line.
 */
export function exportSubsetValuesToFile(values: number[], filename = 'subset-values.txt'): void {
  const content = values.join(' ');
  
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
    const subsetNames = subset.length > 0 
      ? `{${subset.map(n => n.name).join(', ')}}` 
      : '{}';
    const execTime = calculateSubsetExecutionTime(subset);
    lines.push(
      `[${mask}] ${binary} = ${subsetNames}\n` +
      `    Exec time: ${execTime.toFixed(2)}, Value: ${values[mask]}`
    );
  }
  
  return lines.join('\n');
}
