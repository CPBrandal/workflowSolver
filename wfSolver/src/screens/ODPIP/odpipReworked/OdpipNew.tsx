import { useEffect, useState } from 'react';
import { Layout } from '../../../components/Layout';
import { checkBackendHealth, solveODPIP, type ODPIPResult } from '../../../services/odpipService';
import type { Workflow, WorkflowNode } from '../../../types';
import type { WorkflowRecord } from '../../../types/database';
import { WorkflowService } from '../../database/services/workflowService';
import { createSubsetValues2 } from './createPartValue';

interface CpNodeResult {
  cpNodeId: string;
  values: number[];
  goalValue: number;
  dependencyChain: WorkflowNode[];
  solverResult?: ODPIPResult | null;
  solverError?: string | null;
}

function ODPIP() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [dbWorkflows, setDbWorkflows] = useState<WorkflowRecord[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [cpNodeResults, setCpNodeResults] = useState<CpNodeResult[]>([]);
  const [showDescription, setShowDescription] = useState(false);
  const [solving, setSolving] = useState(false);
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
        const subsetValuesPerCpNode = createSubsetValues2(selectedWorkflow, false);
        setCpNodeResults(
          subsetValuesPerCpNode.map(entry => ({
            ...entry,
            solverResult: null,
            solverError: null,
          }))
        );
      } catch (error) {
        console.error(error);
      }
    }
  }, [selectedWorkflow]);

  const handleWorkflowSelect = async (workflowRecord: WorkflowRecord) => {
    const record = await WorkflowService.getWorkflow(workflowRecord.id);
    if (record) {
      setSelectedWorkflow(record.topology);
      setCpNodeResults([]);
    }
  };

  const handleSolveAll = async () => {
    if (cpNodeResults.length === 0) return;

    setSolving(true);

    const updated = [...cpNodeResults];
    for (let i = 0; i < updated.length; i++) {
      const entry = updated[i];
      try {
        const numOfAgents = Math.log2(entry.values.length);
        const result = await solveODPIP(numOfAgents, entry.values);
        updated[i] = { ...entry, solverResult: result, solverError: null };
      } catch (error) {
        updated[i] = {
          ...entry,
          solverResult: null,
          solverError: error instanceof Error ? error.message : 'Solver failed',
        };
      }
    }

    setCpNodeResults(updated);
    setSolving(false);
  };

  const getCpNodeName = (cpNodeId: string): string => {
    if (!selectedWorkflow) return cpNodeId;
    const task = selectedWorkflow.tasks.find(t => t.id === cpNodeId);
    return task ? task.name : cpNodeId;
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

        {/* Results per CP Node */}
        {selectedWorkflow && cpNodeResults.length > 0 && (
          <div className="space-y-6">
            <div className="flex justify-center gap-3 flex-wrap">
              <button
                onClick={handleSolveAll}
                disabled={solving || !backendAvailable}
                className={`px-5 py-2.5 text-white rounded-md transition-colors font-medium ${
                  solving || !backendAvailable
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {solving ? 'Solving...' : 'Solve All CP Nodes'}
              </button>
              <button
                onClick={() => setShowDescription(!showDescription)}
                className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors font-medium"
              >
                {showDescription ? 'Hide Details' : 'Show Details'}
              </button>
            </div>

            {cpNodeResults.map(entry => (
              <div key={entry.cpNodeId} className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-semibold mb-2">
                  CP Node: {getCpNodeName(entry.cpNodeId)}
                </h3>
                <p className="text-gray-600 mb-2">
                  Goal value (earliest start): {entry.goalValue.toFixed(2)}
                </p>
                <p className="text-gray-600 mb-4">
                  {entry.values.length} subsets ({Math.log2(entry.values.length)} dependency tasks)
                </p>

                {/* Solver Error */}
                {entry.solverError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4">
                    <p className="font-medium">Error</p>
                    <p className="text-sm">{entry.solverError}</p>
                  </div>
                )}

                {/* Solver Result */}
                {entry.solverResult && (
                  <div className="bg-gray-50 rounded-lg p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-800">Result</h4>
                      <span className="text-sm text-gray-400">{entry.solverResult.timeMs} ms</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-gray-500">Optimal value:</span>
                        <span className="text-lg font-semibold text-gray-800">
                          {typeof entry.solverResult.value === 'number'
                            ? entry.solverResult.value.toFixed(2)
                            : entry.solverResult.value}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Task groups:</span>
                        <p className="mt-1 text-gray-800">
                          {entry.solverResult.partition
                            .map(coalition => {
                              const taskNames = coalition.map(agentIdx => {
                                const node = entry.dependencyChain[agentIdx - 1];
                                return node ? node.name : `Agent ${agentIdx}`;
                              });
                              return `{${taskNames.join(', ')}}`;
                            })
                            .join(', ')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Detailed subset values */}
                {showDescription && (
                  <div className="mt-4 bg-gray-50 border border-gray-200 p-4 rounded-lg max-h-64 overflow-y-auto">
                    <h4 className="font-medium mb-2 text-gray-700">Subset Details</h4>
                    <pre className="text-sm whitespace-pre-wrap text-gray-600 font-mono">
                      {`Goal Value: ${entry.goalValue.toFixed(2)}\nDependency tasks: ${entry.dependencyChain.length}\nTotal subsets: ${entry.values.length}\n---\n` +
                        entry.values
                          .map((v, mask) => {
                            const n = entry.dependencyChain.length;
                            const binary = mask.toString(2).padStart(n, '0');
                            const subsetNames = entry.dependencyChain
                              .filter((_, i) => (mask & (1 << i)) !== 0)
                              .map(node => node.name);
                            const names =
                              subsetNames.length > 0 ? `{${subsetNames.join(', ')}}` : '{}';
                            const execTime = entry.dependencyChain
                              .filter((_, i) => (mask & (1 << i)) !== 0)
                              .reduce((sum, node) => sum + (node.executionTime ?? 0), 0);
                            return `[${mask}] ${binary} = ${names}\n    Exec time: ${execTime.toFixed(2)}, Value: ${v}`;
                          })
                          .join('\n')}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default ODPIP;
