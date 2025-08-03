import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, Clock, AlertCircle, Pause, RefreshCw } from 'lucide-react';

// Types
type NodeStatus = 'pending' | 'running' | 'completed' | 'error' | 'paused';
type NodeType = 'start' | 'process' | 'end';

interface WorkflowNode {
  id: string;
  name: string;
  type: NodeType;
  status: NodeStatus;
  x: number;
  y: number;
  connections: string[];
  description?: string;
  duration?: string;
}

interface EventHandlers {
  onNodeClick?: (node: WorkflowNode) => void;
  onNodeDoubleClick?: (node: WorkflowNode) => void;
  onWorkflowStart?: () => void;
  onWorkflowComplete?: () => void;
  onWorkflowReset?: () => void;
}

interface VisualWorkflowProps {
  nodes?: WorkflowNode[];
  selectedNodeId?: string | null;
  eventHandlers?: EventHandlers;
  readonly?: boolean;
  showGrid?: boolean;
  enableSimulation?: boolean;
  autoStart?: boolean;
}

const VisualWorkflow: React.FC<VisualWorkflowProps> = ({
  nodes: propNodes,
  selectedNodeId: propSelectedNodeId,
  eventHandlers,
  readonly = false,
  showGrid = false,
  enableSimulation = true,
  autoStart = false
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(propSelectedNodeId || null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const defaultNodes: WorkflowNode[] = [
    {
      id: '1',
      name: 'Start',
      type: 'start',
      status: 'completed',
      x: 2,
      y: 0,
      connections: ['2'],
      description: 'Initialize the workflow process',
      duration: '1s'
    },
    {
      id: '2',
      name: 'Data Validation',
      type: 'process',
      status: 'completed',
      x: 2,
      y: 1,
      connections: ['3', '4'],
      description: 'Validate incoming data format and integrity',
      duration: '3s'
    },
    {
      id: '3',
      name: 'Process A',
      type: 'process',
      status: 'running',
      x: 1,
      y: 2,
      connections: ['5'],
      description: 'Execute primary processing logic',
      duration: '10s'
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
      duration: '8s'
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
      duration: '3s'
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
      duration: '1s'
    }
  ];

  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>(propNodes || defaultNodes);

  // Update internal state when prop nodes change
  useEffect(() => {
    if (propNodes) {
      setWorkflowNodes(propNodes);
    }
  }, [propNodes]);

  // Auto-start simulation if enabled
  useEffect(() => {
    if (autoStart && enableSimulation && !readonly) {
      simulateWorkflow();
    }
  }, [autoStart, enableSimulation, readonly]);

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
            strokeColor = "#3b82f6"; // Blue for active path
            strokeWidth = "3";
          } else if (node.status === 'completed') {
            strokeColor = "#10b981"; // Green for completed path
            strokeWidth = "3";
          } else if (node.status === 'error') {
            strokeColor = "#ef4444"; // Red for error path
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
    
    // Call external event handler if provided
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
    
    // Reset all to pending except start
    const resetNodes = workflowNodes.map(node => ({
      ...node,
      status: node.id === '1' ? 'completed' as NodeStatus : 'pending' as NodeStatus
    }));
    setWorkflowNodes(resetNodes);

    // Simulate progression with realistic timing
    setTimeout(() => {
      setWorkflowNodes(prev => prev.map(node =>
        node.id === '2' ? { ...node, status: 'running' as NodeStatus } : node
      ));
    }, 1000);

    setTimeout(() => {
      setWorkflowNodes(prev => prev.map(node =>
        node.id === '2' ? { ...node, status: 'completed' as NodeStatus } :
        node.id === '3' ? { ...node, status: 'running' as NodeStatus } :
        node.id === '4' ? { ...node, status: 'running' as NodeStatus } : node
      ));
    }, 3000);

    setTimeout(() => {
      setWorkflowNodes(prev => prev.map(node =>
        node.id === '3' ? { ...node, status: 'completed' as NodeStatus } :
        node.id === '4' ? { ...node, status: 'completed' as NodeStatus } :
        node.id === '5' ? { ...node, status: 'running' as NodeStatus } : node
      ));
    }, 6000);

    setTimeout(() => {
      setWorkflowNodes(prev => prev.map(node =>
        node.id === '5' ? { ...node, status: 'completed' as NodeStatus } :
        node.id === '6' ? { ...node, status: 'running' as NodeStatus } : node
      ));
    }, 8000);

    setTimeout(() => {
      setWorkflowNodes(prev => prev.map(node =>
        node.id === '6' ? { ...node, status: 'completed' as NodeStatus } : node
      ));
      setIsRunning(false);
      
      if (eventHandlers?.onWorkflowComplete) {
        eventHandlers.onWorkflowComplete();
      }
    }, 10000);
  };

  const resetWorkflow = (): void => {
    if (readonly) return;
    
    setWorkflowNodes(prev => prev.map(node => ({
      ...node,
      status: node.id === '1' ? 'completed' as NodeStatus : 'pending' as NodeStatus
    })));
    setIsRunning(false);
    
    if (eventHandlers?.onWorkflowReset) {
      eventHandlers.onWorkflowReset();
    }
  };

  const selectedNode = selectedNodeId ? workflowNodes.find(n => n.id === selectedNodeId) : null;

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white">
      {/* Header with controls */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Enhanced Visual Workflow</h2>
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
        {/* SVG for connections */}
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
                {node.duration}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Node Details Panel */}
      {selectedNode && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-blue-800 mb-2">Node Details</h3>
          <div className="text-sm text-blue-700 space-y-1">
            <p><span className="font-medium">Name:</span> {selectedNode.name}</p>
            <p><span className="font-medium">Status:</span> 
              <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                selectedNode.status === 'completed' ? 'bg-green-200 text-green-800' :
                selectedNode.status === 'running' ? 'bg-blue-200 text-blue-800' :
                selectedNode.status === 'error' ? 'bg-red-200 text-red-800' :
                selectedNode.status === 'paused' ? 'bg-yellow-200 text-yellow-800' :
                'bg-gray-200 text-gray-800'
              }`}>
                {selectedNode.status}
              </span>
            </p>
            <p><span className="font-medium">Type:</span> {selectedNode.type}</p>
            {selectedNode.duration && (
              <p><span className="font-medium">Duration:</span> {selectedNode.duration}</p>
            )}
            {selectedNode.description && (
              <p><span className="font-medium">Description:</span> {selectedNode.description}</p>
            )}
            <p><span className="font-medium">Connections:</span> {selectedNode.connections.length} outgoing</p>
          </div>
        </div>
      )}

      {/* Status Legend */}
      <div className="mt-6 p-4 bg-gray-100 rounded-lg">
        <h3 className="font-semibold mb-3 text-gray-800">Status Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-gray-700">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-blue-600" />
            <span className="text-gray-700">Running</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-gray-700">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-gray-700">Error</span>
          </div>
          <div className="flex items-center gap-2">
            <Pause className="w-4 h-4 text-yellow-600" />
            <span className="text-gray-700">Paused</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisualWorkflow;