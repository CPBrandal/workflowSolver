import type { WorkflowNode } from "../../../types";

export const getWorkflowProgress = (nodes: WorkflowNode[]): number => {
  const completed = nodes.filter(n => n.status === 'completed').length;
  const total = nodes.length;
  return Math.round((completed / total) * 100);
};