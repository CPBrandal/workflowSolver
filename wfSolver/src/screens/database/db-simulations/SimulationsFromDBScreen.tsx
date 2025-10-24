import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Layout } from '../../../components/Layout';
import type { WorkflowRecord } from '../../../types/database';
import { WorkflowService } from '../services/workflowService';

const SimulationResultsVisualization = lazy(() =>
  import('../components/SimulationResultsVisualization').then(module => ({
    default: module.SimulationResultsVisualization,
  }))
);

function SimulationsFromDBScreen() {
  const [savedWorkflows, setSavedWorkflows] = useState<WorkflowRecord[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showWorkflowDetails, setShowWorkflowDetails] = useState(true);
  const [numberOfWorkers, setNumberOfWorkers] = useState(0);

  const [isComparing, setIsComparing] = useState(false);
  const [showComparisonInput, setShowComparisonInput] = useState(false);
  const [comparisonWorkers, setComparisonWorkers] = useState(3);
  const [tempComparisonWorkers, setTempComparisonWorkers] = useState('');

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
    if (selectedWorkflowId && numberOfWorkers > 0) {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  }, [selectedWorkflowId, numberOfWorkers]);

  const handleCompareClick = () => {
    setShowComparisonInput(true);
    setTempComparisonWorkers(comparisonWorkers.toString());
  };

  const handleConfirmComparison = () => {
    const workers = parseInt(tempComparisonWorkers);
    if (workers > 0 && workers !== numberOfWorkers) {
      setComparisonWorkers(workers);
      setIsComparing(true);
      setShowComparisonInput(false);
    }
  };

  const handleCancelComparison = () => {
    setShowComparisonInput(false);
  };

  const handleCloseComparison = () => {
    setIsComparing(false);
    setShowComparisonInput(false);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-[80%] mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold text-gray-800">Simulation Results Analysis</h1>
              {showResults && !showComparisonInput && (
                <div className="flex gap-2">
                  {!isComparing ? (
                    <button
                      onClick={handleCompareClick}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Compare
                    </button>
                  ) : (
                    <button
                      onClick={handleCloseComparison}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                    >
                      Close Comparison
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className="text-gray-600">
              View and analyze simulation results for your saved workflows
            </p>
          </div>

          {/* Workflow Selection */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Select Workflow</h2>

            {loadingWorkflows ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <p className="ml-3 text-gray-600">Loading workflows...</p>
              </div>
            ) : savedWorkflows.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No saved workflows found.</p>
                <p className="text-sm mt-1">
                  Generate and save a workflow first, then run simulations.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Workflow Selection */}
                  <div>
                    <label
                      htmlFor="workflowSelect"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Choose Workflow:
                    </label>
                    <select
                      id="workflowSelect"
                      value={selectedWorkflowId}
                      onChange={e => setSelectedWorkflowId(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">-- Select a workflow --</option>
                      {savedWorkflows.map(workflow => (
                        <option key={workflow.id} value={workflow.id}>
                          {workflow.topology.name} ({workflow.node_count} nodes) - Created:{' '}
                          {new Date(workflow.created_at).toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Worker Selection */}
                  <div>
                    <label
                      htmlFor="workerSelect"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Number of Workers:
                    </label>
                    <select
                      id="workerSelect"
                      value={numberOfWorkers}
                      onChange={e => setNumberOfWorkers(Number(e.target.value))}
                      disabled={!selectedWorkflowId}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value={0}>-- Select workers --</option>
                      {selectedWorkflowId &&
                        Array.from(
                          {
                            length:
                              savedWorkflows.find(w => w.id === selectedWorkflowId)?.node_count ||
                              1,
                          },
                          (_, i) => i + 1
                        ).map(num => (
                          <option key={num} value={num}>
                            {num} worker{num !== 1 ? 's' : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  {savedWorkflows.length} workflow{savedWorkflows.length !== 1 ? 's' : ''} available
                </p>

                {selectedWorkflowId && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setShowWorkflowDetails(!showWorkflowDetails)}
                    >
                      <h4 className="text-sm font-semibold text-gray-700">
                        Selected Workflow Details
                      </h4>
                      <button className="text-gray-600 hover:text-gray-800 transition-colors">
                        {showWorkflowDetails ? (
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M20 12H4"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                        )}
                      </button>
                    </div>

                    {showWorkflowDetails && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-600 mt-4 pt-4 border-t border-blue-300">
                        {(() => {
                          const selected = savedWorkflows.find(w => w.id === selectedWorkflowId);
                          if (!selected) return null;

                          return (
                            <>
                              <div>
                                <p className="font-medium text-gray-700">Name:</p>
                                <p>{selected.topology.name}</p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-700">Nodes:</p>
                                <p>{selected.node_count}</p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-700">Created:</p>
                                <p>{new Date(selected.created_at).toLocaleString()}</p>
                              </div>
                              {selected.tags && selected.tags.length > 0 && (
                                <div className="col-span-2">
                                  <p className="font-medium text-gray-700">Tags:</p>
                                  <p>{selected.tags.join(', ')}</p>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Comparison Input Modal */}
          {showComparisonInput && (
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-2 border-blue-500">
              <h3 className="text-lg font-semibold mb-4">Compare with Different Worker Count</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label
                    htmlFor="comparisonWorkers"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Number of Workers:
                  </label>
                  <input
                    id="comparisonWorkers"
                    type="number"
                    min="1"
                    value={tempComparisonWorkers}
                    onChange={e => setTempComparisonWorkers(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter number of workers"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Currently viewing: {numberOfWorkers} workers
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleConfirmComparison}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Compare
                  </button>
                  <button
                    onClick={handleCancelComparison}
                    className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Results Visualization */}
          {showResults && selectedWorkflowId && (
            <div className={`flex gap-6 ${isComparing ? 'flex-row' : ''}`}>
              {/* Primary Analysis */}
              <div
                className={`bg-white rounded-lg shadow-lg p-6 ${isComparing ? 'flex-1' : 'w-full'}`}
              >
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Analysis: {numberOfWorkers} Workers
                  </h3>
                </div>
                <Suspense fallback={<div>Loading charts...</div>}>
                  <SimulationResultsVisualization
                    workflowId={selectedWorkflowId}
                    numberOfWorkers={numberOfWorkers}
                  />
                </Suspense>
              </div>

              {/* Comparison Analysis */}
              {isComparing && (
                <div className="bg-white rounded-lg shadow-lg p-6 flex-1 border-2 border-blue-500">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">
                      Comparison: {comparisonWorkers} Workers
                    </h3>
                  </div>
                  <Suspense fallback={<div>Loading charts...</div>}>
                    <SimulationResultsVisualization
                      workflowId={selectedWorkflowId}
                      numberOfWorkers={comparisonWorkers}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default SimulationsFromDBScreen;
