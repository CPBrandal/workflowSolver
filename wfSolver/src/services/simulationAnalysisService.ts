import type { GammaParams } from '../types';
import type { SimulationRecord } from '../types/database';
import { SimulationService } from './simulationService';

export interface SimulationAnalysis {
  simulations: SimulationRecord[];
  totalSimulations: number;
  avgActualRuntime: number;
  avgTheoreticalRuntime: number;
  avgEfficiency: number;
  bestActualRuntime: number;
  worstActualRuntime: number;
  avgTimeDifference: number;
  efficiencyData: Array<{
    simulationNumber: number;
    actual: number;
    theoretical: number;
    difference: number;
    efficiency: number;
    ratio: number; // r = T / T(-)
  }>;
  ratioStats: {
    mean: number;
    median: number;
    min: number;
    max: number;
    p25: number;
    p75: number;
    p95: number;
    stdDev: number;
  };
  histogramData: Array<{
    binStart: number;
    binEnd: number;
    binMid: number;
    count: number;
    frequency: number;
  }>;
  ecdfData: Array<{
    ratio: number;
    probability: number;
  }>;
  theoreticalValidation: {
    observedMeanT: number;
    theoreticalMeanT: number;
    avgCriticalPathLength: number;
    expectedTaskTime: number;
    percentError: number;
  };
}

export class SimulationAnalysisService {
  static async analyzeWorkflowSimulations(
    workflowId: string,
    gammaParams: GammaParams // Add this parameter
  ): Promise<SimulationAnalysis | null> {
    const simulations = await SimulationService.getSimulationsByWorkflow(workflowId);

    if (!simulations || simulations.length === 0) {
      return null;
    }

    const totalSimulations = simulations.length;
    const avgActualRuntime =
      simulations.reduce((sum, sim) => sum + sim.actual_runtime, 0) / totalSimulations;
    const avgTheoreticalRuntime =
      simulations.reduce((sum, sim) => sum + sim.theoretical_runtime, 0) / totalSimulations;
    const avgEfficiency = avgTheoreticalRuntime / avgActualRuntime;

    const actualRuntimes = simulations.map(s => s.actual_runtime);
    const bestActualRuntime = Math.min(...actualRuntimes);
    const worstActualRuntime = Math.max(...actualRuntimes);

    const avgTimeDifference =
      simulations.reduce((sum, sim) => sum + (sim.actual_runtime - sim.theoretical_runtime), 0) /
      totalSimulations;

    // Create efficiency data with ratio r = T / T(-)
    const efficiencyData = simulations.map(sim => ({
      simulationNumber: sim.simulation_number || 0,
      actual: sim.actual_runtime,
      theoretical: sim.theoretical_runtime,
      difference: sim.actual_runtime - sim.theoretical_runtime,
      efficiency: sim.theoretical_runtime / sim.actual_runtime,
      ratio: sim.actual_runtime / sim.theoretical_runtime, // r = T / T(-)
    }));

    // Calculate ratio statistics
    const ratios = efficiencyData.map(d => d.ratio);
    const sortedRatios = [...ratios].sort((a, b) => a - b);
    const n = ratios.length;
    const ratioMean = ratios.reduce((a, b) => a + b, 0) / n;

    const ratioStats = {
      mean: ratioMean,
      median: sortedRatios[Math.floor(n / 2)],
      min: sortedRatios[0],
      max: sortedRatios[n - 1],
      p25: sortedRatios[Math.floor(n * 0.25)],
      p75: sortedRatios[Math.floor(n * 0.75)],
      p95: sortedRatios[Math.floor(n * 0.95)],
      stdDev: Math.sqrt(ratios.reduce((sum, r) => sum + Math.pow(r - ratioMean, 2), 0) / n),
    };

    // Create histogram
    const histogramData = this.createHistogram(ratios, 30);

    // Create ECDF
    const ecdfData = sortedRatios.map((r, i) => ({
      ratio: r,
      probability: (i + 1) / sortedRatios.length,
    }));

    const expectedTaskTime = gammaParams.shape * gammaParams.scale;
    const observedMeanT =
      simulations.reduce((sum, sim) => sum + sim.theoretical_runtime, 0) / simulations.length;

    const cpLengths = simulations.map(sim => sim.critical_path_node_ids?.length || 0);
    const avgCriticalPathLength = cpLengths.reduce((sum, n) => sum + n, 0) / simulations.length;

    const theoreticalMeanT = expectedTaskTime * avgCriticalPathLength;
    const percentError = (Math.abs(observedMeanT - theoreticalMeanT) / theoreticalMeanT) * 100;

    return {
      simulations,
      totalSimulations,
      avgActualRuntime,
      avgTheoreticalRuntime,
      avgEfficiency,
      bestActualRuntime,
      worstActualRuntime,
      avgTimeDifference,
      efficiencyData,
      ratioStats,
      histogramData,
      ecdfData,
      theoreticalValidation: {
        observedMeanT,
        theoreticalMeanT,
        avgCriticalPathLength,
        expectedTaskTime,
        percentError,
      },
    };
  }

  private static createHistogram(
    ratios: number[],
    binCount: number = 30
  ): Array<{ binStart: number; binEnd: number; binMid: number; count: number; frequency: number }> {
    const min = Math.min(...ratios);
    const max = Math.max(...ratios);

    // Handle case where all values are the same
    if (min === max) {
      return [
        {
          binStart: min,
          binEnd: max,
          binMid: min,
          count: ratios.length,
          frequency: 1.0,
        },
      ];
    }

    const binWidth = (max - min) / binCount;

    const bins = Array(binCount)
      .fill(0)
      .map((_, i) => ({
        binStart: min + i * binWidth,
        binEnd: min + (i + 1) * binWidth,
        binMid: min + i * binWidth + binWidth / 2,
        count: 0,
        frequency: 0,
      }));

    ratios.forEach(r => {
      // Calculate bin index and ensure it's within bounds
      let binIndex = Math.floor((r - min) / binWidth);
      // Handle edge case where r === max
      binIndex = Math.min(binIndex, binCount - 1);
      bins[binIndex].count++;
    });

    bins.forEach(bin => {
      bin.frequency = bin.count / ratios.length;
    });

    return bins;
  }
}
