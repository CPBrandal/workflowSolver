import type { WorkflowNode } from '../../../types';

export const getNodeDependencies = (nodeId: string, nodes: WorkflowNode[]): string[] => {
  return nodes
    .filter(node => node.connections.includes(nodeId))
    .map(node => node.id);
};