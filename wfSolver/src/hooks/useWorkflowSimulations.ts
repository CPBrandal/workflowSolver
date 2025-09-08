import { useState, useEffect, useCallback } from 'react';
import type { WorkflowNode, NodeStatus, EventHandlers } from '../types';
import { getNodeDependencies } from '../utils/getNodeDependencies';

interface UseWorkflowSimulationProps {
  initialNodes: WorkflowNode[];
  eventHandlers?: EventHandlers;
}

export function useWorkflowSimulation({ initialNodes, eventHandlers }: UseWorkflowSimulationProps) {
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
      status: 'pending' as NodeStatus
    })));
    setIsRunning(false);
    setStartTime(null);
    setRuntime(0);
    
    eventHandlers?.onWorkflowReset?.();
  }, [eventHandlers]);

  const simulateWorkflow = useCallback(() => {
    resetWorkflow();
    setIsRunning(true);
    setStartTime(Date.now());
    setRuntime(0);
    
    eventHandlers?.onWorkflowStart?.();

    const completionTimes: { [nodeId: string]: number } = {};
    const activeTimeouts: ReturnType<typeof setTimeout>[] = [];
    
    const startNode = (nodeId: string, startTime: number) => {
      const timeout = setTimeout(() => {
        setNodes(prev => prev.map(node =>
          node.id === nodeId ? { ...node, status: 'running' as NodeStatus } : node
        ));
      }, startTime * 1000);
      activeTimeouts.push(timeout);
    };

    const completeNode = (nodeId: string, completionTime: number) => {
      completionTimes[nodeId] = completionTime;
      
      const timeout = setTimeout(() => {
        setNodes(prev => {
          const updatedNodes = prev.map(node =>
            node.id === nodeId ? { ...node, status: 'completed' as NodeStatus } : node
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

    // Calculate timing for all nodes
    const processedNodes = new Set<string>();
    const nodesToProcess = [...nodes];
    
    while (nodesToProcess.length > 0) {
      const readyNodes = nodesToProcess.filter(node => {
        const dependencies = getNodeDependencies(node.id, nodes);
        return dependencies.every(depId => processedNodes.has(depId));
      });
      
      if (readyNodes.length === 0) break;
      
      readyNodes.forEach(node => {
        const dependencies = getNodeDependencies(node.id, nodes);
        
        let earliestStart = 0;
        if (dependencies.length > 0) {
          earliestStart = Math.max(...dependencies.map(depId => completionTimes[depId] || 0));
        }
        
        const nodeStartTime = earliestStart;
        const nodeCompletionTime = earliestStart + (node.duration || 1);
        
        startNode(node.id, nodeStartTime);
        completeNode(node.id, nodeCompletionTime);
        
        completionTimes[node.id] = nodeCompletionTime;
        processedNodes.add(node.id);
        
        const index = nodesToProcess.findIndex(n => n.id === node.id);
        if (index > -1) nodesToProcess.splice(index, 1);
      });
    }

    // Cleanup function
    return () => {
      activeTimeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [nodes, resetWorkflow, eventHandlers]);

  return {
    nodes,
    isRunning,
    runtime,
    simulateWorkflow,
    resetWorkflow
  };
}