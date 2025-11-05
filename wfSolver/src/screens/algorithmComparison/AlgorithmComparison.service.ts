import { supabase } from '../../lib/supabase';

export class AlgorithComparisonService {
  static async getRDistributionByWorkflowAndWorkerCount(workflowId: string, workerCount: number) {
    const { data, error } = await supabase
      .from('workflow_worker_r_distribution')
      .select('*')
      .match({ workflow_id: workflowId, worker_count: workerCount })
      .single();
    return { data, error };
  }

  // New method to get multiple worker counts at once
  static async getRDistributionByWorkflow(
    workflowId: string,
    workerCounts: number[],
    algorithm: string
  ) {
    const { data, error } = await supabase
      .from('workflow_worker_r_distribution')
      .select('*')
      .eq('workflow_id', workflowId)
      .eq('algorithm', algorithm.toLowerCase())
      .in('worker_count', workerCounts)
      .order('worker_count', { ascending: true });
    return { data, error };
  }
}
