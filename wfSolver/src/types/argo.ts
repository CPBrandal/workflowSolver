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