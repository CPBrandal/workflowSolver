import type { SchedulingAlgorithm } from '../../../constants/constants';
import type { SimulationRecord } from '../../../types/database';
import { ViewWorkflowService } from './ViewWorkflow.service';

export class ViewWorkflowController {
  static async getSimulationsByWorkersAndAlgorithm({
    workflowId,
    numberOfWorkers,
    algorithm,
  }: {
    workflowId: string;
    numberOfWorkers: number;
    algorithm: SchedulingAlgorithm;
  }): Promise<SimulationRecord[]> {
    if (!workflowId || !workflowId.trim())
      throw new Error('Workflow ID is required and cannot be empty');

    if (!numberOfWorkers || numberOfWorkers < 1)
      throw new Error('Number of workers must be at least 1');

    const { data, error } = await ViewWorkflowService.getSimulationsByWorkflowAndWorkerCount({
      workflowId,
      numberOfWorkers,
      algorithm,
    });

    if (error)
      throw new Error(
        `Failed to fetch simulations for workflow ${workflowId} with ${numberOfWorkers} workers: ${error.message}`
      );

    return data || [];
  }
}
