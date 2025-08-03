export type NodeStatus = 'completed' | 'running' | 'pending' | 'error' | 'paused';
export type NodeType = 'start' | 'process' | 'end' | 'decision' | 'parallel';

export interface WorkflowNode {
  id: string;
  name: string;
  type: NodeType;
  status: NodeStatus;
  x: number;
  y: number;
  connections: string[];
  description?: string;
  duration?: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
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

export interface WorkflowEventHandlers {
  onNodeClick?: (node: WorkflowNode) => void;
  onNodeDoubleClick?: (node: WorkflowNode) => void;
  onNodeHover?: (node: WorkflowNode | null) => void;
  onConnectionClick?: (connection: NodeConnection) => void;
  onCanvasClick?: (position: Position) => void;
}

export interface VisualWorkflowProps {
  workflow?: any;
  nodes?: WorkflowNode[];
  selectedNodeId?: string | null;
  canvasConfig?: any;
  eventHandlers?: WorkflowEventHandlers;
  readonly?: boolean;
  showGrid?: boolean;
  showMinimap?: boolean;
}