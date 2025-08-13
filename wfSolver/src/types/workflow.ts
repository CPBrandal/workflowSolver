export type NodeStatus = 'pending' | 'running' | 'completed' | 'error' | 'paused';
export type NodeType = 'start' | 'process' | 'end';

export interface WorkflowNode {
  id: string;
  name: string;
  type: NodeType;
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

export interface EventHandlers {
  onNodeClick?: (node: WorkflowNode) => void;
  onNodeDoubleClick?: (node: WorkflowNode) => void;
  onWorkflowStart?: () => void;
  onWorkflowComplete?: () => void;
  onWorkflowReset?: () => void;
}

export interface VisualWorkflowProps {
  nodes?: WorkflowNode[];
  selectedNodeId?: string | null;
  eventHandlers?: EventHandlers;
  readonly?: boolean;
  showGrid?: boolean;
  enableSimulation?: boolean;
  autoStart?: boolean;
}