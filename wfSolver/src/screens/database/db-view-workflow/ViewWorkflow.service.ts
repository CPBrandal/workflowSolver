import { supabase } from '../../../lib_backend/lib/supabase';

export class ViewWorkflowService {
  static async getSimulationsByWorkflowAndWorkerCount({
    workflowId,
    numberOfWorkers,
    algorithm,
  }: {
    workflowId: string;
    numberOfWorkers: number;
    algorithm: string;
  }) {
    const { data, error } = await supabase
      .from('simulations')
      .select('*')
      .match({
        workflow_id: workflowId,
        worker_count: numberOfWorkers,
        algorithm: algorithm.toLowerCase(),
      })
      .order('simulation_number', { ascending: true })
      .limit(2000);

    return { data, error };
  }
}
