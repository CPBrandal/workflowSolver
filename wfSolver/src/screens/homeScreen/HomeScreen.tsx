import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import type { GammaParams, LocationState } from '../../types';
import type { ArbitraryWorkflowConfig } from '../../utils/generateArbitraryWorkflow';
import {
  createComplexArbitraryWorkflow,
  generateArbitraryWorkflow,
} from '../../utils/generateArbitraryWorkflow';

function HomeScreen() {
  const navigate = useNavigate();
  const [uploadStatus, setUploadStatus] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showUploadOption, setShowUploadOption] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Generator selection
  const [generatorType, setGeneratorType] = useState<'workflow' | 'preset'>('workflow');

  // Common parameters
  const [nodeCount, setNodeCount] = useState<number>(10);
  const [generatingWorkflow, setGeneratingWorkflow] = useState(false);

  // Workflow generator parameters
  const [maxWidth, setMaxWidth] = useState<number>(4);
  const [edgeProbability, setEdgeProbability] = useState<number>(0.2);
  const [maxEdgeSpan, setMaxEdgeSpan] = useState<number>(1);
  const [singleSink, setSingleSink] = useState<boolean>(true);

  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const [gammaDistribution, setGammaDistribution] = useState<GammaParams>({
    shape: 10,
    scale: 0.5,
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
    if (!file) return setUploadStatus('');

    setUploadStatus(`Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
  };

  const handleUpload = () => {
    if (!selectedFile) return setUploadStatus('Please select a workflow file first');

    setUploadStatus('Processing workflow file...');

    setTimeout(() => {
      setUploadStatus(`Successfully processed workflow: ${selectedFile.name}`);
      setTimeout(() => {
        navigate('/workflow', { state: { file: selectedFile } });
      }, 500);
    }, 1000);
  };

  const handleCreateArbitraryWorkflow = () => {
    if (nodeCount < 1 || nodeCount > 50) {
      alert('Please enter a node count between 1 and 50');
      return;
    }

    if (generatorType === 'workflow') {
      if (maxWidth < 1 || maxWidth > nodeCount) {
        alert('Max width must be between 1 and the total node count');
        return;
      }

      if (edgeProbability < 0 || edgeProbability > 1) {
        alert('Edge probability must be between 0 and 1');
        return;
      }
    }

    setGeneratingWorkflow(true);

    try {
      let nodes;

      if (generatorType === 'preset') {
        nodes = createComplexArbitraryWorkflow(nodeCount);
      } else {
        const config: ArbitraryWorkflowConfig = {
          nodeCount,
          maxWidth,
          edgeProbability,
          maxEdgeSpan,
          singleSink,
          densityFactor: 0.6,
          gammaParams: gammaDistribution,
        };
        nodes = generateArbitraryWorkflow(config);
      }
      if (!nodes) {
        throw new Error('Failed to generate nodes');
      }

      setTimeout(() => {
        setGeneratingWorkflow(false);
        navigate('/workflow', {
          state: {
            generatedNodes: nodes,
            workflowType: generatorType,
            nodeCount,
            generatorType,
            gammaParams: gammaDistribution,
          } as LocationState,
        });
      }, 500);
    } catch (error) {
      setGeneratingWorkflow(false);
      alert(
        `Error generating workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  const handleNodeCountChange = (newNodeCount: number) => {
    setNodeCount(newNodeCount);
    const optimalWidth = Math.max(2, Math.ceil(Math.sqrt(newNodeCount)));
    setMaxWidth(Math.min(optimalWidth, 8));
  };

  const isSuccess = uploadStatus.includes('Successfully');

  return (
    <Layout>
      <div className="flex min-h-screen">
        {/* Main Content */}
        <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <div className="max-w-4xl mx-auto p-6 space-y-8">
            <h1 className="text-4xl font-bold text-center mb-8">Workflow Solver</h1>

            {/* Upload Workflow Section */}
            {showUploadOption && (
              <div className="bg-white rounded-lg shadow-lg p-8">
                <h2 className="text-2xl font-semibold mb-4 text-center">Upload Your Workflow</h2>
                <p className="text-gray-700 mb-6 text-center">
                  Select a workflow configuration file (YAML).
                </p>
                <div className="my-5 flex flex-col items-center space-y-4">
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    accept=".json,.yaml,.yml,.xml,.txt"
                    className="mb-2.5 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <button
                    onClick={handleUpload}
                    disabled={!selectedFile}
                    className={`px-5 py-2.5 text-white border-0 rounded cursor-pointer transition-colors ${
                      selectedFile
                        ? 'bg-indigo-500 hover:bg-indigo-600 cursor-pointer'
                        : 'bg-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {selectedFile ? 'Analyze Workflow' : 'Select File First'}
                  </button>
                </div>
                {uploadStatus && (
                  <div
                    className={`p-2.5 rounded border ${
                      isSuccess
                        ? 'bg-green-100 border-green-300 text-green-800'
                        : 'bg-red-100 border-red-300 text-red-800'
                    }`}
                  >
                    {uploadStatus}
                  </div>
                )}
                <p className="mt-5 text-sm text-gray-600 text-center">
                  Supported formats: YAML - Max file size: 10MB
                </p>
              </div>
            )}

            {/* Create Arbitrary Workflow Section */}
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-semibold mb-4 text-center">
                Generate Arbitrary Workflow
              </h2>
              <p className="text-gray-700 mb-6 text-center">
                Create a random workflow using different generation approaches for realistic
                workflow structures.
              </p>

              <div className="space-y-6 max-w-lg mx-auto">
                {/* Generator Type Selection */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-800 border-b pb-2">
                    Generator Type
                  </h3>

                  <div className="space-y-2">
                    <label className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="generatorType"
                        value="workflow"
                        checked={generatorType === 'workflow'}
                        onChange={e => setGeneratorType(e.target.value as 'workflow' | 'preset')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          Workflow-Optimized
                        </span>
                        <p className="text-xs text-gray-500">
                          Better visual layouts, guaranteed single sink
                        </p>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="generatorType"
                        value="preset"
                        checked={generatorType === 'preset'}
                        onChange={e => setGeneratorType(e.target.value as 'workflow' | 'preset')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          Preset Configurations
                        </span>
                        <p className="text-xs text-gray-500">
                          Pre-tuned settings for common use cases
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Basic Parameters */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-800 border-b pb-2">
                    Basic Parameters
                  </h3>

                  {/* Node Count Input */}
                  <div>
                    <label
                      htmlFor="nodeCount"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Number of Tasks
                    </label>
                    <input
                      id="nodeCount"
                      type="number"
                      min="1"
                      max="50"
                      value={nodeCount}
                      onChange={e => handleNodeCountChange(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter number of tasks (1-50)"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Total number of tasks in the workflow
                    </p>
                  </div>

                  {/* Workflow-specific parameters */}
                  {generatorType === 'workflow' && (
                    <div>
                      <label
                        htmlFor="maxWidth"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Maximum Parallelism Level
                      </label>
                      <input
                        id="maxWidth"
                        type="number"
                        min="1"
                        max={Math.min(nodeCount, 8)}
                        value={maxWidth}
                        onChange={e => setMaxWidth(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Maximum number of tasks that can run in parallel
                      </p>
                    </div>
                  )}
                </div>

                {/* Advanced Parameters for Workflow Generator */}
                {generatorType === 'workflow' && (
                  <div>
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center justify-between w-full px-4 py-2 text-left text-sm font-medium text-gray-700 bg-gray-50 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <span>Advanced Workflow Parameters</span>
                      <span
                        className={`transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                      >
                        ▼
                      </span>
                    </button>

                    {showAdvanced && (
                      <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-md">
                        <div>
                          <label
                            htmlFor="edgeProbability"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Edge Probability: {edgeProbability.toFixed(2)}
                          </label>
                          <input
                            id="edgeProbability"
                            type="range"
                            min="0.1"
                            max="0.9"
                            step="0.1"
                            value={edgeProbability}
                            onChange={e => setEdgeProbability(parseFloat(e.target.value))}
                            className="w-full"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Probability of creating dependencies between tasks
                          </p>
                        </div>

                        <div>
                          <label
                            htmlFor="maxEdgeSpan"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Maximum Edge Span
                          </label>
                          <select
                            id="maxEdgeSpan"
                            value={maxEdgeSpan}
                            onChange={e => setMaxEdgeSpan(parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value={1}>1 - Direct connections only</option>
                            <option value={2}>2 - Skip one level</option>
                            <option value={3}>3 - Skip two levels</option>
                            <option value={4}>4 - Skip three levels</option>
                          </select>
                          <p className="text-xs text-gray-500 mt-1">
                            Maximum number of levels a dependency can span
                          </p>
                        </div>

                        <div>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={singleSink}
                              onChange={e => setSingleSink(e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">
                              Single End Task
                            </span>
                          </label>
                          <p className="text-xs text-gray-500 mt-1">
                            Create a single final task that all paths converge to
                          </p>
                        </div>

                        {/* Gamma Distribution Parameters */}
                        <div className="border-t pt-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">
                            Task Execution Time Distribution
                          </h4>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Shape Parameter */}
                            <div>
                              <label
                                htmlFor="gammaShape"
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                Shape (k): {gammaDistribution.shape}
                              </label>
                              <input
                                id="gammaShape"
                                type="number"
                                min="0.1"
                                max="10"
                                step="0.1"
                                value={gammaDistribution.shape}
                                onChange={e => {
                                  const value = Math.max(0.1, parseFloat(e.target.value) || 0.1);
                                  setGammaDistribution(prev => ({ ...prev, shape: value }));
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="0.7"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Controls distribution shape (must be &gt; 0)
                              </p>
                            </div>

                            {/* Scale Parameter */}
                            <div>
                              <label
                                htmlFor="gammaScale"
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                Scale (θ): {gammaDistribution.scale}
                              </label>
                              <input
                                id="gammaScale"
                                type="number"
                                min="0.1"
                                max="100"
                                step="0.5"
                                value={gammaDistribution.scale}
                                onChange={e => {
                                  const value = Math.max(0.1, parseFloat(e.target.value) || 0.1);
                                  setGammaDistribution(prev => ({ ...prev, scale: value }));
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="5"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Controls distribution spread (must be &gt; 0)
                              </p>
                            </div>
                          </div>

                          <p className="text-xs text-gray-500 mt-2">
                            Gamma distribution generates realistic task execution times. Lower shape
                            = more variable times, higher scale = longer average times.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Generation Info */}
                <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded-md">
                  <p className="font-medium mb-2">
                    {generatorType === 'workflow'
                      ? 'Workflow-Optimized Generation'
                      : 'Preset Configuration'}
                  </p>
                  {generatorType === 'workflow' && (
                    <p>
                      Creates a workflow structure with predictable layouts, guaranteed single
                      endpoints, and visual optimization. Used gamma distribution for task
                      durations, and transfer time between tasks.
                    </p>
                  )}
                  {generatorType === 'preset' && (
                    <p>
                      Uses pre-configured settings optimized for common workflow patterns and
                      research scenarios.
                    </p>
                  )}
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleCreateArbitraryWorkflow}
                  disabled={generatingWorkflow || nodeCount < 1 || nodeCount > 50}
                  className={`w-full px-5 py-2.5 text-white border-0 rounded cursor-pointer transition-colors ${
                    !generatingWorkflow && nodeCount >= 1 && nodeCount <= 50
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  {generatingWorkflow
                    ? 'Generating Workflow...'
                    : `Generate ${nodeCount}-Task ${generatorType === 'workflow' ? 'Workflow' : 'Preset'}`}
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-sm text-gray-500">
              <button
                className="bg-blue-400 hover:bg-blue-500 text-white px-4 py-2 rounded"
                onClick={() => setShowUploadOption(!showUploadOption)}
              >
                {showUploadOption ? 'Disable upload option' : 'Enable upload option'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default HomeScreen;
