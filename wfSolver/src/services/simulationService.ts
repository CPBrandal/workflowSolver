import { supabase } from '../lib/supabase';
import type { Worker, Workflow } from '../types';
import type { SimulationRecord, WorkflowStatistics } from '../types/database';

export class SimulationService {
  /**
   * Save a single simulation result
   */
  static async saveSimulation(
    workflowId: string,
    simulationNumber: number,
    actualRuntime: number,
    theoreticalRuntime: number,
    workflow: Workflow,
    workers: Worker[]
  ): Promise<string | null> {
    try {
      // Extract execution times
      const nodeExecutionTimes: Record<string, number> = {};
      workflow.tasks.forEach(node => {
        if (node.executionTime !== undefined) {
          nodeExecutionTimes[node.id] = node.executionTime;
        }
      });

      // Extract transfer times
      const edgeTransferTimes: Record<string, number> = {};
      workflow.tasks.forEach(node => {
        node.connections.forEach(edge => {
          const key = `${edge.sourceNodeId}->${edge.targetNodeId}`;
          edgeTransferTimes[key] = edge.transferTime;
        });
      });

      // Get critical path node IDs
      const criticalPathNodeIds = workflow.criticalPath.map(n => n.id);

      const record: Omit<SimulationRecord, 'id' | 'created_at' | 'efficiency_ratio'> = {
        workflow_id: workflowId,
        simulation_number: simulationNumber,
        actual_runtime: actualRuntime,
        theoretical_runtime: theoreticalRuntime,
        node_execution_times: nodeExecutionTimes,
        edge_transfer_times: edgeTransferTimes,
        workflow_snapshot: workflow,
        workers_final_state: workers,
        critical_path_node_ids: criticalPathNodeIds,
        worker_count: workers.length, // ADD THIS LINE
      };

      const { data, error } = await supabase
        .from('simulations')
        .insert(record)
        .select('id')
        .single();

      if (error) {
        console.error('Error saving simulation:', error);
        return null;
      }

      return data.id;
    } catch (err) {
      console.error('Exception saving simulation:', err);
      return null;
    }
  }

  /**
   * Get all simulations for a workflow
   */
  static async getSimulationsByWorkflow(workflowId: string): Promise<SimulationRecord[]> {
    const { data, error } = await supabase
      .from('simulations')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('simulation_number', { ascending: true });

    if (error) {
      console.error('Error fetching simulations:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get statistics for a workflow
   */
  static async getWorkflowStatistics(workflowId: string): Promise<WorkflowStatistics | null> {
    const { data, error } = await supabase
      .from('workflow_statistics')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (error) {
      console.error('Error fetching statistics:', error);
      return null;
    }

    return data;
  }

  /**
   * Get a specific simulation
   */
  static async getSimulation(id: string): Promise<SimulationRecord | null> {
    const { data, error } = await supabase.from('simulations').select('*').eq('id', id).single();

    if (error) {
      console.error('Error fetching simulation:', error);
      return null;
    }

    return data;
  }

  static async getMaxSimulationNumber(workflowId: string): Promise<number> {
    const { data, error } = await supabase
      .from('simulations')
      .select('simulation_number')
      .eq('workflow_id', workflowId)
      .order('simulation_number', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      // No simulations exist yet
      return 0;
    }

    return data.simulation_number || 0;
  }
}
