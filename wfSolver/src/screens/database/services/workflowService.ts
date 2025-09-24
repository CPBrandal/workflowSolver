import { supabase } from '../../../lib/supabase';
import type { ArbitraryWorkflowConfig, GammaParams, Workflow } from '../../../types';
import type { WorkflowRecord } from '../../../types/database';

export class WorkflowService {
  /**
   * Save a workflow topology (without execution times)
   */
  static async saveWorkflowTopology(
    workflow: Workflow,
    gammaParams: GammaParams,
    generationConfig?: ArbitraryWorkflowConfig,
    tags?: string[]
  ): Promise<string | null> {
    try {
      // Create template workflow (reset execution-specific data)
      const template: Workflow = {
        name: workflow.name,
        tasks: workflow.tasks.map(node => ({
          ...node,
          status: 'pending',
          executionTime: undefined,
          assignedWorker: undefined,
          criticalPath: false,
          connections: node.connections.map(edge => ({
            ...edge,
            transferTime: 0, // Will be sampled per simulation
          })),
        })),
        criticalPath: [],
        criticalPathResult: undefined,
        info: workflow.info,
      };

      const record = {
        topology: template,
        gamma_params: gammaParams,
        generation_config: generationConfig,
        node_count: workflow.tasks.length,
        tags: tags || [],
      };

      const { data, error } = await supabase.from('workflows').insert(record).select('id').single();

      if (error) {
        console.error('Error saving workflow:', error);
        return null;
      }

      console.log('Workflow topology saved:', data.id);
      return data.id;
    } catch (err) {
      console.error('Exception saving workflow:', err);
      return null;
    }
  }

  /**
   * Get a workflow by ID
   */
  static async getWorkflow(id: string): Promise<WorkflowRecord | null> {
    const { data, error } = await supabase.from('workflows').select('*').eq('id', id).single();

    if (error) {
      console.error('Error fetching workflow:', error);
      return null;
    }

    return data;
  }

  /**
   * Get all workflows
   */
  static async getAllWorkflows(): Promise<WorkflowRecord[]> {
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching workflows:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Delete a workflow (and all its simulations due to CASCADE)
   */
  static async deleteWorkflow(id: string): Promise<boolean> {
    const { error } = await supabase.from('workflows').delete().eq('id', id);

    if (error) {
      console.error('Error deleting workflow:', error);
      return false;
    }

    return true;
  }
}
