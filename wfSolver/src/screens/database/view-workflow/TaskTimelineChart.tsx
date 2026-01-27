import React from 'react';
import type { ScheduledTask, Worker, Workflow } from '../../../types';
import { oneWorkerExecutionTime } from '../../../utils/oneWorkerTime';

interface TaskTimelineChartProps {
  schedule: ScheduledTask[];
  workflow: Workflow;
  workers: Worker[];
}

export function TaskTimelineChart({ schedule, workflow, workers }: TaskTimelineChartProps) {
  const oneWorkerExecutionTimeValue = oneWorkerExecutionTime(workflow);
  if (!schedule || schedule.length === 0) {
    return <div className="p-4 text-center text-gray-500">No schedule data available</div>;
  }

  const maxTime = Math.max(...schedule.map(t => t.endTime));

  // Generate nice time intervals dynamically
  const generateTimeIntervals = (maxTime: number): number[] => {
    const targetIntervals = 8; // Aim for about 8 intervals
    const roughInterval = maxTime / targetIntervals;

    // Find a nice round number for intervals
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughInterval)));
    const normalized = roughInterval / magnitude;

    let niceInterval: number;
    if (normalized <= 1) niceInterval = magnitude;
    else if (normalized <= 2) niceInterval = 2 * magnitude;
    else if (normalized <= 5) niceInterval = 5 * magnitude;
    else niceInterval = 10 * magnitude;

    const intervals: number[] = [];
    for (let i = 0; i * niceInterval <= maxTime; i++) {
      intervals.push(i * niceInterval);
    }
    // Add maxTime if it's not already included and is significantly different
    if (
      intervals[intervals.length - 1] < maxTime &&
      maxTime - intervals[intervals.length - 1] > niceInterval * 0.1
    ) {
      intervals.push(maxTime);
    }

    return intervals;
  };

  const timeIntervals = generateTimeIntervals(maxTime);

  // Group tasks by worker
  const workerTasks: { [key: string]: ScheduledTask[] } = {};
  workers.forEach(w => {
    workerTasks[w.id] = [];
  });

  schedule.forEach(task => {
    if (workerTasks[task.workerId]) {
      workerTasks[task.workerId].push(task);
    }
  });

  // Get task name from workflow
  const getTaskName = (nodeId: string): string => {
    const task = workflow?.tasks?.find(t => t.id === nodeId);
    return task?.name || nodeId.substring(0, 8);
  };

  // Get task color based on critical path
  const getTaskColor = (nodeId: string): string => {
    const task = workflow?.tasks?.find(t => t.id === nodeId);
    return task?.criticalPath ? 'bg-red-500' : 'bg-blue-500';
  };

  // Calculate worker efficiency metrics
  const calculateWorkerEfficiency = () => {
    const workerStats: {
      [workerId: string]: {
        totalTaskTime: number;
        efficiency: number;
        taskCount: number;
      };
    } = {};

    workers.forEach(worker => {
      workerStats[worker.id] = {
        totalTaskTime: 0,
        efficiency: 0,
        taskCount: 0,
      };
    });

    // Calculate total task execution time per worker
    schedule.forEach(task => {
      const taskDuration = task.endTime - task.startTime;
      if (workerStats[task.workerId]) {
        workerStats[task.workerId].totalTaskTime += taskDuration;
        workerStats[task.workerId].taskCount += 1;
      }
    });

    // Calculate efficiency (percentage of one-worker execution time)
    Object.keys(workerStats).forEach(workerId => {
      if (oneWorkerExecutionTimeValue > 0) {
        workerStats[workerId].efficiency =
          (workerStats[workerId].totalTaskTime / oneWorkerExecutionTimeValue) * 100;
      }
    });

    return workerStats;
  };

  const workerStats = calculateWorkerEfficiency();
  const totalWorkerTime = Object.values(workerStats).reduce(
    (sum, stat) => sum + stat.totalTaskTime,
    0
  );
  const overallEfficiency =
    oneWorkerExecutionTimeValue > 0 ? (totalWorkerTime / oneWorkerExecutionTimeValue) * 100 : 0;

  const rowHeight = 60;
  const chartHeight = workers.length * rowHeight + 50;

  return (
    <div className="w-full bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-semibold mb-4">Task Execution Timeline</h3>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span>Critical Path</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span>Non-Critical Path</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex" style={{ minWidth: '800px' }}>
          {/* Worker labels column */}
          <div className="flex-shrink-0" style={{ width: '140px' }}>
            <div style={{ height: '50px' }} /> {/* Spacer for time axis */}
            {workers.map(worker => (
              <div
                key={worker.id}
                className="font-medium text-sm flex items-center border-t border-gray-200"
                style={{ height: `${rowHeight}px` }}
              >
                {worker.id}
                {worker.criticalPathWorker && (
                  <span className="ml-2 text-xs text-red-600">(CP)</span>
                )}
              </div>
            ))}
          </div>

          {/* Timeline area */}
          <div className="flex-1 relative" style={{ minWidth: '600px' }}>
            {/* Time axis */}
            <div className="h-12 border-b border-gray-300 relative">
              {timeIntervals.map(time => {
                const position = (time / maxTime) * 100;
                return (
                  <React.Fragment key={time}>
                    {/* Vertical grid line */}
                    <div
                      className="absolute top-0 bottom-0 border-l border-gray-200"
                      style={{ left: `${position}%` }}
                    />
                    {/* Time label */}
                    <div
                      className="absolute text-xs text-gray-600 -translate-x-1/2"
                      style={{ left: `${position}%`, top: '28px' }}
                    >
                      {time.toFixed(1)}s
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Worker rows with tasks */}
            <div className="relative" style={{ height: `${chartHeight - 50}px` }}>
              {workers.map((worker, idx) => {
                const yPos = idx * rowHeight;

                return (
                  <div
                    key={worker.id}
                    className="absolute left-0 right-0 border-t border-gray-200"
                    style={{
                      top: `${yPos}px`,
                      height: `${rowHeight}px`,
                    }}
                  >
                    {/* Tasks for this worker */}
                    {workerTasks[worker.id]?.map((task, taskIdx) => {
                      const startPercent = (task.startTime / maxTime) * 100;
                      const widthPercent = ((task.endTime - task.startTime) / maxTime) * 100;
                      const taskName = getTaskName(task.nodeId);
                      const color = getTaskColor(task.nodeId);

                      return (
                        <div
                          key={taskIdx}
                          className={`absolute ${color} text-white rounded px-2 py-1 text-xs font-medium shadow-md hover:shadow-lg transition-shadow cursor-pointer overflow-hidden`}
                          style={{
                            left: `${startPercent}%`,
                            top: '8px',
                            width: `${widthPercent}%`,
                            height: `${rowHeight - 16}px`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title={`${taskName}\nStart: ${task.startTime.toFixed(2)}s\nEnd: ${task.endTime.toFixed(2)}s\nDuration: ${(task.endTime - task.startTime).toFixed(2)}s`}
                        >
                          <span className="truncate px-1">{taskName}</span>
                        </div>
                      );
                    })}

                    {/* Vertical grid lines extending through this row */}
                    {timeIntervals.map(time => {
                      const position = (time / maxTime) * 100;
                      return (
                        <div
                          key={time}
                          className="absolute top-0 bottom-0 border-l border-gray-100"
                          style={{ left: `${position}%` }}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Summary statistics */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        {/* Basic Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
          <div>
            <span className="font-semibold">Total Runtime:</span> {maxTime.toFixed(2)}s
          </div>
          <div>
            <span className="font-semibold">One-Worker Time:</span>{' '}
            {oneWorkerExecutionTimeValue.toFixed(2)}s
          </div>
          <div>
            <span className="font-semibold">Tasks:</span> {schedule.length}
          </div>
          <div>
            <span className="font-semibold">Workers:</span> {workers.length}
          </div>
        </div>

        {/* Efficiency Metrics */}
        <div className="mt-4">
          <h4 className="font-semibold text-sm mb-3 text-gray-700">Worker Efficiency</h4>

          {/* Worker Efficiency Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Worker</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Tasks</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Time</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Efficiency</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700 min-w-[200px]">
                    Utilization
                  </th>
                </tr>
              </thead>
              <tbody>
                {workers.map(worker => {
                  const stats = workerStats[worker.id];
                  const efficiencyColor =
                    stats.efficiency >= 20
                      ? 'text-green-600'
                      : stats.efficiency >= 10
                        ? 'text-yellow-600'
                        : 'text-red-600';

                  return (
                    <tr key={worker.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2 px-3">
                        <span className="font-medium text-gray-800">{worker.id}</span>
                        {worker.criticalPathWorker && (
                          <span className="ml-2 text-xs text-red-600 font-semibold">(CP)</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-600">{stats.taskCount}</td>
                      <td className="py-2 px-3 text-right text-gray-600">
                        {stats.totalTaskTime.toFixed(2)}s
                      </td>
                      <td className={`py-2 px-3 text-right font-semibold ${efficiencyColor}`}>
                        {stats.efficiency.toFixed(1)}%
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                stats.efficiency >= 20
                                  ? 'bg-green-500'
                                  : stats.efficiency >= 10
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(100, stats.efficiency)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Overall Summary */}
          <div className="mt-4 pt-4 border-t border-gray-300">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-gray-700">Total Work Scheduled: </span>
                <span className="text-sm font-bold text-gray-700">
                  {overallEfficiency.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-500 ml-1">
                  ({totalWorkerTime.toFixed(2)}s of {oneWorkerExecutionTimeValue.toFixed(2)}s
                  one-worker time)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskTimelineChart;
