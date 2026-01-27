import { solveODPIP, type ODPIPResult } from '../../../services/odpipService';
import type { Worker, Workflow } from '../../../types';
import { createSubsetValues } from '../../ODPIP/createPartitionValues';
import { SimulationService } from '../services/simulationService';
import { runOdpip } from './RunOdpip';

export class OdpipRunSimulations {
  static async runODPIP(
    workflow: Workflow,
    numberOfSimulations: number,
    workflowId: string,
    onProgress?: (current: number, total: number) => void,
    useTransferTime: boolean = true
  ): Promise<string[]> {
    const { values } = createSubsetValues(workflow);
    const numOfAgents = Math.log2(values.length);

    let result: ODPIPResult;
    try {
      result = await solveODPIP(numOfAgents, values);
      console.log('ODP-IP result:', result);
    } catch (error) {
      console.error(error);
      throw new Error('Failed to solve ODP-IP');
    }

    const numberOfWorkers = result.partition.length + 1;

    const maxSimNumber = await SimulationService.getMaxSimulationNumber(workflowId);
    const savedSimulationIds: string[] = [];

    for (let i = 1; i <= numberOfSimulations; i++) {
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
        workflow,
        workflowId,
        simulationNumber,
        result.partition,
        workers,
        useTransferTime
      );

      if (simId) {
        savedSimulationIds.push(simId);
      }

      onProgress?.(i, numberOfSimulations);
    }

    return savedSimulationIds;
  }
}
