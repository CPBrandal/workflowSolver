import type { Dispatch, SetStateAction } from 'react';

export interface Workflow {
  name: string;
  tasks: WorkflowNode[];
  criticalPath: WorkflowNode[];
  criticalPathResult?: CriticalPathResult;
  info: string;
}

export interface WorkflowNode {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed';
  position: Position;
  connections: Edge[];
  description?: string;
  executionTime?: number;
  level?: number;
  assignedWorker?: string;
  criticalPath: boolean;
}

export interface Worker {
  id: string;
  costPerHour?: number;
  time: number;
  isActive: boolean;
  currentTask: string | null;
  criticalPathWorker: boolean;
  executionHistory?: ExecutionRecord[];
}

export interface ExecutionRecord {
  nodeId: string;
  duration: number;
  startTime: number;
}

export interface Edge {
  sourceNodeId: string;
  targetNodeId: string;
  transferTime: number;
  label?: string;
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
  onWorkersUpdate?: Dispatch<SetStateAction<Worker[]>>;
  cpmAnalysis: CriticalPathResult | null;
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

export interface CriticalPathNode extends WorkflowNode {
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  slack: number;
  isOnCriticalPath: boolean;
}

export interface CriticalPathResult {
  nodes: CriticalPathNode[];
  criticalPath: CriticalPathNode[];
  orderedCriticalPath: CriticalPathNode[];
  minimumProjectDuration: number;
  criticalPathDuration: number;
}

export interface UseWorkflowSimulationProps {
  initialNodes: WorkflowNode[];
  eventHandlers?: EventHandlers;
  workers?: Worker[];
  onWorkersUpdate?: Dispatch<SetStateAction<Worker[]>>;
}

export interface ScheduledTask {
  nodeId: string;
  startTime: number;
  endTime: number;
  workerId: string;
}

export interface GammaParams {
  shape: number;
  scale: number;
}

export interface ArbitraryWorkflowConfig {
  nodeCount: number;

  maxWidth?: number;
  maxDepth?: number;
  edgeProbability?: number;
  maxEdgeSpan?: number;

  singleSink?: boolean;
  densityFactor?: number;

  gammaParams?: GammaParams;
}

export interface DAGGenerationParams {
  nodeCount: number;
  maxWidth: number;
  maxDepth: number;
  edgeProbability: number;
  maxEdgeSpan: number;
  singleSink: boolean;
  densityFactor: number;
  getDuration: () => number;
  getTransferTime: () => number;
}
