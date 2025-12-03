import { useEffect, useState } from 'react';
import { Layout } from '../../../components/Layout';
import { ALGORITHMS, type SchedulingAlgorithm } from '../../../constants/constants';
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
  const [minWorkers, setMinWorkers] = useState<number>(2);
  const [maxWorkers, setMaxWorkers] = useState<number>(5);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [useTransferTime, setUseTransferTime] = useState(true);
  const [chosenAlgorithm, setChosenAlgorithm] = useState<SchedulingAlgorithm>('Greedy');

  // Simulation states
  const [numberOfSimulations, setNumberOfSimulations] = useState<number>(100);
  const [isRunningSimulations, setIsRunningSimulations] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState({
    current: 0,
    total: 0,
    currentWorkerCount: 0,
    totalWorkerCounts: 0,
  });

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

    // Validate worker range
    if (minWorkers < 1 || maxWorkers < minWorkers) {
      alert('Please configure a valid worker range (min must be >= 1 and max >= min)');
      return;
    }

    // Get the selected workflow record to access gamma params
    const selectedWorkflow = savedWorkflows.find(w => w.id === selectedWorkflowId);
    if (!selectedWorkflow) {
      alert('Could not find workflow details');
      return;
    }

    const workerCounts = maxWorkers - minWorkers + 1;
    setIsRunningSimulations(true);
    setSimulationProgress({
      current: 0,
      total: numberOfSimulations,
      currentWorkerCount: minWorkers,
      totalWorkerCounts: workerCounts,
    });

    try {
      let totalSimulationsCompleted = 0;

      // Loop through each worker count
      for (
        let currentWorkerCount = minWorkers;
        currentWorkerCount <= maxWorkers;
        currentWorkerCount++
      ) {
        // Create workers for this iteration
        const currentWorkers: Worker[] = [];
        for (let i = 0; i < currentWorkerCount; i++) {
          currentWorkers.push({
            id: `worker-${i + 1}`,
            time: 0,
            isActive: false,
            currentTask: null,
            criticalPathWorker: i === 0,
          });
        }

        console.log(
          `\n=== Running ${numberOfSimulations} simulations with ${currentWorkerCount} workers ===`
        );

        // Run simulations for this worker count
        const savedIds = await InstantSimulationRunner.runBatchSimulations(
          selectedWorkflowId,
          workflow,
          currentWorkers,
          numberOfSimulations,
          (current, total) => {
            setSimulationProgress({
              current,
              total,
              currentWorkerCount,
              totalWorkerCounts: workerCounts,
            });
          },
          useTransferTime,
          chosenAlgorithm
        );

        totalSimulationsCompleted += savedIds.length;
        console.log(`Completed ${savedIds.length} simulations with ${currentWorkerCount} workers`);
      }

      alert(
        `Successfully completed ${totalSimulationsCompleted} total simulations!\n` +
          `(${numberOfSimulations} simulations × ${workerCounts} worker configurations)`
      );
    } catch (error) {
      console.error('Simulation error:', error);
      alert('Failed to run simulations. Check console for details.');
    } finally {
      setIsRunningSimulations(false);
      setSimulationProgress({
        current: 0,
        total: 0,
        currentWorkerCount: 0,
        totalWorkerCounts: 0,
      });
    }
  };

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-4 text-center">Run Simulations on Workflows</h2>
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
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="minWorkers"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Min Workers
                  </label>
                  <input
                    id="minWorkers"
                    type="number"
                    min="1"
                    max={workflow.tasks.length}
                    value={minWorkers}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 1;
                      setMinWorkers(val);
                      if (val > maxWorkers) setMaxWorkers(val);
                    }}
                    disabled={isRunningSimulations}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="maxWorkers"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Max Workers
                  </label>
                  <input
                    id="maxWorkers"
                    type="number"
                    min={minWorkers}
                    max={workflow.tasks.length}
                    value={maxWorkers}
                    onChange={e => {
                      const val = parseInt(e.target.value) || minWorkers;
                      setMaxWorkers(Math.max(val, minWorkers));
                    }}
                    disabled={isRunningSimulations}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Simulations will be run for each worker count from {minWorkers} to {maxWorkers} (
                {maxWorkers - minWorkers + 1} configuration
                {maxWorkers - minWorkers !== 0 ? 's' : ''})
              </p>
              <div className="bg-blue-50 p-3 rounded-md">
                <p className="text-xs text-blue-700">
                  <strong>Visualization Worker Count (for display only)</strong>
                </p>
                <input
                  id="workerCount"
                  type="number"
                  min="1"
                  max={workflow.tasks.length}
                  value={workerCount}
                  onChange={e => setWorkerCount(parseInt(e.target.value) || 1)}
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-600 mt-1">
                  This only affects the workflow visualization below. Simulations use the range
                  above.
                </p>
              </div>
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

        {workflow && (
          <div className="mt-4 max-w-lg mx-auto p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex-1 mb-3">
              <label className="text-sm font-medium text-gray-700">Scheduling Algorithm</label>
              <p className="text-xs text-gray-500 mt-1">
                Choose the algorithm to use for task scheduling
              </p>
            </div>
            <div className="flex gap-2">
              {ALGORITHMS.map(algorithm => (
                <button
                  key={algorithm}
                  type="button"
                  onClick={() => setChosenAlgorithm(algorithm)}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    chosenAlgorithm === algorithm
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {algorithm}
                </button>
              ))}
            </div>
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
                <div className="bg-blue-50 p-4 rounded-md space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Worker Count {simulationProgress.currentWorkerCount} of {minWorkers}-
                        {maxWorkers}
                      </span>
                      <span className="text-sm text-gray-600">
                        Configuration {simulationProgress.currentWorkerCount - minWorkers + 1} /{' '}
                        {simulationProgress.totalWorkerCounts}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${((simulationProgress.currentWorkerCount - minWorkers + 1) / simulationProgress.totalWorkerCounts) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Simulations (current worker count)
                      </span>
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
                </div>
              )}

              <button
                onClick={handleRunSimulations}
                disabled={isRunningSimulations || !selectedWorkflowId || !workflow}
                className={`w-full px-5 py-2.5 text-white border-0 rounded cursor-pointer transition-colors ${
                  !isRunningSimulations && selectedWorkflowId && workflow
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                {isRunningSimulations
                  ? `Running... (Worker ${simulationProgress.currentWorkerCount}: ${simulationProgress.current}/${simulationProgress.total})`
                  : `Run ${numberOfSimulations} Simulations for ${maxWorkers - minWorkers + 1} Worker Config${maxWorkers - minWorkers !== 0 ? 's' : ''}`}
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
