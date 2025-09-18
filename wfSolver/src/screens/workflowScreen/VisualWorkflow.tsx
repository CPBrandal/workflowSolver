import { Clock, Play, RefreshCw, Users } from 'lucide-react';
import { useState } from 'react';
import { defaultNodes } from '../../data/defaultNodes';
import { useWorkflowSimulation } from '../../hooks/useWorkflowSimulations';
import type { VisualWorkflowProps, WorkflowNode } from '../../types';
import { formatTime } from '../../utils/formatTime';
import { getStatusIcon } from '../../utils/getStatusIcon';
import { NodeDetails } from './components/NodeDetails';
import { WorkflowConnections } from './components/WorkflowConnections';
import WorkflowProgress from './components/WorkflowProgress';

function VisualWorkflow({
  nodes: propNodes,
  selectedNodeId: propSelectedNodeId,
  eventHandlers,
  showGrid = false,
  enableSimulation = true,
  workers = [],
  onWorkersUpdate,
  cpmAnalysis,
}: VisualWorkflowProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(propSelectedNodeId || null);

  // Use provided nodes, fallback to default nodes if none provided
  const initialNodes = propNodes && propNodes.length > 0 ? propNodes : defaultNodes;

  const {
    nodes,
    isRunning,
    runtime,
    simulateWorkflow,
    resetWorkflow,
    availableWorkers,
    activeWorkers,
    simulationStartTime,
  } = useWorkflowSimulation({
    initialNodes,
    eventHandlers,
    workers,
    onWorkersUpdate,
  });

  const getNodeClasses = (node: WorkflowNode): string => {
    const baseClasses =
      'absolute flex flex-col items-center justify-center w-40 h-28 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-xl hover:scale-105';

    const statusClasses = {
      completed: 'bg-green-50 hover:bg-green-100 shadow-green-200',
      running: 'bg-blue-100 hover:bg-blue-100 animate-pulse shadow-blue-200',
      pending: 'bg-gray-50 hover:bg-gray-100 shadow-gray-200',
    }[node.status];

    const borderClasses = node.criticalPath ? 'border-red-500' : 'border-gray-300';

    const selectedClasses =
      selectedNodeId === node.id ? 'ring-4 ring-blue-400 ring-opacity-60 shadow-lg' : 'shadow-md';

    return `${baseClasses} ${statusClasses} ${borderClasses} ${selectedClasses}`;
  };

  const handleNodeClick = (node: WorkflowNode): void => {
    const newSelectedId = selectedNodeId === node.id ? null : node.id;
    setSelectedNodeId(newSelectedId);
    eventHandlers?.onNodeClick?.(node);
  };

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;
  const usingDefaultNodes = !propNodes || propNodes.length === 0;

  // Calculate graph bounds for better centering
  const getGraphBounds = () => {
    if (nodes.length === 0) return { minX: 0, maxX: 4, minY: 0, maxY: 4 };

    const xPositions = nodes.map(node => node.position.x);
    const yPositions = nodes.map(node => node.position.y);

    return {
      minX: Math.min(...xPositions),
      maxX: Math.max(...xPositions),
      minY: Math.min(...yPositions),
      maxY: Math.max(...yPositions),
    };
  };

  const bounds = getGraphBounds();
  const graphWidth = (bounds.maxX - bounds.minX + 1) * 280 + 160; // Extra padding for nodes
  const graphHeight = (bounds.maxY - bounds.minY + 1) * 180 + 120; // Extra padding for nodes
  const containerHeight = Math.max(800, graphHeight + 200); // Minimum height with extra space

  return (
    <div className="max-w mx-auto p-6 bg-white">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Visual Workflow</h2>
        {enableSimulation && (
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

      {/* Default nodes notification */}
      {usingDefaultNodes && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-sm">
            <strong>Note:</strong> No workflow data was provided, so we're showing a default example
            workflow.
          </p>
        </div>
      )}

      {/* Worker Statistics */}
      {workers.length > 0 && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-blue-700">Total Workers</p>
                <p className="text-xl font-bold text-blue-800">{workers.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-green-700">Available</p>
                <p className="text-xl font-bold text-green-800">{availableWorkers}</p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm text-orange-700">Active</p>
                <p className="text-xl font-bold text-orange-800">{activeWorkers}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {enableSimulation && <WorkflowProgress nodes={nodes} />}

      {/* Workflow Visualization */}
      <div
        className={`relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl overflow-auto shadow-inner border border-gray-200 ${showGrid ? 'bg-dot-pattern' : ''}`}
        style={{
          minHeight: `${containerHeight}px`,
          padding: '80px',
        }}
      >
        {/* Centered container for the graph */}
        <div
          className="relative mx-auto"
          style={{
            width: `${graphWidth}px`,
            height: `${graphHeight}px`,
          }}
        >
          {/* SVG for connections */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              left: `${-bounds.minX * 280 + 80}px`,
              top: `${-bounds.minY * 180 + 60}px`,
            }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="12"
                markerHeight="8"
                refX="11"
                refY="4"
                orient="auto"
              >
                <polygon points="0 0, 12 4, 0 8" fill="#6b7280" />
              </marker>

              {/* Optional: Add drop shadow filter for connections */}
              <filter id="connectionShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="1" dy="1" stdDeviation="1" floodOpacity="0.3" />
              </filter>
            </defs>
            <WorkflowConnections
              nodes={nodes}
              criticalPathNodes={cpmAnalysis?.orderedCriticalPath || []}
              isSimulationRunning={isRunning}
              simulationStartTime={simulationStartTime || 0}
            />
          </svg>

          {/* Workflow Nodes */}
          {nodes.map((node: WorkflowNode) => {
            const assignedWorker = node.assignedWorker
              ? workers.find(w => w.id === node.assignedWorker)
              : null;

            return (
              <div
                key={node.id}
                className={getNodeClasses(node)}
                style={{
                  left: (node.position.x - bounds.minX) * 280 + 80,
                  top: (node.position.y - bounds.minY) * 180 + 60,
                }}
                onClick={() => handleNodeClick(node)}
                title={`${node.description}${assignedWorker ? `\nWorker: ${assignedWorker.id}` : ''}`}
              >
                <div className="mb-2">{getStatusIcon(node.status)}</div>
                <span className="text-sm font-semibold text-center px-2 text-gray-800 leading-tight">
                  {node.name}
                </span>
                {node.executionTime && (
                  <span className="text-xs text-gray-600 mt-1 font-medium">
                    {node.executionTime}s
                  </span>
                )}
                {assignedWorker && (
                  <span className="text-xs text-blue-600 font-semibold mt-1 bg-blue-100 px-2 py-0.5 rounded-full">
                    {assignedWorker.id}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Worker Details Panel */}
      {workers.length > 0 && (
        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
          <h3 className="font-semibold mb-3 text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Worker Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {workers.map(worker => (
              <div
                key={worker.id}
                className={`p-3 rounded-lg border ${
                  worker.isActive ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
                }`}
              >
                <div className="font-medium text-sm">
                  {worker.id}
                  <span
                    className={`ml-2 px-2 py-1 rounded-full text-xs ${
                      worker.isActive ? 'bg-blue-200 text-blue-800' : 'bg-green-200 text-green-800'
                    }`}
                  >
                    {worker.isActive ? 'Active' : 'Available'}
                  </span>
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  <div>Time: {formatTime(worker.time * 1000)}</div>
                  {worker.currentTask && (
                    <div>
                      Task:{' '}
                      {nodes.find(n => n.id === worker.currentTask)?.name || worker.currentTask}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Node Details */}
      {selectedNode && <NodeDetails selectedNode={selectedNode} />}

      {/* Runtime Display */}
      <div className="mt-6 p-4 bg-gray-100 rounded-lg">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-600" />
          <span className="text-lg font-medium text-gray-800">
            Total runtime: {formatTime(runtime)}
          </span>
          {isRunning && <span className="text-sm text-blue-600 animate-pulse">Running</span>}
        </div>
      </div>
    </div>
  );
}

export default VisualWorkflow;
