import type { Workflow } from '../../types';
import { generatePartitions } from '../../utils/generatePartitions';

export function generateWorkflowPartitions(workflow: Workflow) {
  const nonCriticalTasks = workflow.tasks.filter(task => !task.criticalPath);
  return generatePartitions(nonCriticalTasks);
}
