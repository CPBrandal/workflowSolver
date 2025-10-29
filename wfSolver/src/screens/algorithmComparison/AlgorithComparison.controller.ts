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
  static async getRDistributionForWorkers({
    workflowId,
    workerCounts,
  }: {
    workflowId: string;
    workerCounts: number[];
  }): Promise<RDistributionPoint[]> {
    if (!workflowId?.trim()) {
      throw new Error('Workflow ID is required');
    }

    if (!workerCounts || workerCounts.length === 0) {
      throw new Error('At least one worker count is required');
    }

    const result = await AlgorithComparisonService.getRDistributionByWorkflow(
      workflowId,
      workerCounts
    );

    if (result.error) {
      throw new Error(`Failed to fetch R distribution: ${result.error.message}`);
    }

    const data = result.data ?? [];

    // Transform to chart-friendly format
    return data.map(row => ({
      workerCount: row.worker_count,
      p10: row.p10_r,
      p50: row.p50_r,
      p90: row.p90_r,
      spread: row.p90_r - row.p10_r,
      simulationCount: row.simulation_count,
    }));
  }
}
