import type { SchedulingAlgorithm } from '../../../constants/constants';
import type { ScheduledTask, Worker, Workflow } from '../../../types';
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

  static async getODPIPSimulations({
    workflowId,
  }: {
    workflowId: string;
  }): Promise<SimulationRecord[]> {
    const { data, error } = await ViewWorkflowService.getSimulationsForODPIP({ workflowId });
    if (error)
      throw new Error(
        `Failed to fetch ODPIP simulations for workflow ${workflowId}: ${error.message}`
      );

    return data || [];
  }
  /**
   * Reconstructs a simulation result from a SimulationRecord and base Workflow.
   * If the simulation has stored scheduled_tasks, uses those directly.
   * Otherwise, returns null (caller should run the algorithm to generate schedule).
   */
  static reconstructSimulationResult(
    simulation: SimulationRecord,
    baseWorkflow: Workflow
  ): {
    workflow: Workflow;
    schedule: ScheduledTask[];
    workers: Worker[];
  } | null {
    if (!simulation.scheduled_tasks || simulation.scheduled_tasks.length === 0) {
      return null;
    }

    // Reconstruct workflow with simulation's execution times
    const simulatedWorkflow: Workflow = {
      ...baseWorkflow,
      tasks: baseWorkflow.tasks.map(task => ({
        ...task,
        executionTime: simulation.node_execution_times[task.id] || 0,
        criticalPath: simulation.critical_path_node_ids?.includes(task.id) || false,
        connections: task.connections.map(edge => ({
          ...edge,
          transferTime:
            simulation.edge_transfer_times[`${edge.sourceNodeId}->${edge.targetNodeId}`] || 0,
        })),
      })),
    };

    // Reconstruct workers from stored state or create from worker count
    const workers: Worker[] = simulation.workers_final_state || [];
    if (workers.length === 0) {
      for (let i = 0; i < simulation.worker_count; i++) {
        workers.push({
          id: `worker-${i + 1}`,
          time: 0,
          isActive: false,
          currentTask: null,
          criticalPathWorker: i === 0,
        });
      }
    }

    return {
      workflow: simulatedWorkflow,
      schedule: simulation.scheduled_tasks,
      workers,
    };
  }
}
