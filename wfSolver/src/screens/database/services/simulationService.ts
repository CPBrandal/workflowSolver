import type { SchedulingAlgorithm } from '../../../constants/constants';
import { supabase } from '../../../lib/supabase';
import type { Worker, Workflow } from '../../../types';
import type { SimulationRecord, WorkflowStatistics } from '../../../types/database';

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
    workers: Worker[],
    originalEdgeTransferTimes: Record<string, number>,
    algorithm: SchedulingAlgorithm
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
        original_edge_transfer_times: originalEdgeTransferTimes,
        workers_final_state: workers,
        critical_path_node_ids: criticalPathNodeIds,
        worker_count: workers.length,
        algorithm: algorithm.toLowerCase(),
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

  static async getNumberOfSimulationsForWorkflow(workflowId: string): Promise<number> {
    const { count, error } = await supabase
      .from('simulations')
      .select('*', { count: 'exact', head: true })
      .eq('workflow_id', workflowId);

    if (error) {
      console.error('Error counting simulations:', error);
      return 0;
    }

    return count || 0;
  }

  static async getSimulationsByWorkflowAndWorkerCount(
    workflowId: string,
    numberOfWorkers: number
  ): Promise<SimulationRecord[]> {
    const { data, error } = await supabase
      .from('simulations')
      .select('*')
      .match({ workflow_id: workflowId, worker_count: numberOfWorkers })
      .order('simulation_number', { ascending: true })
      .limit(2000);

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

  static async deleteSimulationsByWorkflow(workflowId: string): Promise<{
    success: boolean;
    deletedCount: number;
    error?: string;
  }> {
    try {
      // First, get the count of simulations to be deleted
      const { count: simulationCount, error: countError } = await supabase
        .from('simulations')
        .select('*', { count: 'exact', head: true })
        .eq('workflow_id', workflowId);

      if (countError) {
        console.error('Error counting simulations:', countError);
        return { success: false, deletedCount: 0, error: countError.message };
      }

      // Delete all simulations for the workflow
      const { error: deleteError } = await supabase
        .from('simulations')
        .delete()
        .eq('workflow_id', workflowId);

      if (deleteError) {
        console.error('Error deleting simulations:', deleteError);
        return { success: false, deletedCount: 0, error: deleteError.message };
      }

      console.log(
        `Successfully deleted ${simulationCount || 0} simulations for workflow ${workflowId}`
      );
      return { success: true, deletedCount: simulationCount || 0 };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Exception deleting simulations:', err);
      return { success: false, deletedCount: 0, error: errorMessage };
    }
  }
}
