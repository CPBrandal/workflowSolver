import { useCallback, useEffect, useState } from 'react';
import type { ScheduledTask, UseWorkflowSimulationProps, WorkflowNode } from '../types';
import { scheduleWithWorkerConstraints } from '../utils/schedulers/scheduler';

export function useWorkflowSimulation({
  initialNodes,
  eventHandlers,
  workers = [],
  onWorkersUpdate,
}: UseWorkflowSimulationProps) {
  const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes);
  const [isRunning, setIsRunning] = useState(false);
  const [runtime, setRuntime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Update nodes when initial nodes change
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes]);

  // Runtime timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isRunning && startTime) {
      interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setRuntime(elapsed);
      }, 10); // Update every 10ms for smoother display
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning, startTime]);

  const resetWorkflow = useCallback(() => {
    setNodes(prev =>
      prev.map(node => ({
        ...node,
        status: 'pending',
        assignedWorker: undefined,
      }))
    );
    setIsRunning(false);
    setStartTime(null);
    setRuntime(0);

    // Reset all workers
    if (workers.length > 0 && onWorkersUpdate) {
      onWorkersUpdate(prevWorkers =>
        prevWorkers.map(w => ({
          ...w,
          time: 0,
          isActive: false,
          currentTask: null,
        }))
      );
    }

    eventHandlers?.onWorkflowReset?.();
  }, [eventHandlers, workers, onWorkersUpdate]);

  const simulateWorkflow = useCallback(() => {
    resetWorkflow();
    setIsRunning(true);
    setStartTime(Date.now());
    setRuntime(0);

    eventHandlers?.onWorkflowStart?.();

    const activeTimeouts: ReturnType<typeof setTimeout>[] = [];

    const schedule = scheduleWithWorkerConstraints(nodes, workers, true);

    const workflowCompletionTime =
      schedule.length > 0 ? Math.max(...schedule.map(task => task.endTime)) : 0;
    console.log(`Total workflow duration (including transfer times): ${workflowCompletionTime}s`);

    const startNode = (scheduledTask: ScheduledTask) => {
      const timeout = setTimeout(() => {
        // Update task with worker assignment
        setNodes(prev =>
          prev.map(node =>
            node.id === scheduledTask.nodeId
              ? {
                  ...node,
                  status: 'running',
                  assignedWorker: scheduledTask.workerId,
                }
              : node
          )
        );

        // Update workers state immediately
        if (onWorkersUpdate) {
          onWorkersUpdate(prevWorkers => {
            return prevWorkers.map(w =>
              w.id === scheduledTask.workerId
                ? {
                    ...w,
                    isActive: true,
                    currentTask: scheduledTask.nodeId,
                  }
                : w
            );
          });
        }

        console.log(
          `Started task ${scheduledTask.nodeId} with worker ${scheduledTask.workerId} - Worker is now active`
        );
      }, scheduledTask.startTime * 1000);
      activeTimeouts.push(timeout);
    };

    const completeNode = (scheduledTask: ScheduledTask) => {
      const timeout = setTimeout(() => {
        // Update node status
        setNodes(prev => {
          const updatedNodes = prev.map(node =>
            node.id === scheduledTask.nodeId
              ? {
                  ...node,
                  status: 'completed' as WorkflowNode['status'],
                  assignedWorker: undefined,
                }
              : node
          );

          const allCompleted = updatedNodes.every(n => n.status === 'completed');
          if (allCompleted) {
            setIsRunning(false);
            setRuntime(workflowCompletionTime * 1000); // Convert to milliseconds
            eventHandlers?.onWorkflowComplete?.();
          }

          return updatedNodes;
        });

        // Update workers state immediately
        const taskDuration = scheduledTask.endTime - scheduledTask.startTime;
        if (onWorkersUpdate) {
          onWorkersUpdate(prevWorkers => {
            return prevWorkers.map(w =>
              w.id === scheduledTask.workerId
                ? {
                    ...w,
                    time: w.time + taskDuration,
                    isActive: false,
                    currentTask: null,
                  }
                : w
            );
          });
        }

        console.log(
          `Completed task ${scheduledTask.nodeId}, worker ${scheduledTask.workerId} worked for ${taskDuration}s - Worker is now inactive`
        );
      }, scheduledTask.endTime * 1000);
      activeTimeouts.push(timeout);
    };

    // Schedule all tasks based on the computed schedule
    schedule.forEach(scheduledTask => {
      startNode(scheduledTask);
      completeNode(scheduledTask);
    });

    // Cleanup function
    return () => {
      activeTimeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [nodes, resetWorkflow, eventHandlers, onWorkersUpdate, workers]);

  return {
    nodes,
    isRunning,
    runtime,
    simulateWorkflow,
    resetWorkflow,
    availableWorkers: workers.filter(w => !w.isActive).length,
    activeWorkers: workers.filter(w => w.isActive).length,
    simulationStartTime: startTime,
  };
}
