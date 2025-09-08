// Workflow Types
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
  transferAmount?: number;
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

// Argo Workflow Types
export interface ArgoTask {
  name: string;
  dependencies?: string[];
  template: string;
}

export interface ArgoTemplate {
  name: string;
  container?: {
    args?: string[];
  };
  nodeSelector?: Record<string, string>;
  metadata?: {
    annotations?: Record<string, string>;
    labels?: Record<string, string>;
  };
}

export interface ArgoWorkflow {
  metadata?: {
    annotations?: Record<string, string>;
    labels?: Record<string, string>;
  };
  spec: {
    templates: ArgoTemplate[];
  };
}

// Component Props Types
export interface EventHandlers {
  onNodeClick?: (node: WorkflowNode) => void;
  onWorkflowStart?: () => void;
  onWorkflowComplete?: () => void;
  onWorkflowReset?: () => void;
}

export interface VisualWorkflowProps {
  nodes?: WorkflowNode[];
  selectedNodeId?: string | null;
  eventHandlers?: EventHandlers;
  showGrid?: boolean;
  enableSimulation?: boolean;
}