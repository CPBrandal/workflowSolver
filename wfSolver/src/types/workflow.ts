export type NodeStatus = 'pending' | 'running' | 'completed';

export interface WorkflowNode {
  id: string;
  name: string;
  status: NodeStatus;
  x: number;
  y: number;
  connections: string[];
  description?: string;
  duration?: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface NodeConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  condition?: string;
}