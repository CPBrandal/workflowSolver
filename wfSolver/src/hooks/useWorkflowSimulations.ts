import { useState, useEffect, useCallback } from 'react';
import type { WorkflowNode, EventHandlers, Worker } from '../types';
import { getNodeDependencies } from '../utils/getNodeDependencies';

interface UseWorkflowSimulationProps {
  initialNodes: WorkflowNode[];
  eventHandlers?: EventHandlers;
  workers?: Worker[];
  onWorkersUpdate?: (workers: Worker[]) => void;
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
  const [workerStack, setWorkerStack] = useState<Worker[]>([]);

  // Update nodes when initial nodes change
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes]);

  // Initialize worker stack when workers change
  useEffect(() => {
    if (workers.length > 0) {
      // Create a copy of workers for the stack (reverse for LIFO behavior)
      const availableWorkers = workers
        .filter(w => !w.isActive)
        .map(w => ({ ...w }))
        .reverse();
      setWorkerStack(availableWorkers);
      console.log(`Initialized worker stack with ${availableWorkers.length} available workers`);
    }
  }, [workers]);

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
      const resetWorkers = workers.map(w => ({
        ...w,
        time: 0,
        isActive: false,
        currentTask: null
      }));
      onWorkersUpdate(resetWorkers);
      setWorkerStack(resetWorkers.slice().reverse());
    }
    
    eventHandlers?.onWorkflowReset?.();
  }, [eventHandlers, workers, onWorkersUpdate]);

  const popWorker = useCallback((): Worker | null => {
    if (workerStack.length === 0) {
      console.warn('No available workers in stack!');
      return null;
    }
    
    const worker = workerStack[workerStack.length - 1];
    setWorkerStack(prev => prev.slice(0, -1));
    console.log(`Popped worker ${worker.id} from stack. Remaining: ${workerStack.length - 1}`);
    return worker;
  }, [workerStack]);

  const pushWorker = useCallback((worker: Worker) => {
    setWorkerStack(prev => [...prev, worker]);
    console.log(`Pushed worker ${worker.id} back to stack. Available: ${workerStack.length + 1}`);
  }, [workerStack.length]);

  const simulateWorkflow = useCallback(() => {
    resetWorkflow();
    setIsRunning(true);
    setStartTime(Date.now());
    setRuntime(0);
    
    eventHandlers?.onWorkflowStart?.();

    const completionTimes: { [nodeId: string]: number } = {};
    const activeTimeouts: ReturnType<typeof setTimeout>[] = [];
    const taskWorkerMap: { [nodeId: string]: Worker } = {};
    
    const startNode = (nodeId: string, startTime: number) => {
      const timeout = setTimeout(() => {
        // Assign a worker to this task
        const assignedWorker = popWorker();
        if (!assignedWorker) {
          console.error(`No available worker for task ${nodeId}`);
          return;
        }

        // Update task with worker assignment
        setNodes(prev => prev.map(node =>
          node.id === nodeId ? { 
            ...node, 
            status: 'running',
            assignedWorker: assignedWorker.id
          } : node
        ));

        // Update worker state
        const updatedWorker = {
          ...assignedWorker,
          isActive: true,
          currentTask: nodeId
        };
        taskWorkerMap[nodeId] = updatedWorker;

        // Update workers in parent component - FIXED VERSION
        if (onWorkersUpdate && workers.length > 0) {
          const updatedWorkers = workers.map(w => 
            w.id === assignedWorker.id ? updatedWorker : w
          );
          onWorkersUpdate(updatedWorkers);
        }

        console.log(`Started task ${nodeId} with worker ${assignedWorker.id} at time ${startTime}s`);
      }, startTime * 1000);
      activeTimeouts.push(timeout);
    };

    const completeNode = (nodeId: string, completionTime: number) => {
      completionTimes[nodeId] = completionTime;
      
      const timeout = setTimeout(() => {
        // Get the worker that was assigned to this task
        const assignedWorker = taskWorkerMap[nodeId];
        if (assignedWorker) {
          const nodeStartTime = Object.keys(completionTimes).find(id => id === nodeId);
          const taskStartTime = nodeStartTime ? completionTimes[nodeStartTime] - (assignedWorker.currentTask ? 1 : 0) : 0;
          const taskDuration = completionTime - taskStartTime;
          
          // Update worker with accumulated time and make available
          const updatedWorker = {
            ...assignedWorker,
            time: assignedWorker.time + taskDuration,
            isActive: false,
            currentTask: null
          };

          // Push worker back to stack
          pushWorker(updatedWorker);

          // Update workers in parent component - FIXED VERSION
          if (onWorkersUpdate && workers.length > 0) {
            const updatedWorkers = workers.map(w => 
              w.id === assignedWorker.id ? updatedWorker : w
            );
            onWorkersUpdate(updatedWorkers);
          }

          console.log(`Completed task ${nodeId}, worker ${assignedWorker.id} worked for ${taskDuration}s (total: ${updatedWorker.time}s)`);
        }

        setNodes(prev => {
          const updatedNodes = prev.map(node =>
            node.id === nodeId ? { 
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
      }, completionTime * 1000);
      activeTimeouts.push(timeout);
    };

    // Calculate timing for all nodes using greedy algorithm
    const processedNodes = new Set<string>();
    const nodesToProcess = [...nodes];
    
    let currentTime = 0;
    
    while (nodesToProcess.length > 0) {
      const readyNodes = nodesToProcess.filter(node => {
        const dependencies = getNodeDependencies(node.id, nodes);
        return dependencies.every(depId => processedNodes.has(depId));
      });
      
      if (readyNodes.length === 0) break;
      
      readyNodes.forEach(node => {
        const dependencies = getNodeDependencies(node.id, nodes);
        
        let earliestStart = currentTime;
        if (dependencies.length > 0) {
          earliestStart = Math.max(currentTime, Math.max(...dependencies.map(depId => completionTimes[depId] || 0)));
        }
        
        const nodeStartTime = earliestStart;
        const nodeCompletionTime = earliestStart + (node.duration || 1);
        
        startNode(node.id, nodeStartTime);
        completeNode(node.id, nodeCompletionTime);
        
        completionTimes[node.id] = nodeCompletionTime;
        processedNodes.add(node.id);
        
        const index = nodesToProcess.findIndex(n => n.id === node.id);
        if (index > -1) nodesToProcess.splice(index, 1);
        
        currentTime = Math.max(currentTime, nodeCompletionTime);
      });
    }

    // Cleanup function
    return () => {
      activeTimeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [nodes, resetWorkflow, eventHandlers, popWorker, pushWorker, onWorkersUpdate, workers]);

  return {
    nodes,
    isRunning,
    runtime,
    simulateWorkflow,
    resetWorkflow,
    availableWorkers: workerStack.length,
    activeWorkers: workers.filter(w => w.isActive).length
  };
}