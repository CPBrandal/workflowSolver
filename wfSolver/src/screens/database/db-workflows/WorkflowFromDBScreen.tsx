import { useEffect, useState } from 'react';
import { Layout } from '../../../components/Layout';
import type { Worker, Workflow } from '../../../types';
import type { WorkflowRecord } from '../../../types/database';
import VisualWorkflow from '../../workflowScreen/VisualWorkflow';
import { WorkflowService } from '../services/workflowService';
import { InstantSimulationRunner } from './InstantSimulationsRunner';

function WorkflowFromDBScreen() {
  const [savedWorkflows, setSavedWorkflows] = useState<WorkflowRecord[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [loadingWorkflow, setLoadingWorkflow] = useState(false);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workerCount, setWorkerCount] = useState<number>(2);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [useTransferTime, setUseTransferTime] = useState(true);

  // Simulation states
  const [numberOfSimulations, setNumberOfSimulations] = useState<number>(100);
  const [isRunningSimulations, setIsRunningSimulations] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState({ current: 0, total: 0 });

  // Fetch saved workflows when component mounts
  useEffect(() => {
    const fetchWorkflows = async () => {
      setLoadingWorkflows(true);
      const workflows = await WorkflowService.getAllWorkflows();
      setSavedWorkflows(workflows);
      setLoadingWorkflows(false);
    };

    fetchWorkflows();
  }, []);

  useEffect(() => {
    if (workflow?.tasks && workflow.tasks.length > 0) {
      const newWorkers: Worker[] = [];

      for (let i = 0; i < workerCount; i++) {
        newWorkers.push({
          id: `worker-${i + 1}`,
          time: 0,
          isActive: false,
          currentTask: null,
          criticalPathWorker: i === 0,
        });
      }

      setWorkers(newWorkers);
      console.log(`Created ${workerCount} workers for ${workflow.tasks.length} tasks`);
    }
  }, [workflow?.tasks.length, workerCount]);

  useEffect(() => {
    const loadSelectedWorkflow = async () => {
      if (!selectedWorkflowId) {
        setWorkflow(null);
        return;
      }

      setLoadingWorkflow(true);
      const workflowData = await WorkflowService.getWorkflow(selectedWorkflowId);

      if (workflowData) {
        setWorkflow(workflowData.topology);
      } else {
        alert('Failed to load workflow');
      }

      setLoadingWorkflow(false);
    };

    loadSelectedWorkflow();
  }, [selectedWorkflowId]);

  const handleShowWorkflow = async () => {
    if (!selectedWorkflowId) {
      alert('Please select a workflow first');
      return;
    }

    setShowWorkflow(!showWorkflow);
  };

  const handleRunSimulations = async () => {
    if (!selectedWorkflowId || !workflow) {
      alert('Please select a workflow first');
      return;
    }

    if (workers.length === 0) {
      alert('Please configure workers first');
      return;
    }

    // Get the selected workflow record to access gamma params
    const selectedWorkflow = savedWorkflows.find(w => w.id === selectedWorkflowId);
    if (!selectedWorkflow) {
      alert('Could not find workflow details');
      return;
    }

    setIsRunningSimulations(true);
    setSimulationProgress({ current: 0, total: numberOfSimulations });

    try {
      const savedIds = await InstantSimulationRunner.runBatchSimulations(
        selectedWorkflowId,
        workflow,
        workers,
        numberOfSimulations,
        selectedWorkflow.gamma_params,
        (current, total) => {
          setSimulationProgress({ current, total });
        },
        useTransferTime
      );

      alert(`Successfully completed ${savedIds.length} simulations!`);
    } catch (error) {
      console.error('Simulation error:', error);
      alert('Failed to run simulations. Check console for details.');
    } finally {
      setIsRunningSimulations(false);
      setSimulationProgress({ current: 0, total: 0 });
    }
  };

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-4 text-center">Load Saved Workflow</h2>
        <p className="text-gray-700 mb-6 text-center">
          Select a previously saved workflow topology from the database.
        </p>
        <div className="space-y-4 max-w-lg mx-auto">
          {loadingWorkflows ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading workflows...</p>
            </div>
          ) : savedWorkflows.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              <p>No saved workflows found.</p>
              <p className="text-sm mt-1">Generate a workflow and save it to see it here.</p>
            </div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="workflowSelect"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Select Workflow
                </label>
                <select
                  id="workflowSelect"
                  value={selectedWorkflowId}
                  onChange={e => setSelectedWorkflowId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Choose a workflow --</option>
                  {savedWorkflows.map(workflow => (
                    <option key={workflow.id} value={workflow.id}>
                      {workflow.topology.name} ({workflow.node_count} nodes) -{' '}
                      {new Date(workflow.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {savedWorkflows.length} workflow{savedWorkflows.length !== 1 ? 's' : ''} available
                </p>
              </div>

              {selectedWorkflowId && (
                <div className="bg-blue-50 p-3 rounded-md">
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Workflow Details</h4>
                  {(() => {
                    const selected = savedWorkflows.find(w => w.id === selectedWorkflowId);
                    if (!selected) return null;

                    return (
                      <div className="text-xs text-gray-600 space-y-1">
                        <p>
                          <strong>Name:</strong> {selected.topology.name}
                        </p>
                        <p>
                          <strong>Nodes:</strong> {selected.node_count}
                        </p>
                        <p>
                          <strong>Gamma:</strong> shape={selected.gamma_params.shape}, scale=
                          {selected.gamma_params.scale}
                        </p>
                        <p>
                          <strong>Created:</strong> {new Date(selected.created_at).toLocaleString()}
                        </p>
                        {selected.tags && selected.tags.length > 0 && (
                          <p>
                            <strong>Tags:</strong> {selected.tags.join(', ')}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <button
                onClick={handleShowWorkflow}
                disabled={!selectedWorkflowId || loadingWorkflow}
                className={`w-full px-5 py-2.5 text-white border-0 rounded cursor-pointer transition-colors ${
                  selectedWorkflowId && !loadingWorkflow
                    ? 'bg-blue-500 hover:bg-blue-600'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                {showWorkflow ? 'Hide Workflow' : 'Show Workflow'}
              </button>
            </>
          )}
        </div>

        {workflow && (
          <div className="mt-6 pt-6 border-t max-w-lg mx-auto">
            <h3 className="text-lg font-medium text-gray-700 mb-3">Worker Configuration</h3>
            <div>
              <label htmlFor="workerCount" className="block text-sm font-medium text-gray-700 mb-1">
                Number of Workers
              </label>
              <input
                id="workerCount"
                type="number"
                min="1"
                max={workflow.tasks.length}
                value={workerCount}
                onChange={e => setWorkerCount(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Number of parallel workers available for task execution (1-{workflow.tasks.length})
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Current: {workers.length} worker{workers.length !== 1 ? 's' : ''} configured
              </p>
            </div>
          </div>
        )}

        {workflow && (
          <div className="mt-6 pt-6 max-w-lg mx-auto flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex-1">
              <label htmlFor="useTransferTime" className="text-sm font-medium text-gray-700">
                Include Transfer Time
              </label>
              <p className="text-xs text-gray-500 mt-1">
                When enabled, transfer times between tasks are included in simulations
              </p>
            </div>
            <button
              id="useTransferTime"
              type="button"
              onClick={() => setUseTransferTime(!useTransferTime)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                useTransferTime ? 'bg-blue-600' : 'bg-gray-300'
              }`}
              role="switch"
              aria-checked={useTransferTime}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  useTransferTime ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        )}

        {/* Simulation Configuration */}
        {workflow && (
          <div className="mt-6 pt-6 max-w-lg mx-auto">
            <h3 className="text-lg font-medium text-gray-700 mb-3">Run Simulations</h3>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="numberOfSimulations"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Number of Simulations
                </label>
                <input
                  id="numberOfSimulations"
                  type="number"
                  min="1"
                  max="10000"
                  value={numberOfSimulations}
                  onChange={e => setNumberOfSimulations(parseInt(e.target.value) || 1)}
                  disabled={isRunningSimulations}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Each simulation uses different sampled execution and transfer times
                </p>
              </div>

              {isRunningSimulations && (
                <div className="bg-blue-50 p-4 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Progress</span>
                    <span className="text-sm text-gray-600">
                      {simulationProgress.current} / {simulationProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(simulationProgress.current / simulationProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleRunSimulations}
                disabled={isRunningSimulations || !selectedWorkflowId || workers.length === 0}
                className={`w-full px-5 py-2.5 text-white border-0 rounded cursor-pointer transition-colors ${
                  !isRunningSimulations && selectedWorkflowId && workers.length > 0
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                {isRunningSimulations
                  ? `Running Simulations... (${simulationProgress.current}/${simulationProgress.total})`
                  : `Run ${numberOfSimulations} Simulation${numberOfSimulations !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {showWorkflow && workflow && (
          <VisualWorkflow
            nodes={workflow.tasks}
            workers={workers}
            onWorkersUpdate={setWorkers}
            cpmAnalysis={workflow.criticalPathResult || null}
          />
        )}
      </div>
    </Layout>
  );
}

export default WorkflowFromDBScreen;
