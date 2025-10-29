import { supabase } from '../../../lib/supabase';

export class ViewWorkflowService {
  static async getSimulationsByWorkflowAndWorkerCount({
    workflowId,
    numberOfWorkers,
  }: {
    workflowId: string;
    numberOfWorkers: number;
  }) {
    const { data, error } = await supabase
      .from('simulations')
      .select('*')
      .match({ workflow_id: workflowId, worker_count: numberOfWorkers })
      .order('simulation_number', { ascending: true })
      .limit(2000);

    return { data, error };
  }
}
