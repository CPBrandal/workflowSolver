import type { WorkflowNode } from '../types';

export function getNodeDependencies(nodeId: string, nodes: WorkflowNode[]): string[] {
  return nodes
    .filter(node => node.connections.some(edge => edge.targetNodeId === nodeId))
    .map(node => node.id);
}
