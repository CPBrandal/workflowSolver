// AlgorithmComparison.controller.ts
import { AlgorithComparisonService } from './AlgorithmComparison.service';

export interface RDistributionPoint {
  workerCount: number;
  p10: number;
  p50: number;
  p90: number;
  spread: number;
  simulationCount: number;
}

export class AlgorithComparisonController {
  static async getRDistributionForWorkersByAlgorithm({
    workflowId,
    workerCounts,
    algorithm,
  }: {
    workflowId: string;
    workerCounts: number[];
    algorithm: string;
  }): Promise<RDistributionPoint[]> {
    if (!workflowId?.trim()) {
      throw new Error('Workflow ID is required');
    }

    if (!workerCounts || workerCounts.length === 0) {
      throw new Error('At least one worker count is required');
    }

    const { data, error } = await AlgorithComparisonService.getRDistributionByWorkflow(
      workflowId,
      workerCounts,
      algorithm
    );

    if (error) {
      throw new Error(`Failed to fetch R distribution: ${error.message}`);
    }

    const result = data ?? [];

    return result.map(row => ({
      workerCount: row.worker_count,
      p10: row.p10_r,
      p50: row.p50_r,
      p90: row.p90_r,
      spread: row.p90_r - row.p10_r,
      simulationCount: row.simulation_count,
    }));
  }
}
