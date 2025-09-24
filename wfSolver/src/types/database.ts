import type { ArbitraryWorkflowConfig, GammaParams, Worker, Workflow } from './index';

export interface WorkflowRecord {
  id: string;
  created_at: string;
  topology: Workflow; // Complete Workflow interface (template)
  gamma_params: GammaParams;
  generation_config?: ArbitraryWorkflowConfig;
  node_count: number;
  tags?: string[];
}

export interface SimulationRecord {
  id: string;
  created_at: string;
  workflow_id: string;
  simulation_number?: number;
  actual_runtime: number;
  theoretical_runtime: number;
  node_execution_times: Record<string, number>;
  edge_transfer_times: Record<string, number>;
  original_edge_transfer_times: Record<string, number>;
  workers_final_state?: Worker[];
  efficiency_ratio?: number;
  critical_path_node_ids?: string[];
  worker_count: number;
}

export interface WorkflowStatistics {
  id: string;
  created_at: string;
  node_count: number;
  total_simulations: number;
  avg_actual_runtime: number;
  avg_theoretical_runtime: number;
  avg_efficiency: number;
  best_actual_runtime: number;
  worst_actual_runtime: number;
  runtime_stddev: number;
}
