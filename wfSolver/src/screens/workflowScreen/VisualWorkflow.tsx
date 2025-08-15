import { useState, useEffect } from 'react';
import { Play, Clock, RefreshCw, } from 'lucide-react';
import { StatusInfo } from './components/StatusInfo';
import type { NodeStatus, WorkflowNode } from '../../types';
import { NodeDetails } from './components/NodeDetails';
import { defaultNodes } from './data/defaultNodes';
import WorkflowProgress from './components/WorkflowProgress';
import { WorkflowConnections } from './utils/WorkflowConnections';
import { formatTime } from '../../utils/formatTime';
import { getNodeDependencies } from './utils/getNodeDependencies';
import { getStatusIcon } from './components/GetStatusIcon';

export interface EventHandlers {
  onNodeClick?: (node: WorkflowNode) => void;
  onWorkflowStart?: () => void;
  onWorkflowComplete?: () => void;
  onWorkflowReset?: () => void;
}

export interface VisualWorkflowProps {
  nodes?: WorkflowNode[];
  selectedNodeId?: string | null;
  eventHandlers?: EventHandlers;
  showGrid?: boolean;
  enableSimulation?: boolean;
}


function VisualWorkflow({ nodes: propNodes, selectedNodeId: propSelectedNodeId, eventHandlers, showGrid = false, enableSimulation = true}: VisualWorkflowProps) {

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(propSelectedNodeId || null);
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>(propNodes || defaultNodes);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runtime, setRuntime] = useState<number>(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (propNodes) {
      setWorkflowNodes(propNodes);
    }
  }, [propNodes]);
  
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (isRunning && startTime) {
      interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setRuntime(elapsed);
      }, 1);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning, startTime]);

  const getNodeClasses = (node: WorkflowNode): string => {
    const baseClasses = "absolute flex flex-col items-center justify-center w-36 h-24 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-lg";
    
    let statusClasses = "";
    switch (node.status) {
      case 'completed':
        statusClasses = "border-green-300 bg-green-100 hover:bg-green-200";
        break;
      case 'running':
        statusClasses = "border-blue-300 bg-blue-100 hover:bg-blue-200 animate-pulse";
        break;
      case 'pending':
        statusClasses = "border-gray-300 bg-gray-100 hover:bg-gray-200";
        break;
      default:
        statusClasses = "border-gray-300 bg-gray-100";
    }

    const selectedClasses = selectedNodeId === node.id ? "ring-4 ring-blue-300" : "";

    return `${baseClasses} ${statusClasses} ${selectedClasses}`;
  };

  const handleNodeClick = (node: WorkflowNode): void => {
    const newSelectedId = selectedNodeId === node.id ? null : node.id;
    setSelectedNodeId(newSelectedId);
    
    if (eventHandlers?.onNodeClick) {
      eventHandlers.onNodeClick(node);
    }
  };

  const simulateWorkflow = (): void => {
    resetWorkflow();
    setIsRunning(true);
    setStartTime(Date.now());
    setRuntime(0); 
    
    if (eventHandlers?.onWorkflowStart) {
      eventHandlers.onWorkflowStart();
    }

    const completionTimes: { [nodeId: string]: number } = {};
    const activeTimeouts: ReturnType<typeof setTimeout>[] = [];
    
    const startNode = (nodeId: string, startTime: number) => {
      const timeout = setTimeout(() => {
        setWorkflowNodes(prev => prev.map(node =>
          node.id === nodeId ? { ...node, status: 'running' as NodeStatus } : node
        ));
      }, startTime * 1000);
      activeTimeouts.push(timeout);
    };

    const completeNode = (nodeId: string, completionTime: number) => {
      completionTimes[nodeId] = completionTime;
      
      const timeout = setTimeout(() => {
        setWorkflowNodes(prev => {
          const updatedNodes = prev.map(node =>
            node.id === nodeId ? { ...node, status: 'completed' as NodeStatus } : node
          );
          
          const allCompleted = updatedNodes.every(n => n.status === 'completed');
          if (allCompleted) {
            setIsRunning(false);
            if (eventHandlers?.onWorkflowComplete) {
              eventHandlers.onWorkflowComplete();
            }
          }
          
          return updatedNodes;
        });
      }, completionTime * 1000);
      activeTimeouts.push(timeout);
    };

    const calculateNodeTiming = () => {
      const processedNodes = new Set<string>();
      const nodesToProcess = [...workflowNodes];
      
      while (nodesToProcess.length > 0) {
        const readyNodes = nodesToProcess.filter(node => {
          const dependencies = getNodeDependencies(node.id, workflowNodes);
          return dependencies.every(depId => processedNodes.has(depId));
        });
        
        if (readyNodes.length === 0) break;
        
        readyNodes.forEach(node => {
          const dependencies = getNodeDependencies(node.id, workflowNodes);
          
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
    };

    calculateNodeTiming();
  };

  const resetWorkflow = (): void => {
    
    setWorkflowNodes(prev => prev.map(node => ({
      ...node,
      status: 'pending' as NodeStatus
    })));
    setIsRunning(false);
    setStartTime(null);
    setRuntime(0); 
    
    if (eventHandlers?.onWorkflowReset) {
      eventHandlers.onWorkflowReset();
    }
  };

  const selectedNode = selectedNodeId ? workflowNodes.find(n => n.id === selectedNodeId) : null;

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Visual Workflow</h2>
        {enableSimulation && (
          <div className="flex gap-2">
            <button
              onClick={simulateWorkflow}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <Play className="w-4 h-4" />
              {isRunning ? 'Running...' : 'Start Workflow'}
            </button>
            <button
              onClick={resetWorkflow}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
          </div>
        )}
      </div>

      {enableSimulation && (
        <WorkflowProgress nodes={workflowNodes}></WorkflowProgress>
      )}
      
      <div className={`relative bg-gray-50 rounded-lg overflow-auto ${showGrid ? 'bg-dot-pattern' : ''}`} style={{ minHeight: '600px', paddingLeft: '200px', paddingRight: '200px', paddingTop: '50px', paddingBottom: '50px' }}>
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto">
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="#6b7280"/>
            </marker>
          </defs>
          {<WorkflowConnections nodes={workflowNodes}></WorkflowConnections>}
        </svg>

        {workflowNodes.map((node: WorkflowNode) => (
          <div
            key={node.id}
            className={getNodeClasses(node)}
            style={{
              left: node.x * 180,
              top: node.y * 120
            }}
            onClick={() => handleNodeClick(node)}
            title={node.description}
          >
            <div className="mb-1">
              {getStatusIcon(node.status)}
            </div>
            <span className="text-sm font-medium text-center px-2 text-gray-800">
              {node.name}
            </span>
            {node.duration && (
              <span className="text-xs text-gray-500 mt-1">
                {node.duration}s
              </span>
            )}
          </div>
        ))}
      </div>

      {selectedNode && (
        <NodeDetails selectedNode={selectedNode} />
      )}

      <StatusInfo />
      
      <div className="mt-6 p-4 bg-gray-100 rounded-lg">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-600" />
          <span className="text-lg font-medium text-gray-800">
            Total runtime: {formatTime(runtime)}
          </span>
          {isRunning && (
            <span className="text-sm text-blue-600 animate-pulse">
              Running
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default VisualWorkflow;