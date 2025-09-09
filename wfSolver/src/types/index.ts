
export interface WorkflowNode {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  x: number;
  y: number;
  connections: string[];
  description?: string;
  duration?: number;
  transferAmount?: number;
  level?: number; // Add level information for better layout
  assignedWorker?: string; // ID of the worker currently processing this task
}

export interface Worker {
  id: string;
  costPerHour?: number;
  time: number; // Total time this worker has been used (in seconds)
  isActive: boolean; // Whether currently processing a task
  currentTask: string | null; // ID of the task currently being processed
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
  workers?: Worker[];
  onWorkersUpdate?: (workers: Worker[]) => void;
}

export interface LocationState {
  file?: File;
  generatedNodes?: WorkflowNode[];
  workflowType?: string;
  nodeCount?: number;
  layout?: string;
  generatorType?: string;
  message?: string;
}