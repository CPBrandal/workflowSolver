import { solveODPIP } from '../../../services/odpipService';
import type { Worker, Workflow } from '../../../types';
import { createSubsetValues2 } from '../../ODPIP/odpipReworked/createPartValue';
import { SimulationService } from '../services/simulationService';
import { runOdpip, sampleExecutionTimes, type CpNodePartition } from './RunOdpip';

export class OdpipRunSimulations {
  static async runODPIP(
    workflow: Workflow,
    numberOfSimulations: number,
    workflowId: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<string[]> {
    const maxSimNumber = await SimulationService.getMaxSimulationNumber(workflowId);
    const savedSimulationIds: string[] = [];

    for (let i = 1; i <= numberOfSimulations; i++) {
      const simulatedWorkflow = sampleExecutionTimes(workflow, true);
      const subsetValuesPerCpNode = createSubsetValues2(simulatedWorkflow);

      const cpNodePartitions: CpNodePartition[] = [];
      for (const entry of subsetValuesPerCpNode) {
        const numOfAgents = Math.log2(entry.values.length);
        try {
          const result = await solveODPIP(numOfAgents, entry.values);
          console.log(`ODP-IP result for CP node ${entry.cpNodeId}:`, result);
          cpNodePartitions.push({
            cpNodeId: entry.cpNodeId,
            partition: result.partition,
            dependencyChain: entry.dependencyChain,
          });
        } catch (error) {
          console.error(error);
          throw new Error(`Failed to solve ODP-IP for CP node ${entry.cpNodeId}`);
        }
      }

      const totalCoalitions = cpNodePartitions.reduce((sum, p) => sum + p.partition.length, 0);
      const numberOfWorkers = totalCoalitions + 1;

      const workers: Worker[] = [];
      for (let w = 0; w < numberOfWorkers; w++) {
        workers.push({
          id: `worker-${w + 1}`,
          time: 0,
          isActive: false,
          currentTask: null,
          criticalPathWorker: w === 0,
        });
      }
      const simulationNumber = maxSimNumber + i;

      const simId = await runOdpip(
        simulatedWorkflow,
        workflowId,
        simulationNumber,
        cpNodePartitions,
        workers
      );

      if (simId) {
        savedSimulationIds.push(simId);
      }

      onProgress?.(i, numberOfSimulations);
    }

    return savedSimulationIds;
  }
}
