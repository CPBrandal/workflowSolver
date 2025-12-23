import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Layout } from '../../components/Layout';
import { VALID_WORKERS } from '../../constants/constants';
import type { WorkflowRecord } from '../../types/database';
import { WorkflowService } from '../database/services/workflowService';
import {
  AlgorithComparisonController,
  type RDistributionPoint,
} from './AlgorithComparison.controller';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    name: string;
    color: string;
  }>;
  label?: string | number;
}

export function EfficiencyGraph() {
  const validWorkers = VALID_WORKERS;

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [savedWorkflows, setSavedWorkflows] = useState<WorkflowRecord[]>([]);

  const [greedyDistributionData, setGreedyDistributionData] = useState<RDistributionPoint[]>([]);
  const [cpGreedyDistributionData, setCpGreedyDistData] = useState<RDistributionPoint[]>([]);
  const [heftDistributionData, setHeftDistributionData] = useState<RDistributionPoint[]>([]);
  const [cpHeftDistributionData, setCpHeftDistributionData] = useState<RDistributionPoint[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const fetchData = async () => {
      if (!selectedWorkflowId) {
        setGreedyDistributionData([]);
        setHeftDistributionData([]);
        setCpHeftDistributionData([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        {
          /* Regular greedy algorithm */
        }
        const greedyData = await AlgorithComparisonController.getRDistributionForWorkersByAlgorithm(
          {
            workflowId: selectedWorkflowId,
            workerCounts: validWorkers,
            algorithm: 'greedy',
          }
        );
        setGreedyDistributionData(greedyData);

        {
          /* Critical path tuned greedy algorithm */
        }
        const cp_greedyData =
          await AlgorithComparisonController.getRDistributionForWorkersByAlgorithm({
            workflowId: selectedWorkflowId,
            workerCounts: validWorkers,
            algorithm: 'cp_greedy',
          });
        setCpGreedyDistData(cp_greedyData);

        {
          /* Critical path tuned greedy algorithm */
        }
        const heftData = await AlgorithComparisonController.getRDistributionForWorkersByAlgorithm({
          workflowId: selectedWorkflowId,
          workerCounts: validWorkers,
          algorithm: 'heft',
        });
        setHeftDistributionData(heftData);

        {
          /* Regular heft algorithm */
        }
        const cpHeftData = await AlgorithComparisonController.getRDistributionForWorkersByAlgorithm(
          {
            workflowId: selectedWorkflowId,
            workerCounts: validWorkers,
            algorithm: 'cp_heft',
          }
        );
        setCpHeftDistributionData(cpHeftData);
      } catch (error) {
        setError((error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedWorkflowId]);

  // Merge both datasets into one array for the chart
  const lineChartData = validWorkers.map(workerCount => {
    const greedyRow = greedyDistributionData.find(row => row.workerCount === workerCount);
    const cpGreedyRow = cpGreedyDistributionData.find(row => row.workerCount === workerCount);
    const heftRow = heftDistributionData.find(row => row.workerCount === workerCount);
    const cpHeftRow = cpHeftDistributionData.find(row => row.workerCount === workerCount);

    return {
      workers: workerCount,
      greedyP10: greedyRow?.p10,
      greedyP50: greedyRow?.p50,
      greedyP90: greedyRow?.p90,
      cpGreedyP10: cpGreedyRow?.p10,
      cpGreedyP50: cpGreedyRow?.p50,
      cpGreedyP90: cpGreedyRow?.p90,
      heftP10: heftRow?.p10,
      heftP50: heftRow?.p50,
      heftP90: heftRow?.p90,
      cpHeftP10: cpHeftRow?.p10,
      cpHeftP50: cpHeftRow?.p50,
      cpHeftP90: cpHeftRow?.p90,
    };
  });

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length > 0) {
      return (
        <div className="bg-white p-2.5 border border-gray-300 rounded shadow-md">
          <p className="my-1 font-bold">Workers: {label}</p>
          {payload
            .slice()
            .reverse()
            .map((entry, index) => (
              <p key={index} className="my-1" style={{ color: entry.color }}>
                <strong>{entry.name}:</strong> {entry.value?.toFixed(3) ?? 'N/A'}
              </p>
            ))}
        </div>
      );
    }
    return null;
  };

  // Don't show the full page loading state, show it inline instead
  const hasData =
    greedyDistributionData.length > 0 ||
    heftDistributionData.length > 0 ||
    cpHeftDistributionData.length > 0 ||
    cpGreedyDistributionData.length > 0;

  return (
    <Layout>
      <div className="p-5 w-full flex flex-col items-center">
        <div className="w-4/5 max-w-7xl text-center">
          <h2 className="text-2xl font-bold mb-6">
            R Distribution by Worker Count - Algorithm Comparison
          </h2>

          {/* Workflow Selector */}
          <div className="mb-8 max-w-2xl mx-auto">
            <label
              htmlFor="workflowSelect"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Select Workflow
            </label>
            {loadingWorkflows ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-gray-600 mt-2 text-sm">Loading workflows...</p>
              </div>
            ) : (
              <>
                <select
                  id="workflowSelect"
                  value={selectedWorkflowId}
                  onChange={e => setSelectedWorkflowId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              </>
            )}
          </div>

          {/* Loading Indicator */}
          {loading && selectedWorkflowId && (
            <div className="text-center py-4 mb-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-gray-600 mt-2 text-sm">Loading distribution data...</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-600">
              <p className="font-semibold">Error loading data:</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* No Workflow Selected Message */}
          {!selectedWorkflowId && !loading && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md text-blue-600">
              <p>Please select a workflow to view the algorithm comparison.</p>
            </div>
          )}

          {/* Chart - Only show if workflow is selected and has data */}
          {selectedWorkflowId && hasData && (
            <div className="w-full h-[50vh]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={lineChartData}
                  margin={{ top: 20, right: 30, bottom: 20, left: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis
                    dataKey="workers"
                    name="Number of Workers"
                    label={{
                      value: 'Number of Workers',
                      position: 'insideBottom',
                      offset: -10,
                    }}
                    ticks={validWorkers}
                  />

                  <YAxis
                    label={{
                      value: 'R (Actual/Theoretical Runtime)',
                      angle: -90,
                      position: 'insideLeft',
                    }}
                    domain={[1, 'dataMax']}
                  />

                  <Tooltip content={CustomTooltip} />

                  {/* Greedy Lines - Blue shades */}
                  <Line
                    type="monotone"
                    dataKey="greedyP10"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    name="Greedy P10"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="greedyP50"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Greedy P50"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="greedyP90"
                    stroke="#1e40af"
                    strokeWidth={2}
                    name="Greedy P90"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />

                  {/* HEFT Lines - Orange/Red shades */}
                  <Line
                    type="monotone"
                    dataKey="cpGreedyP10"
                    stroke="#a78bfa" // violet-400
                    strokeWidth={2}
                    name="CP_Greedy P10"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    strokeDasharray="5 5"
                  />

                  <Line
                    type="monotone"
                    dataKey="cpGreedyP50"
                    stroke="#8b5cf6" // violet-500
                    strokeWidth={2}
                    name="CP_Greedy P50"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    strokeDasharray="5 5"
                  />

                  <Line
                    type="monotone"
                    dataKey="cpGreedyP90"
                    stroke="#5b21b6" // violet-800
                    strokeWidth={2}
                    name="CP_Greedy P90"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    strokeDasharray="5 5"
                  />

                  {/* HEFT Lines - Orange/Red shades */}
                  <Line
                    type="monotone"
                    dataKey="heftP10"
                    stroke="#fb923c"
                    strokeWidth={2}
                    name="HEFT P10"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    strokeDasharray="5 5"
                  />

                  <Line
                    type="monotone"
                    dataKey="heftP50"
                    stroke="#f97316"
                    strokeWidth={2}
                    name="HEFT P50"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    strokeDasharray="5 5"
                  />

                  <Line
                    type="monotone"
                    dataKey="heftP90"
                    stroke="#c2410c"
                    strokeWidth={2}
                    name="HEFT P90"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    strokeDasharray="5 5"
                  />
                  {/* CP_HEFT Lines - Green shades */}
                  <Line
                    type="monotone"
                    dataKey="cpHeftP10"
                    stroke="#34d399"
                    strokeWidth={2}
                    name="CP_HEFT P10"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    strokeDasharray="2 2"
                  />

                  <Line
                    type="monotone"
                    dataKey="cpHeftP50"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="CP_HEFT P50"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    strokeDasharray="2 2"
                  />

                  <Line
                    type="monotone"
                    dataKey="cpHeftP90"
                    stroke="#047857"
                    strokeWidth={2}
                    name="CP_HEFT P90"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    strokeDasharray="2 2"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* No Data Message */}
          {selectedWorkflowId && !loading && !hasData && !error && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-600">
              <p>No distribution data available for the selected workflow.</p>
            </div>
          )}

          {/* Summary Tables */}
          {hasData && (
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Greedy Table */}
              <div>
                <h3 className="text-xl font-bold mb-2 text-blue-600">Greedy Algorithm</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-gray-300 bg-blue-50">
                        <th className="p-3 text-left">Workers</th>
                        <th className="p-3 text-right">P10</th>
                        <th className="p-3 text-right">P50</th>
                        <th className="p-3 text-right">P90</th>
                        <th className="p-3 text-right">Spread</th>
                      </tr>
                    </thead>
                    <tbody>
                      {greedyDistributionData.map(row => (
                        <tr key={row.workerCount} className="border-b border-gray-200">
                          <td className="p-3">{row.workerCount}</td>
                          <td className="p-3 text-right font-medium" style={{ color: '#60a5fa' }}>
                            {row.p10.toFixed(3)}
                          </td>
                          <td className="p-3 text-right font-medium" style={{ color: '#3b82f6' }}>
                            {row.p50.toFixed(3)}
                          </td>
                          <td className="p-3 text-right font-medium" style={{ color: '#1e40af' }}>
                            {row.p90.toFixed(3)}
                          </td>
                          <td className="p-3 text-right font-medium">{row.spread.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CP greedy Table */}
              <div>
                <h3 className="text-xl font-bold mb-2 text-purple-600">
                  Critical Path Greedy Algorithm
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-gray-300 bg-purple-50">
                        <th className="p-3 text-left">Workers</th>
                        <th className="p-3 text-right">P10</th>
                        <th className="p-3 text-right">P50</th>
                        <th className="p-3 text-right">P90</th>
                        <th className="p-3 text-right">Spread</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cpGreedyDistributionData.map(row => (
                        <tr key={row.workerCount} className="border-b border-gray-200">
                          <td className="p-3">{row.workerCount}</td>
                          <td className="p-3 text-right font-medium" style={{ color: '#60a5fa' }}>
                            {row.p10.toFixed(3)}
                          </td>
                          <td className="p-3 text-right font-medium" style={{ color: '#3b82f6' }}>
                            {row.p50.toFixed(3)}
                          </td>
                          <td className="p-3 text-right font-medium" style={{ color: '#1e40af' }}>
                            {row.p90.toFixed(3)}
                          </td>
                          <td className="p-3 text-right font-medium">{row.spread.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* HEFT Table */}
              <div>
                <h3 className="text-xl font-bold mb-2 text-orange-600">HEFT Algorithm</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-gray-300 bg-orange-50">
                        <th className="p-3 text-left">Workers</th>
                        <th className="p-3 text-right">P10</th>
                        <th className="p-3 text-right">P50</th>
                        <th className="p-3 text-right">P90</th>
                        <th className="p-3 text-right">Spread</th>
                      </tr>
                    </thead>
                    <tbody>
                      {heftDistributionData.map(row => (
                        <tr key={row.workerCount} className="border-b border-gray-200">
                          <td className="p-3">{row.workerCount}</td>
                          <td className="p-3 text-right font-medium" style={{ color: '#fb923c' }}>
                            {row.p10.toFixed(3)}
                          </td>
                          <td className="p-3 text-right font-medium" style={{ color: '#f97316' }}>
                            {row.p50.toFixed(3)}
                          </td>
                          <td className="p-3 text-right font-medium" style={{ color: '#c2410c' }}>
                            {row.p90.toFixed(3)}
                          </td>
                          <td className="p-3 text-right font-medium">{row.spread.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* CP HEFT Table */}
              <div>
                <h3 className="text-xl font-bold mb-2 text-green-600">CP_HEFT Algorithm</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-gray-300 bg-green-50">
                        <th className="p-3 text-left">Workers</th>
                        <th className="p-3 text-right">P10</th>
                        <th className="p-3 text-right">P50</th>
                        <th className="p-3 text-right">P90</th>
                        <th className="p-3 text-right">Spread</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cpHeftDistributionData.map(row => (
                        <tr key={row.workerCount} className="border-b border-gray-200">
                          <td className="p-3">{row.workerCount}</td>
                          <td className="p-3 text-right font-medium" style={{ color: '#34d399' }}>
                            {row.p10.toFixed(3)}
                          </td>
                          <td className="p-3 text-right font-medium" style={{ color: '#10b981' }}>
                            {row.p50.toFixed(3)}
                          </td>
                          <td className="p-3 text-right font-medium" style={{ color: '#047857' }}>
                            {row.p90.toFixed(3)}
                          </td>
                          <td className="p-3 text-right font-medium">{row.spread.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
