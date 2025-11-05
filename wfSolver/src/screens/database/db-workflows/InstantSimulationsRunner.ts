import type { SchedulingAlgorithm } from '../../../constants/constants';
import type { ScheduledTask, Worker, Workflow } from '../../../types';
import {
  analyzeCriticalPath,
  getProjectDuration,
  setCriticalPathEdgesTransferTimes,
} from '../../../utils/criticalPathAnalyzer';
import { gammaSampler } from '../../../utils/gammaSampler';
import { heftScheduleWithWorkerConstraints } from '../../../utils/heft';
import { scheduleWithWorkerConstraints } from '../../../utils/scheduler';
import { SimulationService } from '../services/simulationService';

export class InstantSimulationRunner {
  static async runBatchSimulations(
    workflowId: string,
    workflow: Workflow,
    workers: Worker[],
    numberOfSimulations: number,
    onProgress?: (current: number, total: number) => void,
    useTransferTime: boolean = true,
    algorithm: SchedulingAlgorithm = 'Greedy'
  ): Promise<string[]> {
    const maxSimNumber = await SimulationService.getMaxSimulationNumber(workflowId);
    const savedSimulationIds: string[] = [];

    for (let i = 1; i <= numberOfSimulations; i++) {
      const simulationNumber = maxSimNumber + i;

      const simulatedWorkflow = this.sampleExecutionTimes(workflow, useTransferTime);

      const originalEdgeTransferTimes: Record<string, number> = {};
      simulatedWorkflow.tasks.forEach(node => {
        node.connections.forEach(edge => {
          const key = `${edge.sourceNodeId}->${edge.targetNodeId}`;
          originalEdgeTransferTimes[key] = edge.transferTime;
        });
      });

      // 2. Find critical path using EXECUTION TIMES ONLY
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
      setCriticalPathEdgesTransferTimes(simulatedWorkflow.tasks);

      // 6. Calculate theoretical runtime using execution times only
      const theoreticalRuntime = getProjectDuration(simulatedWorkflow.tasks, false);

      // 7. Schedule with worker constraints
      const schedule =
        algorithm === 'Greedy'
          ? scheduleWithWorkerConstraints(simulatedWorkflow.tasks, workers, useTransferTime)
          : heftScheduleWithWorkerConstraints(simulatedWorkflow.tasks, workers, useTransferTime);

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
        finalWorkers,
        originalEdgeTransferTimes,
        algorithm
      );

      if (simId) {
        savedSimulationIds.push(simId);
      }

      onProgress?.(i, numberOfSimulations);
    }

    return savedSimulationIds;
  }

  // In sampleExecutionTimes (should already be correct):
  private static sampleExecutionTimes(workflow: Workflow, useTransferTime: boolean): Workflow {
    const sampledWorkflow = JSON.parse(JSON.stringify(workflow)) as Workflow;

    sampledWorkflow.tasks.forEach(task => {
      const executionTimeSampler = gammaSampler(task.gammaDistribution);
      // Always sample execution time
      task.executionTime = executionTimeSampler();

      // Sample transfer times only if enabled
      task.connections.forEach(edge => {
        const transferTimeSampler = gammaSampler(edge.gammaDistribution);
        edge.transferTime = useTransferTime ? transferTimeSampler() : 0;
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
