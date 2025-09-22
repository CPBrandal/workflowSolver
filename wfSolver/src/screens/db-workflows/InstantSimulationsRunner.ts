import { SimulationService } from '../../services/simulationService';
import type { GammaParams, ScheduledTask, Worker, Workflow } from '../../types';
import {
  analyzeCriticalPath,
  getMinimumProjectDuration,
  setCriticalPathEdgesTransferTimes,
} from '../../utils/criticalPathAnalyzer';
import { gammaSampler } from '../../utils/gammaSampler';
import { scheduleWithWorkerConstraints } from '../../utils/scheduler';

export class InstantSimulationRunner {
  /**
   * Run multiple simulations instantly and save results
   */
  static async runBatchSimulations(
    workflowId: string,
    workflow: Workflow,
    workers: Worker[],
    numberOfSimulations: number,
    gammaParams: GammaParams,
    onProgress?: (current: number, total: number) => void
  ): Promise<string[]> {
    const savedSimulationIds: string[] = [];

    for (let i = 1; i <= numberOfSimulations; i++) {
      // 1. Sample execution times for this simulation
      const simulatedWorkflow = this.sampleExecutionTimes(workflow, gammaParams);

      // 2. Run critical path analysis to get theoretical runtime and mark critical path nodes
      const cpmResult = analyzeCriticalPath(simulatedWorkflow.tasks);
      const theoreticalRuntime = getMinimumProjectDuration(simulatedWorkflow.tasks);

      // 3. Mark nodes that are on the critical path
      simulatedWorkflow.tasks = simulatedWorkflow.tasks.map(task => ({
        ...task,
        criticalPath: cpmResult.orderedCriticalPath.some(n => n.id === task.id),
      }));

      // 4. Store critical path in workflow
      simulatedWorkflow.criticalPath = cpmResult.orderedCriticalPath;
      simulatedWorkflow.criticalPathResult = cpmResult;

      // 5. Set transfer times to 0 on critical path edges (IMPORTANT!)
      setCriticalPathEdgesTransferTimes(simulatedWorkflow.tasks);

      // 6. Calculate the schedule with worker constraints (respects critical path)
      const schedule = scheduleWithWorkerConstraints(simulatedWorkflow.tasks, workers);

      // 7. Calculate actual runtime (may be longer than theoretical due to worker constraints)
      const actualRuntime =
        schedule.length > 0 ? Math.max(...schedule.map(task => task.endTime)) : 0;

      // 8. Simulate final worker states
      const finalWorkers = this.calculateFinalWorkerStates(workers, schedule);

      // 9. Save to database
      const simId = await SimulationService.saveSimulation(
        workflowId,
        i,
        actualRuntime,
        theoreticalRuntime,
        simulatedWorkflow,
        finalWorkers
      );

      if (simId) {
        savedSimulationIds.push(simId);
      }

      // Update progress
      onProgress?.(i, numberOfSimulations);
    }

    return savedSimulationIds;
  }

  /**
   * Sample execution and transfer times from gamma distribution
   */
  private static sampleExecutionTimes(workflow: Workflow, gammaParams: GammaParams): Workflow {
    const sampledWorkflow = JSON.parse(JSON.stringify(workflow)) as Workflow;

    // Create sampler once for efficiency
    const sampler = gammaSampler(gammaParams);

    sampledWorkflow.tasks.forEach(task => {
      // Sample execution time using gamma distribution
      task.executionTime = sampler();

      // Sample transfer times for edges
      task.connections.forEach(edge => {
        edge.transferTime = sampler();
      });
    });

    return sampledWorkflow;
  }

  /**
   * Calculate final worker states after simulation
   */
  private static calculateFinalWorkerStates(
    workers: Worker[],
    schedule: ScheduledTask[]
  ): Worker[] {
    const finalWorkers = workers.map(w => ({ ...w }));

    schedule.forEach(task => {
      const worker = finalWorkers.find(w => w.id === task.workerId);
      if (worker) {
        worker.time += task.endTime - task.startTime;
      }
    });

    return finalWorkers;
  }
}
