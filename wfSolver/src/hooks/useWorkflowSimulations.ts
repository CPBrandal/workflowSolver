import { useCallback, useEffect, useState } from 'react';
import type { ScheduledTask, UseWorkflowSimulationProps, Worker, WorkflowNode } from '../types';
import { getNodeDependencies } from '../utils/getNodeDependencies';

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

  // Resource-constrained scheduling algorithm
  const scheduleWithWorkerConstraints = useCallback((nodes: WorkflowNode[], workers: Worker[]) => {
    const scheduledTasks: ScheduledTask[] = [];
    const completionTimes: { [nodeId: string]: number } = {};
    const processedNodes = new Set<string>();
    const nodesToProcess = [...nodes];

    // Track when each worker becomes available
    const workerAvailability: { [workerId: string]: number } = {};
    workers.forEach(worker => {
      workerAvailability[worker.id] = 0; // All workers available at time 0
    });

    // Find the dedicated critical path worker
    const criticalPathWorker = workers.find(worker => worker.criticalPathWorker);
    const criticalPathWorkerId = criticalPathWorker?.id;

    if (!criticalPathWorker) {
      console.warn('No critical path worker found! Falling back to regular scheduling.');
    } else {
      console.log(`Using ${criticalPathWorkerId} as dedicated critical path worker`);
    }

    while (nodesToProcess.length > 0) {
      // Find nodes that have all dependencies completed
      const readyNodes = nodesToProcess.filter(node => {
        const dependencies = getNodeDependencies(node.id, nodes);
        return dependencies.every(depId => processedNodes.has(depId));
      });

      if (readyNodes.length === 0) {
        console.warn(
          'No ready nodes found, but nodes remain unprocessed. Possible circular dependency.'
        );
        break;
      }

      readyNodes.sort((a, b) => {
        // Critical path tasks get highest priority
        if (a.criticalPath && !b.criticalPath) return -1;
        if (!a.criticalPath && b.criticalPath) return 1;

        return (a.executionTime || 1) - (b.executionTime || 1);
      });

      for (const node of readyNodes) {
        const dependencies = getNodeDependencies(node.id, nodes);

        let earliestStart = 0;
        if (dependencies.length > 0) {
          earliestStart = Math.max(
            ...dependencies.map(depId => {
              const depCompletionTime = completionTimes[depId] || 0;
              const transferTime = findTransferTime(depId, node.id);
              return depCompletionTime + transferTime;
            })
          );
        }

        let workerId: string;
        let workerAvailableTime: number;

        if (node.criticalPath && criticalPathWorker) {
          workerId = criticalPathWorkerId!;
          workerAvailableTime = workerAvailability[criticalPathWorkerId!] || 0;
          console.log(`Critical path task ${node.name} assigned to ${criticalPathWorkerId}`);
        } else {
          const availableWorkers = Object.entries(workerAvailability).sort(
            ([, timeA], [, timeB]) => timeA - timeB
          );

          if (availableWorkers.length === 0) {
            console.error('No workers available!');
            continue;
          }

          // Try to use workers other than the critical path worker first
          const nonCriticalWorkers = availableWorkers.filter(([id]) =>
            criticalPathWorker ? id !== criticalPathWorkerId : true
          );

          if (nonCriticalWorkers.length > 0) {
            [workerId, workerAvailableTime] = nonCriticalWorkers[0];
          } else {
            // If only critical path worker is available, use it
            [workerId, workerAvailableTime] = availableWorkers[0];
          }

          // Log if we're using the critical path worker for a non-critical task
          if (criticalPathWorker && workerId === criticalPathWorkerId) {
            console.log(
              `Non-critical task ${node.name} using critical path worker (no other workers available)`
            );
          }
        }
        const actualStartTime = Math.max(earliestStart, workerAvailableTime);
        const taskDuration = node.executionTime || 1;
        const completionTime = actualStartTime + taskDuration;

        // Schedule the task
        const scheduledTask: ScheduledTask = {
          nodeId: node.id,
          startTime: actualStartTime,
          endTime: completionTime,
          workerId: workerId,
        };

        scheduledTasks.push(scheduledTask);
        completionTimes[node.id] = completionTime;
        processedNodes.add(node.id);

        // Update worker availability
        workerAvailability[workerId] = completionTime;

        // Remove from processing queue
        const index = nodesToProcess.findIndex(n => n.id === node.id);
        if (index > -1) {
          nodesToProcess.splice(index, 1);
        }

        const criticalPathIndicator = node.criticalPath ? ' (Critical Path)' : '';
        console.log(
          `Scheduled task ${node.name} (${node.id}) on worker ${workerId}: ${actualStartTime}s - ${completionTime}s${criticalPathIndicator}`
        );
      }
    }

    console.log('=== Final Schedule ===');
    scheduledTasks.forEach(task => {
      const node = nodes.find(n => n.id === task.nodeId);
      const criticalPathIndicator = node?.criticalPath ? ' (Critical Path)' : '';
      console.log(
        `${node?.name}: ${task.startTime}s - ${task.endTime}s (Worker: ${task.workerId})${criticalPathIndicator}`
      );
    });

    return scheduledTasks;
  }, []);

  function findTransferTime(sourceNodeId: string, targetNodeId: string): number {
    const sourceNode = nodes.find(n => n.id === sourceNodeId);
    if (!sourceNode) return 0;
    const connection = sourceNode.connections.find(conn => conn.targetNodeId === targetNodeId);
    return connection ? connection.transferTime : 0;
  }

  const simulateWorkflow = useCallback(() => {
    resetWorkflow();
    setIsRunning(true);
    setStartTime(Date.now());
    setRuntime(0);

    eventHandlers?.onWorkflowStart?.();

    const activeTimeouts: ReturnType<typeof setTimeout>[] = [];

    // Generate the schedule using resource-constrained scheduling
    const schedule = scheduleWithWorkerConstraints(nodes, workers);

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
  }, [nodes, resetWorkflow, eventHandlers, scheduleWithWorkerConstraints, onWorkersUpdate]);

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
