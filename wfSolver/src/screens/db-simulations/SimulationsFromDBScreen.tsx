import { lazy, Suspense, useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { WorkflowService } from '../../services/workflowService';
import type { WorkflowRecord } from '../../types/database';

function SimulationsFromDBScreen() {
  const [savedWorkflows, setSavedWorkflows] = useState<WorkflowRecord[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const SimulationResultsVisualization = lazy(() =>
    import('../SimulationResultsVisualization').then(module => ({
      default: module.SimulationResultsVisualization,
    }))
  );

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

  // Auto-show results when workflow is selected
  useEffect(() => {
    if (selectedWorkflowId) {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  }, [selectedWorkflowId]);

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold text-gray-800">Simulation Results Analysis</h1>
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
                <div>
                  <label
                    htmlFor="workflowSelect"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Choose a workflow to view its simulation results:
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
                  <p className="text-xs text-gray-500 mt-2">
                    {savedWorkflows.length} workflow{savedWorkflows.length !== 1 ? 's' : ''}{' '}
                    available
                  </p>
                </div>

                {/* Workflow Details Card */}
                {selectedWorkflowId && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                      Selected Workflow Details
                    </h4>
                    {(() => {
                      const selected = savedWorkflows.find(w => w.id === selectedWorkflowId);
                      if (!selected) return null;

                      return (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-600">
                          <div>
                            <p className="font-medium text-gray-700">Name:</p>
                            <p>{selected.topology.name}</p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-700">Nodes:</p>
                            <p>{selected.node_count}</p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-700">Gamma Params:</p>
                            <p>
                              shape={selected.gamma_params.shape}, scale=
                              {selected.gamma_params.scale}
                            </p>
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
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Results Visualization */}
          {showResults && selectedWorkflowId && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <Suspense fallback={<div>Loading charts...</div>}>
                <SimulationResultsVisualization
                  workflowId={selectedWorkflowId}
                  gammaParams={
                    savedWorkflows.find(w => w.id === selectedWorkflowId)?.gamma_params || {
                      shape: 1,
                      scale: 1,
                    }
                  }
                />
              </Suspense>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default SimulationsFromDBScreen;
