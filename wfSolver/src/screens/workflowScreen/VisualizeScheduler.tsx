import { useMemo } from 'react';
import type { SchedulingAlgorithm } from '../../constants/constants';
import { cpHeftSchedule } from '../../schedulers/cpHeft2/cpHeft2';
import { initialGreedy } from '../../schedulers/greedy';
import { heftSchedule } from '../../schedulers/heft/heft';
import { cpGreedy } from '../../schedulers/scheduler';
import type { ScheduledTask, Worker, Workflow } from '../../types';
import { TaskTimelineChart } from '../database/db-view-workflow/TaskTimelineChart';

function VisualizeScheduler({
  workflow,
  scheduler,
  workers,
}: {
  workflow: Workflow;
  scheduler: SchedulingAlgorithm;
  workers: Worker[];
}) {
  const { schedule, finalWorkers } = useMemo(() => {
    // Run the selected scheduling algorithm
    const scheduledTasks: ScheduledTask[] =
      scheduler === 'CP_Greedy'
        ? cpGreedy(workflow.tasks, workers)
        : scheduler === 'Greedy'
          ? initialGreedy(workflow.tasks, workers)
          : scheduler === 'CP_HEFT'
            ? cpHeftSchedule(workflow.tasks, workers)
            : heftSchedule(workflow.tasks, workers);

    // Calculate final worker states
    const updatedWorkers = workers.map(w => ({ ...w, time: 0 }));
    scheduledTasks.forEach(task => {
      const worker = updatedWorkers.find(w => w.id === task.workerId);
      if (worker) {
        worker.time += task.endTime - task.startTime;
      }
    });

    return { schedule: scheduledTasks, finalWorkers: updatedWorkers };
  }, [workflow, scheduler, workers]);

  if (!schedule || schedule.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No schedule generated. Check workflow and workers.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-2">
          Algorithm: <span className="text-blue-600">{scheduler}</span>
        </h3>
        <div className="text-sm text-gray-600">
          Makespan: {Math.max(...schedule.map(t => t.endTime)).toFixed(2)}s
        </div>
      </div>
      <TaskTimelineChart schedule={schedule} workflow={workflow} workers={finalWorkers} />
    </div>
  );
}

export default VisualizeScheduler;
