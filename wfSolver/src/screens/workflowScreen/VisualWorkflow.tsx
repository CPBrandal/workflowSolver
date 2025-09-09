import { useState } from 'react';
import { Play, Clock, RefreshCw } from 'lucide-react';
import type { WorkflowNode, VisualWorkflowProps } from '../../types';
import { useWorkflowSimulation } from '../../hooks/useWorkflowSimulations';
import { getStatusIcon } from '../../utils/getStatusIcon';
import { formatTime } from '../../utils/formatTime';
import { StatusInfo } from './components/StatusInfo';
import { NodeDetails } from './components/NodeDetails';
import { WorkflowConnections } from './components/WorkflowConnections';
import WorkflowProgress from './components/WorkflowProgress';
import { defaultNodes } from '../../data/defaultNodes';

function VisualWorkflow({ 
  nodes: propNodes, 
  selectedNodeId: propSelectedNodeId, 
  eventHandlers, 
  showGrid = false, 
  enableSimulation = true 
}: VisualWorkflowProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(propSelectedNodeId || null);
  
  // Use provided nodes, fallback to default nodes if none provided
  const initialNodes = propNodes && propNodes.length > 0 ? propNodes : defaultNodes;
  
  const { nodes, isRunning, runtime, simulateWorkflow, resetWorkflow } = useWorkflowSimulation({
    initialNodes,
    eventHandlers
  });

  const getNodeClasses = (node: WorkflowNode): string => {
    const baseClasses = "absolute flex flex-col items-center justify-center w-36 h-24 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-lg";
    
    const statusClasses = {
      completed: "border-green-300 bg-green-100 hover:bg-green-200",
      running: "border-blue-300 bg-blue-100 hover:bg-blue-200 animate-pulse",
      pending: "border-gray-300 bg-gray-100 hover:bg-gray-200",
      failed: "border-red-300 bg-red-100 hover:bg-red-200"
    }[node.status];

    const selectedClasses = selectedNodeId === node.id ? "ring-4 ring-blue-300" : "";

    return `${baseClasses} ${statusClasses} ${selectedClasses}`;
  };

  const handleNodeClick = (node: WorkflowNode): void => {
    const newSelectedId = selectedNodeId === node.id ? null : node.id;
    setSelectedNodeId(newSelectedId);
    eventHandlers?.onNodeClick?.(node);
  };

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  // Show message if using default nodes instead of provided ones
  const usingDefaultNodes = !propNodes || propNodes.length === 0;

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white">
      {/* Header */}
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

      {/* Default nodes notification */}
      {usingDefaultNodes && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-sm">
            <strong>Note:</strong> No workflow data was provided, so we're showing a default example workflow.
          </p>
        </div>
      )}

      {/* Progress Bar */}
      {enableSimulation && <WorkflowProgress nodes={nodes} />}
      
      {/* Workflow Visualization */}
      <div 
        className={`relative bg-gray-50 rounded-lg overflow-auto ${showGrid ? 'bg-dot-pattern' : ''}`} 
        style={{ 
          minHeight: '600px', 
          paddingLeft: '200px', 
          paddingRight: '200px', 
          paddingTop: '50px', 
          paddingBottom: '50px' 
        }}
      >
        {/* SVG for connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
            </marker>
          </defs>
          <WorkflowConnections nodes={nodes} />
        </svg>

        {/* Workflow Nodes */}
        {nodes.map((node: WorkflowNode) => (
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

      {/* Node Details */}
      {selectedNode && <NodeDetails selectedNode={selectedNode} />}

      {/* Status Info */}
      <StatusInfo />
      
      {/* Runtime Display */}
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