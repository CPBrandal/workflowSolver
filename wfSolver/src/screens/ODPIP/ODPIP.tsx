import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { checkBackendHealth, solveODPIP, type ODPIPResult } from '../../services/odpipService';
import type { Workflow } from '../../types';
import type { WorkflowRecord } from '../../types/database';
import { WorkflowService } from '../database/services/workflowService';
import {
  createSubsetValues,
  exportSubsetValuesToFile,
  getSubsetValuesDescription,
} from './createPartitionValues';

function ODPIP() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [dbWorkflows, setDbWorkflows] = useState<WorkflowRecord[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [subsetValues, setSubsetValues] = useState<number[]>([]);
  const [description, setDescription] = useState<string>('');
  const [showDescription, setShowDescription] = useState(false);
  const [solverResult, setSolverResult] = useState<ODPIPResult | null>(null);
  const [solving, setSolving] = useState(false);
  const [solverError, setSolverError] = useState<string | null>(null);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchWorkflows = async () => {
      setLoadingWorkflows(true);
      const workflows = await WorkflowService.getAllWorkflows();
      setDbWorkflows(workflows);
      setLoadingWorkflows(false);
    };

    fetchWorkflows();
  }, []);

  useEffect(() => {
    checkBackendHealth().then(setBackendAvailable);
  }, []);

  useEffect(() => {
    if (selectedWorkflow) {
      try {
        const { values, criticalPathDuration } = createSubsetValues(selectedWorkflow);
        setSubsetValues(values);
        setDescription(getSubsetValuesDescription(selectedWorkflow, values, criticalPathDuration));
      } catch (error) {
        console.error(error);
      }
    }
  }, [selectedWorkflow]);

  const handleExport = () => {
    if (subsetValues.length > 0) {
      const sanitizedName = selectedWorkflow
        ? selectedWorkflow.name.replace(/\s+/g, '_')
        : 'subset-values';
      const filename = `${sanitizedName}-subset-values.txt`;
      exportSubsetValuesToFile(subsetValues, filename);
    }
  };

  const handleWorkflowSelect = async (workflowRecord: WorkflowRecord) => {
    const record = await WorkflowService.getWorkflow(workflowRecord.id);
    if (record) {
      setSelectedWorkflow(record.topology);
      setSolverResult(null);
      setSolverError(null);
    }
  };

  const handleSolve = async () => {
    if (subsetValues.length === 0) return;

    setSolving(true);
    setSolverError(null);
    setSolverResult(null);

    try {
      const numOfAgents = Math.log2(subsetValues.length);
      const result = await solveODPIP(numOfAgents, subsetValues);
      setSolverResult(result);
    } catch (error) {
      setSolverError(error instanceof Error ? error.message : 'Solver failed');
    } finally {
      setSolving(false);
    }
  };

  const getPartitionDescription = (partition: number[][]): string => {
    if (!selectedWorkflow) return '';
    const nonCriticalTasks = selectedWorkflow.tasks.filter(t => !t.criticalPath);

    return partition
      .map(coalition => {
        const taskNames = coalition.map(agentIdx => {
          const task = nonCriticalTasks[agentIdx - 1];
          return task ? task.name : `Agent ${agentIdx}`;
        });
        return `{${taskNames.join(', ')}}`;
      })
      .join(', ');
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <h1 className="text-4xl font-bold text-center mb-8">ODP-IP Solver</h1>

        {/* Workflow Selection Card */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold mb-4 text-center">Select Workflow</h2>
          <p className="text-gray-700 mb-6 text-center">
            Choose a saved workflow to compute optimal task partitioning.
          </p>

          {/* Backend Status */}
          <div className="flex justify-center mb-6">
            <div
              className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                backendAvailable === null
                  ? 'bg-gray-100 text-gray-600'
                  : backendAvailable
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full mr-2 ${
                  backendAvailable === null
                    ? 'bg-gray-400'
                    : backendAvailable
                      ? 'bg-green-500'
                      : 'bg-red-500'
                }`}
              />
              {backendAvailable === null
                ? 'Checking backend...'
                : backendAvailable
                  ? 'Backend connected'
                  : 'Backend offline - run: npm run server'}
            </div>
          </div>

          {/* Workflow Selector */}
          <div className="max-w-md mx-auto">
            {loadingWorkflows ? (
              <p className="text-center text-gray-500">Loading workflows...</p>
            ) : (
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onChange={e => {
                  const selected = dbWorkflows.find(w => w.id === e.target.value);
                  if (selected) handleWorkflowSelect(selected);
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  Choose a workflow...
                </option>
                {dbWorkflows.map(workflow => (
                  <option key={workflow.id} value={workflow.id}>
                    {workflow.topology.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Results Card */}
        {selectedWorkflow && subsetValues.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold mb-2 text-center">Subset Values</h2>
            <p className="text-gray-600 text-center mb-6">
              {subsetValues.length} subsets generated for {selectedWorkflow.name}
            </p>

            {/* Action Buttons */}
            <div className="flex justify-center gap-3 flex-wrap mb-6">
              <button
                onClick={handleSolve}
                disabled={solving || !backendAvailable}
                className={`px-5 py-2.5 text-white rounded-md transition-colors font-medium ${
                  solving || !backendAvailable
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {solving ? 'Solving...' : 'Find Optimal Partition'}
              </button>
              <button
                onClick={handleExport}
                className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors font-medium"
              >
                Export to .txt
              </button>
              <button
                onClick={() => setShowDescription(!showDescription)}
                className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors font-medium"
              >
                {showDescription ? 'Hide Details' : 'Show Details'}
              </button>
            </div>

            {/* Solver Error */}
            {solverError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4">
                <p className="font-medium">Error</p>
                <p className="text-sm">{solverError}</p>
              </div>
            )}

            {/* Solver Result */}
            {solverResult && (
              <div className="bg-gray-50 rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800">Result</h3>
                  <span className="text-sm text-gray-400">{solverResult.timeMs} ms</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-gray-500">Optimal value:</span>
                    <span className="text-lg font-semibold text-gray-800">
                      {typeof solverResult.value === 'number'
                        ? solverResult.value.toFixed(2)
                        : solverResult.value}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Task groups:</span>
                    <p className="mt-1 text-gray-800">
                      {getPartitionDescription(solverResult.partition)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Description */}
            {showDescription && (
              <div className="mt-6 bg-gray-50 border border-gray-200 p-4 rounded-lg max-h-96 overflow-y-auto">
                <h3 className="font-medium mb-3 text-gray-700">Subset Details</h3>
                <pre className="text-sm whitespace-pre-wrap text-gray-600 font-mono">
                  {description}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default ODPIP;
