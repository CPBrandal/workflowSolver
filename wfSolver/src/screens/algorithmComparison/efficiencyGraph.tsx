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

// Define custom tooltip props
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
  const validWorkers = [1, 2, 3, 4, 5, 10];
  const workflowId = '01473911-ec10-4772-8ffa-2dd42ee5dee5';

  const [distributionData, setDistributionData] = useState<RDistributionPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await AlgorithComparisonController.getRDistributionForWorkers({
          workflowId,
          workerCounts: validWorkers,
        });
        setDistributionData(data);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load distribution data';
        setError(errorMessage);
        console.error('Error loading R distribution:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [workflowId]);

  // Transform data for line chart (each worker count is a point with p10, p50, p90)
  const lineChartData = distributionData.map(row => ({
    workers: row.workerCount,
    p10: row.p10,
    p50: row.p50,
    p90: row.p90,
  }));

  // Custom Tooltip Component
  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length > 0) {
      return (
        <div className="bg-white p-2.5 border border-gray-300 rounded shadow-md">
          <p className="my-1 font-bold">Workers: {label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="my-1" style={{ color: entry.color }}>
              <strong>{entry.name}:</strong> {entry.value.toFixed(3)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <div className="p-5">Loading distribution data...</div>;
  }

  if (error) {
    return <div className="p-5 text-red-600">Error: {error}</div>;
  }

  if (distributionData.length === 0) {
    return <div className="p-5">No distribution data available</div>;
  }

  return (
    <Layout>
      <div className="p-5 w-full flex flex-col items-center">
        <div className="w-4/5 max-w-7xl">
          <h2 className="text-2xl font-bold mb-2">R Distribution by Worker Count</h2>
          <p className="text-gray-600 mb-5">80% of simulations fall between P10 and P90</p>

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
                  domain={['dataMin - 0.1', 'dataMax + 0.1']}
                />

                <Tooltip content={CustomTooltip} />

                {/* P10 Line - Bottom of 80% */}
                <Line
                  type="monotone"
                  dataKey="p10"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="P10 (Bottom 80%)"
                  dot={{ r: 5 }}
                  activeDot={{ r: 7 }}
                />

                {/* P50 Line - Median */}
                <Line
                  type="monotone"
                  dataKey="p50"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="P50 (Median)"
                  dot={{ r: 5 }}
                  activeDot={{ r: 7 }}
                />

                {/* P90 Line - Top of 80% */}
                <Line
                  type="monotone"
                  dataKey="p90"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="P90 (Top 80%)"
                  dot={{ r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Table */}
          <div className="mt-10">
            <h3 className="text-xl font-bold mb-2">Distribution Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-100">
                    <th className="p-3 text-left">Workers</th>
                    <th className="p-3 text-right">P10</th>
                    <th className="p-3 text-right">P50</th>
                    <th className="p-3 text-right">P90</th>
                    <th className="p-3 text-right">80% Spread</th>
                    <th className="p-3 text-right">Simulations</th>
                  </tr>
                </thead>
                <tbody>
                  {distributionData.map(row => (
                    <tr key={row.workerCount} className="border-b border-gray-200">
                      <td className="p-3">{row.workerCount}</td>
                      <td className="p-3 text-right text-blue-500 font-medium">
                        {row.p10.toFixed(3)}
                      </td>
                      <td className="p-3 text-right text-green-500 font-medium">
                        {row.p50.toFixed(3)}
                      </td>
                      <td className="p-3 text-right text-red-500 font-medium">
                        {row.p90.toFixed(3)}
                      </td>
                      <td className="p-3 text-right font-medium">{row.spread.toFixed(3)}</td>
                      <td className="p-3 text-right">{row.simulationCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
