import type { Workflow } from '../types';

export function oneWorkerExecutionTime(workflow: Workflow) {
  if (workflow.tasks.length === 0) {
    return 0;
  }
  let totalTime = 0;
  for (const task of workflow.tasks) {
    totalTime += task.executionTime || 0;
  }
  return totalTime;
}
