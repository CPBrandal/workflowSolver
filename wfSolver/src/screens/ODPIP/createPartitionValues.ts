import type { Workflow } from '../../types';
import { generateWorkflowPartitions } from './generateWorkflowPartition';

export function createPartitionValues(workflow: Workflow) {
  const partitions = generateWorkflowPartitions(workflow);
  console.log(partitions);
}
