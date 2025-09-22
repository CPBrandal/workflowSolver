import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { WorkflowService } from '../../services/workflowService';
import type { Workflow } from '../../types';
import type { WorkflowRecord } from '../../types/database';
import VisualWorkflow from '../workflowScreen/VisualWorkflow';

function ViewWorkflow() {
  const [savedWorkflows, setSavedWorkflows] = useState<WorkflowRecord[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [loadingWorkflow, setLoadingWorkflow] = useState(false);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [showWorkflow, setShowWorkflow] = useState(false);

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

  // Load selected workflow
  useEffect(() => {
    const loadSelectedWorkflow = async () => {
      if (!selectedWorkflowId) {
        setWorkflow(null);
        setShowWorkflow(false);
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

  const handleShowWorkflow = () => {
    if (!selectedWorkflowId) {
      alert('Please select a workflow first');
      return;
    }
    setShowWorkflow(!showWorkflow);
  };

  const getSelectedWorkflowDetails = () => {
    return savedWorkflows.find(w => w.id === selectedWorkflowId);
  };

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-4 text-center">View Workflow</h2>
        <p className="text-gray-700 mb-6 text-center">
          Browse and visualize saved workflows from the database.
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
              <p className="text-sm mt-1">Generate and save a workflow to see it here.</p>
            </div>
          ) : (
            <>
              {/* Workflow Selector */}
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
                  {savedWorkflows.map(wf => (
                    <option key={wf.id} value={wf.id}>
                      {wf.topology.name} ({wf.node_count} nodes) -{' '}
                      {new Date(wf.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {savedWorkflows.length} workflow{savedWorkflows.length !== 1 ? 's' : ''} available
                </p>
              </div>

              {/* Workflow Details */}
              {selectedWorkflowId && (
                <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Workflow Details</h4>
                  {(() => {
                    const selected = getSelectedWorkflowDetails();
                    if (!selected) return null;

                    return (
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <strong>Name:</strong> {selected.topology.name}
                        </p>
                        <p>
                          <strong>Nodes:</strong> {selected.node_count}
                        </p>
                        <p>
                          <strong>Gamma Parameters:</strong> shape={selected.gamma_params.shape},
                          scale={selected.gamma_params.scale}
                        </p>
                        <p>
                          <strong>Expected Task Time:</strong>{' '}
                          {(selected.gamma_params.shape * selected.gamma_params.scale).toFixed(2)}s
                        </p>
                        <p>
                          <strong>Created:</strong> {new Date(selected.created_at).toLocaleString()}
                        </p>
                        {selected.tags && selected.tags.length > 0 && (
                          <p>
                            <strong>Tags:</strong> {selected.tags.join(', ')}
                          </p>
                        )}
                        {selected.generation_config && (
                          <div className="mt-2 pt-2 border-t border-blue-300">
                            <p className="text-xs font-semibold text-gray-700">
                              Generation Config:
                            </p>
                            <p className="text-xs">
                              Depth: {selected.generation_config.maxDepth}, Max Width:{' '}
                              {selected.generation_config.maxWidth}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Show/Hide Button */}
              <button
                onClick={handleShowWorkflow}
                disabled={!selectedWorkflowId || loadingWorkflow}
                className={`w-full px-5 py-2.5 text-white border-0 rounded cursor-pointer transition-colors ${
                  selectedWorkflowId && !loadingWorkflow
                    ? 'bg-blue-500 hover:bg-blue-600'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                {loadingWorkflow
                  ? 'Loading...'
                  : showWorkflow
                    ? 'Hide Workflow Visualization'
                    : 'Show Workflow Visualization'}
              </button>
            </>
          )}
        </div>

        {/* Workflow Visualization */}
        {showWorkflow && workflow && (
          <div className="mt-8 pt-6 border-t">
            <h3 className="text-lg font-medium text-gray-700 mb-4 text-center">
              Workflow Visualization
            </h3>
            <VisualWorkflow
              nodes={workflow.tasks}
              workers={[]} // No workers needed for viewing
              onWorkersUpdate={() => {}} // No-op for viewing
              cpmAnalysis={workflow.criticalPathResult || null}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}

export default ViewWorkflow;
