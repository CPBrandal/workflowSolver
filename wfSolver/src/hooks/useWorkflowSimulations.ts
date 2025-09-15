import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';
import type { WorkflowNode, EventHandlers, Worker } from '../types';
import { getNodeDependencies } from '../utils/getNodeDependencies';

interface UseWorkflowSimulationProps {
  initialNodes: WorkflowNode[];
  eventHandlers?: EventHandlers;
  workers?: Worker[];
  onWorkersUpdate?: Dispatch<SetStateAction<Worker[]>>;
}

interface ScheduledTask {
  nodeId: string;
  startTime: number;
  endTime: number;
  workerId: string;
}

export function useWorkflowSimulation({ 
  initialNodes, 
  eventHandlers, 
  workers = [], 
  onWorkersUpdate 
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
    setNodes(prev => prev.map(node => ({
      ...node,
      status: 'pending',
      assignedWorker: undefined
    })));
    setIsRunning(false);
    setStartTime(null);
    setRuntime(0);
    
    // Reset all workers
    if (workers.length > 0 && onWorkersUpdate) {
      onWorkersUpdate(prevWorkers => prevWorkers.map(w => ({
        ...w,
        time: 0,
        isActive: false,
        currentTask: null
      })));
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

    while (nodesToProcess.length > 0) {
      // Find nodes that have all dependencies completed
      const readyNodes = nodesToProcess.filter(node => {
        const dependencies = getNodeDependencies(node.id, nodes);
        return dependencies.every(depId => processedNodes.has(depId));
      });
      
      if (readyNodes.length === 0) {
        console.warn('No ready nodes found, but nodes remain unprocessed. Possible circular dependency.');
        break;
      }

      // Sort ready nodes by priority (could be enhanced with different strategies)
      // For now, we'll process them in order, but you could prioritize by duration, criticality, etc.
      readyNodes.sort((a, b) => {
        // Simple heuristic: shorter tasks first (or could be longest first for different strategy)
        return (a.duration || 1) - (b.duration || 1);
      });

      for (const node of readyNodes) {
        const dependencies = getNodeDependencies(node.id, nodes);
        
        // Calculate earliest start time based on dependencies
        let earliestStart = 0;
        if (dependencies.length > 0) {
          earliestStart = Math.max(...dependencies.map(depId => completionTimes[depId] || 0));
        }
        
        // Find the earliest available worker
        const availableWorkers = Object.entries(workerAvailability)
          .sort(([, timeA], [, timeB]) => timeA - timeB); // Sort by availability time
        
        if (availableWorkers.length === 0) {
          console.error('No workers available!');
          continue;
        }
        
        const [workerId, workerAvailableTime] = availableWorkers[0];
        
        // The actual start time is the maximum of:
        // 1. When dependencies are complete
        // 2. When the worker becomes available
        const actualStartTime = Math.max(earliestStart, workerAvailableTime);
        const taskDuration = node.duration || 1;
        const completionTime = actualStartTime + taskDuration;
        
        // Schedule the task
        const scheduledTask: ScheduledTask = {
          nodeId: node.id,
          startTime: actualStartTime,
          endTime: completionTime,
          workerId: workerId
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
        
        console.log(`Scheduled task ${node.name} (${node.id}) on worker ${workerId}: ${actualStartTime}s - ${completionTime}s`);
      }
    }
    
    console.log('=== Final Schedule ===');
    scheduledTasks.forEach(task => {
      const node = nodes.find(n => n.id === task.nodeId);
      console.log(`${node?.name}: ${task.startTime}s - ${task.endTime}s (Worker: ${task.workerId})`);
    });
    
    return scheduledTasks;
  }, []);

  const simulateWorkflow = useCallback(() => {
    resetWorkflow();
    setIsRunning(true);
    setStartTime(Date.now());
    setRuntime(0);
    
    eventHandlers?.onWorkflowStart?.();

    const activeTimeouts: ReturnType<typeof setTimeout>[] = [];
    
    // Generate the schedule using resource-constrained scheduling
    const schedule = scheduleWithWorkerConstraints(nodes, workers);
    
    const startNode = (scheduledTask: ScheduledTask) => {
      const timeout = setTimeout(() => {
        // Update task with worker assignment
        setNodes(prev => prev.map(node =>
          node.id === scheduledTask.nodeId ? { 
            ...node, 
            status: 'running',
            assignedWorker: scheduledTask.workerId
          } : node
        ));

        // Update workers state immediately
        if (onWorkersUpdate) {
          onWorkersUpdate(prevWorkers => {
            return prevWorkers.map(w => 
              w.id === scheduledTask.workerId ? {
                ...w,
                isActive: true,
                currentTask: scheduledTask.nodeId
              } : w
            );
          });
        }
        
        console.log(`Started task ${scheduledTask.nodeId} with worker ${scheduledTask.workerId} - Worker is now active`);
      }, scheduledTask.startTime * 1000);
      activeTimeouts.push(timeout);
    };

    const completeNode = (scheduledTask: ScheduledTask) => {
      const timeout = setTimeout(() => {
        // Update node status
        setNodes(prev => {
          const updatedNodes = prev.map(node =>
            node.id === scheduledTask.nodeId ? { 
              ...node, 
              status: 'completed' as WorkflowNode['status'],
              assignedWorker: undefined
            } : node
          );
          
          const allCompleted = updatedNodes.every(n => n.status === 'completed');
          if (allCompleted) {
            setIsRunning(false);
            eventHandlers?.onWorkflowComplete?.();
          }
          
          return updatedNodes;
        });

        // Update workers state immediately
        const taskDuration = scheduledTask.endTime - scheduledTask.startTime;
        if (onWorkersUpdate) {
          onWorkersUpdate(prevWorkers => {
            return prevWorkers.map(w => 
              w.id === scheduledTask.workerId ? {
                ...w,
                time: w.time + taskDuration,
                isActive: false,
                currentTask: null
              } : w
            );
          });
        }
        
        console.log(`Completed task ${scheduledTask.nodeId}, worker ${scheduledTask.workerId} worked for ${taskDuration}s - Worker is now inactive`);
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
    activeWorkers: workers.filter(w => w.isActive).length
  };
}