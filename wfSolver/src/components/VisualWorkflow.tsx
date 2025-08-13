import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, Clock, AlertCircle, Pause, RefreshCw } from 'lucide-react';
import { StatusInfo } from './StatusInfo';
import type { NodeStatus, WorkflowNode, VisualWorkflowProps } from '../types';
import { NodeDetails } from './NodeDetails';

function VisualWorkflow({
  nodes: propNodes,
  selectedNodeId: propSelectedNodeId,
  eventHandlers,
  readonly = false,
  showGrid = false,
  enableSimulation = true,
  autoStart = false
}: VisualWorkflowProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(propSelectedNodeId || null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const defaultNodes: WorkflowNode[] = [
    {
      id: '1',
      name: 'Start',
      type: 'start',
      status: 'pending',
      x: 2,
      y: 0,
      connections: ['2'],
      description: 'Initialize the workflow process',
      duration: 1
    },
    {
      id: '2',
      name: 'Data Validation',
      type: 'process',
      status: 'pending',
      x: 2,
      y: 1,
      connections: ['3', '4'],
      description: 'Validate incoming data format and integrity',
      duration: 3
    },
    {
      id: '3',
      name: 'Process A',
      type: 'process',
      status: 'pending',
      x: 1,
      y: 2,
      connections: ['5'],
      description: 'Execute primary processing logic',
      duration: 10
    },
    {
      id: '4',
      name: 'Process B',
      type: 'process',
      status: 'pending',
      x: 3,
      y: 2,
      connections: ['5'],
      description: 'Execute secondary processing logic',
      duration: 8
    },
    {
      id: '5',
      name: 'Merge Results',
      type: 'process',
      status: 'pending',
      x: 2,
      y: 3,
      connections: ['6'],
      description: 'Combine results from parallel processes',
      duration: 3
    },
    {
      id: '6',
      name: 'Complete',
      type: 'end',
      status: 'pending',
      x: 2,
      y: 4,
      connections: [],
      description: 'Finalize and cleanup workflow',
      duration: 1
    }
  ];

  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>(propNodes || defaultNodes);

  useEffect(() => {
    if (propNodes) {
      setWorkflowNodes(propNodes);
    }
  }, [propNodes]);

  useEffect(() => {
    if (autoStart && enableSimulation && !readonly) {
      simulateWorkflow();
    }
  }, [autoStart, enableSimulation, readonly]);

  
  const getNodeDependencies = (nodeId: string, nodes: WorkflowNode[]): string[] => {
    return nodes
      .filter(node => node.connections.includes(nodeId))
      .map(node => node.id);
  };

  const getStatusIcon = (status: NodeStatus): React.JSX.Element => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'running':
        return <Play className="w-5 h-5 text-blue-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'paused':
        return <Pause className="w-5 h-5 text-yellow-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

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
      case 'error':
        statusClasses = "border-red-300 bg-red-100 hover:bg-red-200";
        break;
      case 'paused':
        statusClasses = "border-yellow-300 bg-yellow-100 hover:bg-yellow-200";
        break;
      default:
        statusClasses = "border-gray-300 bg-gray-100";
    }

    const typeClasses = (node.type === 'start' || node.type === 'end') ? "rounded-full" : "rounded-lg";
    const selectedClasses = selectedNodeId === node.id ? "ring-4 ring-blue-300" : "";
    const readonlyClasses = readonly ? "cursor-default" : "";

    return `${baseClasses} ${statusClasses} ${typeClasses} ${selectedClasses} ${readonlyClasses}`;
  };

  const renderConnections = (): React.ReactElement[] => {
    const connections: React.ReactElement[] = [];
    
    workflowNodes.forEach((node: WorkflowNode) => {
      node.connections.forEach((targetId: string) => {
        const target = workflowNodes.find((n: WorkflowNode) => n.id === targetId);
        if (target) {
          const startX = (node.x * 180) + 72;
          const startY = (node.y * 120) + 48;
          const endX = (target.x * 180) + 72;
          const endY = (target.y * 120) + 48;

          // Enhanced connection coloring based on status
          let strokeColor = "#6b7280";
          let strokeWidth = "2";
          
          if (node.status === 'completed' && target.status === 'running') {
            strokeColor = "#3b82f6"; //Blue
            strokeWidth = "3";
          } else if (node.status === 'completed') {
            strokeColor = "#10b981"; // Green
            strokeWidth = "3";
          } else if (node.status === 'error') {
            strokeColor = "#ef4444"; // Red
            strokeWidth = "3";
          }

          connections.push(
            <g key={`${node.id}-${targetId}`}>
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                markerEnd="url(#arrowhead)"
                className="transition-all duration-300"
              />
            </g>
          );
        }
      });
    });

    return connections;
  };

  const handleNodeClick = (node: WorkflowNode): void => {
    if (readonly) return;
    
    const newSelectedId = selectedNodeId === node.id ? null : node.id;
    setSelectedNodeId(newSelectedId);
    
    if (eventHandlers?.onNodeClick) {
      eventHandlers.onNodeClick(node);
    }
  };

  const handleNodeDoubleClick = (node: WorkflowNode): void => {
    if (readonly) return;
    
    if (eventHandlers?.onNodeDoubleClick) {
      eventHandlers.onNodeDoubleClick(node);
    }
  };

  const getWorkflowProgress = (): number => {
    const completed = workflowNodes.filter(n => n.status === 'completed').length;
    const total = workflowNodes.length;
    return Math.round((completed / total) * 100);
  };

  const simulateWorkflow = (): void => {
    if (readonly) return;
    
    setIsRunning(true);
    
    if (eventHandlers?.onWorkflowStart) {
      eventHandlers.onWorkflowStart();
    }
    
    // Reset all nodes to pending
    const resetNodes = workflowNodes.map(node => ({
      ...node,
      status: 'pending' as NodeStatus
    }));
    
    setWorkflowNodes(resetNodes);

    // Track completion times and active timeouts
    const completionTimes: { [nodeId: string]: number } = {};
    const activeTimeouts: ReturnType<typeof setTimeout>[] = [];
    
    // Function to start a node
    const startNode = (nodeId: string, startTime: number) => {
      const timeout = setTimeout(() => {
        setWorkflowNodes(prev => prev.map(node =>
          node.id === nodeId ? { ...node, status: 'running' as NodeStatus } : node
        ));
      }, startTime * 1000);
      activeTimeouts.push(timeout);
    };

    // Function to complete a node
    const completeNode = (nodeId: string, completionTime: number) => {
      completionTimes[nodeId] = completionTime;
      
      const timeout = setTimeout(() => {
        setWorkflowNodes(prev => {
          const updatedNodes = prev.map(node =>
            node.id === nodeId ? { ...node, status: 'completed' as NodeStatus } : node
          );
          
          // Check if workflow is complete
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

    // Calculate start and completion times for each node
    const calculateNodeTiming = () => {
      const processedNodes = new Set<string>();
      const nodesToProcess = [...resetNodes];
      
      // Process nodes in dependency order
      while (nodesToProcess.length > 0) {
        const readyNodes = nodesToProcess.filter(node => {
          const dependencies = getNodeDependencies(node.id, resetNodes);
          return dependencies.every(depId => processedNodes.has(depId));
        });
        
        if (readyNodes.length === 0) break; // Circular dependency or other issue
        
        readyNodes.forEach(node => {
          const dependencies = getNodeDependencies(node.id, resetNodes);
          
          // Calculate when this node can start
          let earliestStart = 0;
          if (dependencies.length > 0) {
            earliestStart = Math.max(...dependencies.map(depId => completionTimes[depId] || 0));
          }
          
          // Schedule node to start and complete
          const nodeStartTime = earliestStart;
          const nodeCompletionTime = earliestStart + (node.duration || 1);
          
          startNode(node.id, nodeStartTime);
          completeNode(node.id, nodeCompletionTime);
          
          completionTimes[node.id] = nodeCompletionTime;
          processedNodes.add(node.id);
          
          // Remove from processing queue
          const index = nodesToProcess.findIndex(n => n.id === node.id);
          if (index > -1) nodesToProcess.splice(index, 1);
        });
      }
    };

    calculateNodeTiming();
  };

  const resetWorkflow = (): void => {
    if (readonly) return;
    
    setWorkflowNodes(prev => prev.map(node => ({
      ...node,
      status: 'pending' as NodeStatus
    })));
    setIsRunning(false);
    
    if (eventHandlers?.onWorkflowReset) {
      eventHandlers.onWorkflowReset();
    }
  };

  const selectedNode = selectedNodeId ? workflowNodes.find(n => n.id === selectedNodeId) : null;

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Visual Workflow</h2>
        {enableSimulation && !readonly && (
          <div className="flex gap-2">
            <button
              onClick={simulateWorkflow}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="w-4 h-4" />
              {isRunning ? 'Running...' : 'Start Workflow'}
            </button>
            <button
              onClick={resetWorkflow}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {enableSimulation && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress</span>
            <span>{getWorkflowProgress()}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${getWorkflowProgress()}%` }}
            ></div>
          </div>
        </div>
      )}
      
      <div className={`relative bg-gray-50 rounded-lg p-8 overflow-auto ${showGrid ? 'bg-dot-pattern' : ''}`} style={{ minHeight: '600px' }}>
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="#6b7280"
              />
            </marker>
          </defs>
          {renderConnections()}
        </svg>

        {/* Workflow Nodes */}
        {workflowNodes.map((node: WorkflowNode) => (
          <div
            key={node.id}
            className={getNodeClasses(node)}
            style={{
              left: node.x * 180,
              top: node.y * 120
            }}
            onClick={() => handleNodeClick(node)}
            onDoubleClick={() => handleNodeDoubleClick(node)}
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

      {/* Details about clicked node */}
      {selectedNode && (
        <NodeDetails selectedNode={selectedNode} />
      )}
      {/* Info about the status symbols */}
      <StatusInfo />
    </div>
  );
}

export default VisualWorkflow;