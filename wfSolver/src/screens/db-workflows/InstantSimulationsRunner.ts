import { SimulationService } from '../../services/simulationService';
import type { GammaParams, ScheduledTask, Worker, Workflow } from '../../types';
import {
  analyzeCriticalPath,
  getProjectDuration,
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
    onProgress?: (current: number, total: number) => void,
    useTransferTime: boolean = true
  ): Promise<string[]> {
    const maxSimNumber = await SimulationService.getMaxSimulationNumber(workflowId);
    const savedSimulationIds: string[] = [];

    for (let i = 1; i <= numberOfSimulations; i++) {
      const simulationNumber = maxSimNumber + i;

      // 1. Sample execution times (always) and transfer times (conditional)
      const simulatedWorkflow = this.sampleExecutionTimes(workflow, gammaParams, useTransferTime);

      // 2. Find critical path using EXECUTION TIMES ONLY
      // (Critical path tasks run on same worker → no transfer delay)
      const cpmResult = analyzeCriticalPath(simulatedWorkflow.tasks, false);

      // 3. Mark nodes that are on the critical path
      simulatedWorkflow.tasks = simulatedWorkflow.tasks.map(task => ({
        ...task,
        criticalPath: cpmResult.orderedCriticalPath.some(n => n.id === task.id),
      }));

      // 4. Store critical path in workflow
      simulatedWorkflow.criticalPath = cpmResult.orderedCriticalPath;
      simulatedWorkflow.criticalPathResult = cpmResult;

      // 5. Set critical path edge transfer times to 0
      // (Already 0 if useTransferTime=false, but this ensures it)
      setCriticalPathEdgesTransferTimes(simulatedWorkflow.tasks);

      // 6. Calculate theoretical runtime using execution times only
      // (No transfer times on critical path = theoretical minimum)
      const theoreticalRuntime = getProjectDuration(simulatedWorkflow.tasks, false);

      // 7. Schedule with worker constraints
      // Non-critical edges may have transfer times if useTransferTime=true
      const schedule = scheduleWithWorkerConstraints(
        simulatedWorkflow.tasks,
        workers,
        false // Always false because we've already modified the workflow
      );

      // 8. Calculate actual runtime
      const actualRuntime =
        schedule.length > 0 ? Math.max(...schedule.map(task => task.endTime)) : 0;

      // 9. Simulate final worker states
      const finalWorkers = this.calculateFinalWorkerStates(workers, schedule);

      // 10. Save to database
      const simId = await SimulationService.saveSimulation(
        workflowId,
        simulationNumber,
        actualRuntime,
        theoreticalRuntime,
        simulatedWorkflow,
        finalWorkers
      );

      if (simId) {
        savedSimulationIds.push(simId);
      }

      onProgress?.(i, numberOfSimulations);
    }

    return savedSimulationIds;
  }

  // In sampleExecutionTimes (should already be correct):
  private static sampleExecutionTimes(
    workflow: Workflow,
    gammaParams: GammaParams,
    useTransferTime: boolean
  ): Workflow {
    const sampledWorkflow = JSON.parse(JSON.stringify(workflow)) as Workflow;
    const sampler = gammaSampler(gammaParams);

    sampledWorkflow.tasks.forEach(task => {
      // Always sample execution time
      task.executionTime = sampler();

      // Sample transfer times only if enabled
      task.connections.forEach(edge => {
        edge.transferTime = useTransferTime ? sampler() : 0;
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
