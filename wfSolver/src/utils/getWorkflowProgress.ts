import type { WorkflowNode } from '../types';

export function getWorkflowProgress(nodes: WorkflowNode[]): number {
  if (nodes.length === 0) return 0;

  const completed = nodes.filter(n => n.status === 'completed').length;
  const total = nodes.length;
  return Math.round((completed / total) * 100);
}
