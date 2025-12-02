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
  const validWorkers = [2, 3, 4, 5];
  const workflowId = '01473911-ec10-4772-8ffa-2dd42ee5dee5';

  const [distributionData, setDistributionData] = useState<RDistributionPoint[]>([]);
  const [heftDistributionData, setHeftDistributionData] = useState<RDistributionPoint[]>([]);
  const [cpHeftDistributionData, setCpHeftDistributionData] = useState<RDistributionPoint[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const greedyData = await AlgorithComparisonController.getRDistributionForWorkersByAlgorithm(
          {
            workflowId,
            workerCounts: validWorkers,
            algorithm: 'greedy',
          }
        );
        setDistributionData(greedyData);
        const heftData = await AlgorithComparisonController.getRDistributionForWorkersByAlgorithm({
          workflowId,
          workerCounts: validWorkers,
          algorithm: 'heft',
        });

        setHeftDistributionData(heftData);
        const cpHeftData = await AlgorithComparisonController.getRDistributionForWorkersByAlgorithm(
          {
            workflowId,
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
  }, [workflowId]);

  // Merge both datasets into one array for the chart
  const lineChartData = validWorkers.map(workerCount => {
    const greedyRow = distributionData.find(row => row.workerCount === workerCount);
    const heftRow = heftDistributionData.find(row => row.workerCount === workerCount);
    const cpHeftRow = cpHeftDistributionData.find(row => row.workerCount === workerCount);

    return {
      workers: workerCount,
      greedyP10: greedyRow?.p10,
      greedyP50: greedyRow?.p50,
      greedyP90: greedyRow?.p90,
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

  if (loading) {
    return <div className="p-5 text-center">Loading distribution data...</div>;
  }

  if (error) {
    return <div className="p-5 text-red-600 text-center">Error: {error}</div>;
  }

  if (distributionData.length === 0 && heftDistributionData.length === 0) {
    return <div className="p-5 text-center">No distribution data available</div>;
  }

  return (
    <Layout>
      <div className="p-5 w-full flex flex-col items-center">
        <div className="w-4/5 max-w-7xl text-center">
          <h2 className="text-2xl font-bold mb-2">
            R Distribution by Worker Count - Algorithm Comparison
          </h2>
          <div className="w-full h-[50vh]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData} margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
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
                  domain={['1', 'dataMax + 0.5']}
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

          {/* Summary Tables */}
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
                    {distributionData.map(row => (
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
            {/* CP_HEFT Table */}
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
        </div>
      </div>
    </Layout>
  );
}
