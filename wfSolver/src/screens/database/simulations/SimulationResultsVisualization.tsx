import { useEffect, useState } from 'react';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  SimulationAnalysisService,
  type SimulationAnalysis,
} from '../services/simulationAnalysisService';
import type { SchedulingAlgorithm } from '../../../constants/constants';

interface Props {
  workflowId: string;
  numberOfWorkers: number;
  algorithm: SchedulingAlgorithm;
}

export function SimulationResultsVisualization({ workflowId, numberOfWorkers, algorithm }: Props) {
  const [analysis, setAnalysis] = useState<SimulationAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'histogram' | 'ecdf' | 'scatter' | 'comparison'>(
    'histogram'
  );

  useEffect(() => {
    const loadAnalysis = async () => {
      setLoading(true);
      const data = await SimulationAnalysisService.analyzeWorkflowSimulations(
        workflowId,
        numberOfWorkers,
        algorithm
      );
      setAnalysis(data);
      setLoading(false);
    };

    if (workflowId && numberOfWorkers > 0) {
      loadAnalysis();
    }
  }, [workflowId, numberOfWorkers, algorithm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="ml-3 text-gray-600">Loading simulation results...</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No simulation data available.</p>
        <p className="text-sm mt-1">Run some simulations first to see results here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">Total Simulations</p>
          <p className="text-2xl font-bold text-blue-800">{analysis.totalSimulations}</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700">Mean r (T/T-)</p>
          <p className="text-2xl font-bold text-green-800">{analysis.ratioStats.mean.toFixed(3)}</p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-purple-700">Best r (min)</p>
          <p className="text-2xl font-bold text-purple-800">{analysis.ratioStats.min.toFixed(3)}</p>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="text-sm text-orange-700">Worst r (max)</p>
          <p className="text-2xl font-bold text-orange-800">{analysis.ratioStats.max.toFixed(3)}</p>
        </div>
      </div>

      {/* Ratio Statistics */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Efficiency Ratio Statistics (r = T / T-)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Mean:</p>
            <p className="font-semibold">{analysis.ratioStats.mean.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-gray-600">Median:</p>
            <p className="font-semibold">{analysis.ratioStats.median.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-gray-600">Std Dev:</p>
            <p className="font-semibold">{analysis.ratioStats.stdDev.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-gray-600">Range:</p>
            <p className="font-semibold">
              [{analysis.ratioStats.min.toFixed(3)}, {analysis.ratioStats.max.toFixed(3)}]
            </p>
          </div>
          <div>
            <p className="text-gray-600">25th Percentile:</p>
            <p className="font-semibold">{analysis.ratioStats.p25.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-gray-600">75th Percentile:</p>
            <p className="font-semibold">{analysis.ratioStats.p75.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-gray-600">95th Percentile:</p>
            <p className="font-semibold">{analysis.ratioStats.p95.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-gray-600">IQR:</p>
            <p className="font-semibold">
              {(analysis.ratioStats.p75 - analysis.ratioStats.p25).toFixed(4)}
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          r ≥ 1 indicates suboptimal execution due to worker constraints. Values closer to 1 show
          better efficiency.
        </p>
      </div>

      {/* View Mode Toggle */}
      <div className="flex justify-center gap-2 flex-wrap">
        <button
          onClick={() => setViewMode('histogram')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            viewMode === 'histogram'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Distribution (Histogram)
        </button>
        <button
          onClick={() => setViewMode('ecdf')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            viewMode === 'ecdf'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Cumulative Distribution (ECDF)
        </button>
        <button
          onClick={() => setViewMode('scatter')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            viewMode === 'scatter'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Scatter Plot
        </button>
        <button
          onClick={() => setViewMode('comparison')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            viewMode === 'comparison'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          T vs T- Comparison
        </button>
      </div>

      {viewMode === 'histogram' && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">
            Distribution of Efficiency Ratio r = T / T-
          </h3>
          <ResponsiveContainer width="100%" height={450}>
            <BarChart
              data={analysis.histogramData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              barCategoryGap={1} // Minimal gap between bars
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="binMid"
                label={{ value: 'Efficiency Ratio (r)', position: 'insideBottom', offset: -50 }}
                tickFormatter={(value: number) => value.toFixed(2)}
                interval={Math.floor(analysis.histogramData.length / 20)}
                angle={-45}
                textAnchor="end"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                label={{ value: 'Frequency', angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number) => [`Frequency: ${value.toFixed(4)}`, '']}
                labelFormatter={value => `r = ${Number(value).toFixed(3)}`}
                contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }}
              />
              <Bar dataKey="frequency" fill="#3b82f6" name="Frequency" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-sm text-gray-600 mt-4 text-center">
            Expected to follow Generalized Beta Prime distribution. Mean r ={' '}
            {analysis.ratioStats.mean.toFixed(3)}
          </p>
        </div>
      )}

      {viewMode === 'ecdf' && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">
            Empirical Cumulative Distribution Function (ECDF)
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={analysis.ecdfData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="ratio"
                label={{ value: 'r', position: 'insideBottom', offset: -5 }}
                domain={['dataMin', 'dataMax']}
              />
              <YAxis
                label={{ value: 'P(r ≤ x)', angle: -90, position: 'insideLeft' }}
                domain={[0, 1]}
              />
              <Tooltip
                formatter={(value: number) => value.toFixed(4)}
                labelFormatter={value => `r = ${Number(value).toFixed(3)}`}
              />
              <Line
                type="stepAfter"
                dataKey="probability"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Cumulative Probability"
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-sm text-gray-600 mt-4 text-center">
            Shows P(r ≤ x) for all observed efficiency ratios
          </p>
        </div>
      )}

      {viewMode === 'scatter' && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Efficiency Ratio Over Simulations</h3>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart
              margin={{
                top: 20,
                right: 20,
                bottom: 20,
                left: 20,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="simulationNumber"
                name="Simulation Number"
                label={{ value: 'Simulation Number', position: 'insideBottom', offset: -5 }}
                domain={['dataMin - 1', 'dataMax']}
              />
              <YAxis
                type="number"
                dataKey="ratio"
                name="Efficiency Ratio"
                label={{ value: 'r = T / T-', angle: -90, position: 'insideLeft' }}
                domain={['auto', 'auto']}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value: number) => value.toFixed(4)}
              />
              <Scatter name="r values" data={analysis.efficiencyData} fill="#3b82f6" />
            </ScatterChart>
          </ResponsiveContainer>
          <p className="text-sm text-gray-600 mt-4 text-center">
            Points show efficiency ratio (r = T / T-) for each simulation. Values above 1 show
            inefficiency from worker constraints.
          </p>
        </div>
      )}

      {viewMode === 'comparison' && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">T (Actual) vs T- (Theoretical)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={analysis.efficiencyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="simulationNumber"
                label={{ value: 'Simulation Number', position: 'insideBottom', offset: -5 }}
              />
              <YAxis label={{ value: 'Runtime (seconds)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="theoretical"
                stroke="#10b981"
                strokeWidth={2}
                name="T- (Theoretical)"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#3b82f6"
                strokeWidth={2}
                name="T (Actual)"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-sm text-gray-600 mt-4 text-center">
            Gap between lines represents overhead from worker constraints. Average gap:{' '}
            {analysis.avgTimeDifference.toFixed(2)}s
          </p>
        </div>
      )}
      {/* <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Theoretical Validation</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Expected Task Time E[t]:</p>
            <p className="font-semibold">
              {analysis.theoreticalValidation.expectedTaskTime.toFixed(3)}s
            </p>
            <p className="text-xs text-gray-500">
              shape × scale = {gammaParams.shape} × {gammaParams.scale}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Avg Critical Path Length:</p>
            <p className="font-semibold">
              {analysis.theoreticalValidation.avgCriticalPathLength.toFixed(2)} tasks
            </p>
            <p className="text-xs text-gray-500">Average N(j) across runs</p>
          </div>
          <div>
            <p className="text-gray-600">Observed Mean T(-):</p>
            <p className="font-semibold">
              {analysis.theoreticalValidation.observedMeanT.toFixed(3)}s
            </p>
          </div>
          <div>
            <p className="text-gray-600">Theoretical Mean T(-):</p>
            <p className="font-semibold">
              {analysis.theoreticalValidation.theoreticalMeanT.toFixed(3)}s
            </p>
            <p className="text-xs text-gray-500">E[t] × Avg N(j)</p>
          </div>
          <div className="col-span-2">
            <p className="text-gray-600">Validation Error:</p>
            <p
              className={`font-bold text-lg ${
                analysis.theoreticalValidation.percentError < 5 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {analysis.theoreticalValidation.percentError.toFixed(2)}%
            </p>
            <p className="text-xs text-gray-500">
              {analysis.theoreticalValidation.percentError < 5
                ? '✓ Implementation validated'
                : '⚠ Check implementation - error should be < 5%'}
            </p>
          </div>
        </div>
      </div> */}
    </div>
  );
}
