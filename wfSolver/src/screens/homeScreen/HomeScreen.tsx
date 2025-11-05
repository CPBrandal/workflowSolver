import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { TOPOLOGY_TYPES, type TopologyType } from '../../constants/constants';
import type { LocationState } from '../../types';
import {
  createScientificWorkflowByType,
  scientificWorkflowMetadata,
  type ScientificWorkflowType,
} from '../../utils/scientificWorkflowPresets';
import {
  createWorkflowByType,
  workflowTypeMetadata,
  type WorkflowType,
} from '../../utils/workflowPresets';

function HomeScreen() {
  const navigate = useNavigate();
  const [uploadStatus, setUploadStatus] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showUploadOption, setShowUploadOption] = useState(false);

  // Generator selection
  const [generatorType, setGeneratorType] = useState<'probabilistic'>('probabilistic');
  const [workflowType, setWorkflowType] = useState<WorkflowType>('balanced');
  const [scientificWorkflowType, setScientificWorkflowType] =
    useState<ScientificWorkflowType>('montage');

  // Common parameters
  const [nodeCount, setNodeCount] = useState<number>(20);
  const [generatingWorkflow, setGeneratingWorkflow] = useState(false);
  const [chosenTopology, setChosenTopology] = useState<TopologyType>('arbitrary');

  // Legacy workflow generator parameters (only shown for legacy mode)
  const [maxWidth, setMaxWidth] = useState<number>(4);

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
    if (nodeCount < 1 || nodeCount > 200) {
      alert('Please enter a node count between 1 and 200');
      return;
    }
    setGeneratingWorkflow(true);
    try {
      let nodes;

      if (chosenTopology === 'arbitrary') {
        nodes = createWorkflowByType(nodeCount, workflowType);
      } else {
        nodes = createScientificWorkflowByType(nodeCount, scientificWorkflowType);
      }
      if (!nodes) {
        throw new Error('Failed to generate nodes');
      }

      setTimeout(() => {
        setGeneratingWorkflow(false);
        navigate('/workflow', {
          state: {
            generatedNodes: nodes,
            workflowType: generatorType === 'probabilistic' ? workflowType : 'legacy',
            nodeCount,
            generatorType,
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
        <div className="flex-1">
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
              <h2 className="text-2xl font-semibold mb-4 text-center">Generate Workflow</h2>
              <p className="text-gray-700 mb-6 text-center">
                Create realistic workflows using probabilistic generation or legacy deterministic
                methods.
              </p>

              <div className="mt-4 max-w-lg mx-auto p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1 mb-3">
                  <label className="text-sm font-medium text-gray-700">
                    Topology creation method
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Choose the method for creating workflow topology
                  </p>
                </div>
                <div className="flex gap-2">
                  {TOPOLOGY_TYPES.map(topology => (
                    <button
                      key={topology}
                      type="button"
                      onClick={() => setChosenTopology(topology)}
                      className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        chosenTopology === topology
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {topology}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6 max-w-lg mx-auto">
                <h3 className="text-lg font-medium text-gray-800 border-b pb-2">Workflow Type</h3>
                {chosenTopology === 'arbitrary' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                      {(Object.keys(workflowTypeMetadata) as WorkflowType[]).map(type => {
                        const metadata = workflowTypeMetadata[type];
                        return (
                          <label
                            key={type}
                            className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="radio"
                              name="workflowType"
                              value={type}
                              checked={workflowType === type}
                              onChange={e => setWorkflowType(e.target.value as WorkflowType)}
                              className="text-blue-600 focus:ring-blue-500 mt-1"
                            />
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">{metadata.icon}</span>
                                <span className="text-sm font-medium text-gray-700">
                                  {metadata.name}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">{metadata.description}</p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {metadata.characteristics.map((char, idx) => (
                                  <span
                                    key={idx}
                                    className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                                  >
                                    {char}
                                  </span>
                                ))}
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                <strong>Best for:</strong> {metadata.bestFor}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                {chosenTopology === 'scientific' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                      {(Object.keys(scientificWorkflowMetadata) as ScientificWorkflowType[]).map(
                        type => {
                          const metadata = scientificWorkflowMetadata[type];
                          return (
                            <label
                              key={type}
                              className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="radio"
                                name="scientificWorkflowType"
                                value={type}
                                checked={scientificWorkflowType === type}
                                onChange={e =>
                                  setScientificWorkflowType(
                                    e.target.value as ScientificWorkflowType
                                  )
                                }
                                className="text-blue-600 focus:ring-blue-500 mt-1"
                              />
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className="text-lg">{metadata.icon}</span>
                                  <span className="text-sm font-medium text-gray-700">
                                    {metadata.name}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{metadata.description}</p>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {metadata.characteristics.map((char, idx) => (
                                    <span
                                      key={idx}
                                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                                    >
                                      {char}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </label>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
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
                  <button
                    onClick={handleCreateArbitraryWorkflow}
                    disabled={generatingWorkflow || nodeCount < 1 || nodeCount > 200}
                    className={`w-full px-5 py-2.5 text-white border-0 rounded cursor-pointer transition-colors ${
                      !generatingWorkflow && nodeCount >= 1 && nodeCount <= 200
                        ? 'bg-green-500 hover:bg-green-600'
                        : 'bg-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {generatingWorkflow
                      ? 'Generating Workflow...'
                      : `Generate ${nodeCount}-Task ${generatorType === 'probabilistic' ? workflowTypeMetadata[workflowType].name : 'Legacy'} Workflow`}
                  </button>
                </div>
              </div>

              <div className="text-center text-sm text-gray-500 mt-6">
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
      </div>
    </Layout>
  );
}

export default HomeScreen;
