import { useEffect, useState } from 'react';
import { Layout } from '../../../components/Layout';
import type { SimulationRecord, WorkflowRecord } from '../../../types/database';
import { SimulationService } from '../services/simulationService';
import { WorkflowService } from '../services/workflowService';

function DataBaseEditScreen() {
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [simulations, setSimulations] = useState<SimulationRecord[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingSimulations, setLoadingSimulations] = useState(false);
  const [operationInProgress, setOperationInProgress] = useState(false);

  // Load workflows on mount
  useEffect(() => {
    loadWorkflows();
  }, []);

  // Load simulations when workflow is selected
  useEffect(() => {
    if (selectedWorkflowId) {
      loadSimulations(selectedWorkflowId);
    } else {
      setSimulations([]);
    }
  }, [selectedWorkflowId]);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const data = await WorkflowService.getAllWorkflows();
      setWorkflows(data);
    } catch (error) {
      console.error('Error loading workflows:', error);
      alert('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const loadSimulations = async (workflowId: string) => {
    setLoadingSimulations(true);
    try {
      const data = await SimulationService.getSimulationsByWorkflow(workflowId);
      setSimulations(data);
    } catch (error) {
      console.error('Error loading simulations:', error);
      alert('Failed to load simulations');
    } finally {
      setLoadingSimulations(false);
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete workflow "${workflow.topology.name}"?\n\n` +
        `This will also delete ALL associated simulations and cannot be undone.`
    );

    if (!confirmed) return;

    setOperationInProgress(true);
    try {
      const success = await WorkflowService.deleteWorkflow(workflowId);

      if (success) {
        alert(`Workflow "${workflow.topology.name}" deleted successfully!`);
        await loadWorkflows(); // Reload the list
        if (selectedWorkflowId === workflowId) {
          setSelectedWorkflowId(''); // Clear selection if deleted workflow was selected
        }
      } else {
        alert('Failed to delete workflow');
      }
    } catch (error) {
      console.error('Error deleting workflow:', error);
      alert('Failed to delete workflow');
    } finally {
      setOperationInProgress(false);
    }
  };

  const handleDeleteAllSimulations = async (workflowId: string) => {
    const workflow = workflows.find(w => w.id === workflowId);
    const simulationCount = simulations.length;

    if (simulationCount === 0) {
      alert('No simulations found for this workflow.');
      return;
    }

    const confirmed = window.confirm(
      `Delete all ${simulationCount} simulation${simulationCount !== 1 ? 's' : ''} for workflow "${workflow?.topology.name}"?\n\n` +
        `This action cannot be undone.`
    );

    if (!confirmed) return;

    setOperationInProgress(true);
    try {
      const result = await SimulationService.deleteSimulationsByWorkflow(workflowId);

      if (result.success) {
        alert(
          `Successfully deleted ${result.deletedCount} simulation${result.deletedCount !== 1 ? 's' : ''}!`
        );
        await loadSimulations(workflowId); // Reload simulations
      } else {
        alert(`Failed to delete simulations: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting simulations:', error);
      alert('Failed to delete simulations');
    } finally {
      setOperationInProgress(false);
    }
  };

  const getSelectedWorkflow = () => workflows.find(w => w.id === selectedWorkflowId);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="ml-3 text-gray-600">Loading database...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-4 text-center">Database Management</h2>
        <p className="text-gray-700 mb-6 text-center">
          Manage workflows and simulations in your database. Use with caution - deletions cannot be
          undone.
        </p>

        <div className="space-y-8">
          {/* Workflows Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">
              Workflows ({workflows.length})
            </h3>

            {workflows.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No workflows found in database.</p>
            ) : (
              <div className="space-y-3">
                {workflows.map(workflow => (
                  <div
                    onClick={() => setSelectedWorkflowId(workflow.id)}
                    key={workflow.id}
                    className={`border rounded-lg p-4 transition-colors ${
                      selectedWorkflowId === workflow.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">{workflow.topology.name}</h4>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>
                            <span className="font-medium">Nodes:</span> {workflow.node_count} |
                          </p>
                          <p>
                            <span className="font-medium">Created:</span>
                            {new Date(workflow.created_at).toLocaleString()}
                          </p>
                          {workflow.tags && workflow.tags.length > 0 && (
                            <p>
                              <span className="font-medium">Tags:</span> {workflow.tags.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() =>
                            setSelectedWorkflowId(
                              selectedWorkflowId === workflow.id ? '' : workflow.id
                            )
                          }
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          {selectedWorkflowId === workflow.id ? 'Hide' : 'View'} Simulations
                        </button>

                        <button
                          onClick={() => handleDeleteWorkflow(workflow.id)}
                          disabled={operationInProgress}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:bg-gray-400"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Simulations Section */}
          {selectedWorkflowId && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  Simulations for "{getSelectedWorkflow()?.topology.name}" ({simulations.length})
                </h3>

                {simulations.length > 0 && (
                  <button
                    onClick={() => handleDeleteAllSimulations(selectedWorkflowId)}
                    disabled={operationInProgress}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:bg-gray-400"
                  >
                    Delete All Simulations
                  </button>
                )}
              </div>

              {loadingSimulations ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  <p className="ml-2 text-gray-600">Loading simulations...</p>
                </div>
              ) : simulations.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No simulations found for this workflow.
                </p>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <span className="font-medium text-gray-700">Total Simulations:</span>
                      <p className="text-lg font-semibold text-blue-600">{simulations.length}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Avg Actual Runtime:</span>
                      <p className="text-lg font-semibold text-green-600">
                        {(
                          simulations.reduce((sum, sim) => sum + sim.actual_runtime, 0) /
                          simulations.length
                        ).toFixed(2)}
                        s
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Avg Theoretical Runtime:</span>
                      <p className="text-lg font-semibold text-purple-600">
                        {(
                          simulations.reduce((sum, sim) => sum + sim.theoretical_runtime, 0) /
                          simulations.length
                        ).toFixed(2)}
                        s
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Workers Used:</span>
                      <p className="text-lg font-semibold text-orange-600">
                        {simulations[0]?.worker_count || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600">
                    <p>
                      <span className="font-medium">Simulation Range:</span>#
                      {Math.min(...simulations.map(s => s.simulation_number || 0))} - #
                      {Math.max(...simulations.map(s => s.simulation_number || 0))}
                    </p>
                    <p>
                      <span className="font-medium">Date Range:</span>
                      {new Date(
                        Math.min(...simulations.map(s => new Date(s.created_at).getTime()))
                      ).toLocaleDateString()}{' '}
                      -
                      {new Date(
                        Math.max(...simulations.map(s => new Date(s.created_at).getTime()))
                      ).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Warning Message */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-yellow-800 mb-1">Warning</h4>
                <p className="text-sm text-yellow-700">
                  All deletions are permanent and cannot be undone. Deleting a workflow will also
                  delete all its associated simulations. Make sure you have backups if needed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default DataBaseEditScreen;
