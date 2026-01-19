import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { ALGORITHMS, type SchedulingAlgorithm } from '../../constants/constants';
import { WorkflowService } from '../../screens/database/services/workflowService';
import type { LocationState, Worker, Workflow } from '../../types';
import { analyzeCriticalPath, getMinimumProjectDuration } from '../../utils/criticalPathAnalyzer';
import { workflowTypeMetadata } from '../../utils/workflowPresets';
import { InputFileHandler } from './utils/InputFileHandler';
import VisualizeScheduler from './VisualizeScheduler';
import VisualWorkflow from './VisualWorkflow';

function WorkflowScreen() {
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as LocationState | null;
  const file = state?.file;
  const generatedNodes = state?.generatedNodes;
  const workflowType = state?.workflowType || 'complex';

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numberOfWorkers, setNumberOfWorkers] = useState<number>();
  const [runVisualization, setRunVisualization] = useState(false);
  const [chosenAlgorithm, setChosenAlgorithm] = useState<SchedulingAlgorithm>('Greedy');

  {
    /* Critical path */
  }
  useEffect(() => {
    if (workflow?.tasks && workflow.tasks.length > 0) {
      console.log('=== Performing Critical Path Analysis ===');
      const minimumDuration = getMinimumProjectDuration(workflow.tasks);
      console.log('The minimum time the project will take is: ', minimumDuration, ' seconds');

      const cpResult = analyzeCriticalPath(workflow.tasks);

      const updatedTasks = workflow.tasks.map(task => {
        const isOnCriticalPath = cpResult.orderedCriticalPath.some(n => n.id === task.id);
        return { ...task, criticalPath: isOnCriticalPath };
      });

      setWorkflow(prev =>
        prev
          ? {
              ...prev,
              tasks: updatedTasks,
              criticalPath: cpResult.orderedCriticalPath,
              criticalPathResult: cpResult,
            }
          : null
      );
    }
  }, [workflow?.tasks.length]);

  {
    /* Worker Initialization */
  }
  useEffect(() => {
    if (workflow?.tasks && workflow.tasks.length > 0) {
      const workerCount = workflow.tasks.length + 1;
      const newWorkers: Worker[] = [];

      for (let i = 0; i < workerCount; i++) {
        newWorkers.push({
          id: `worker-${i + 1}`,
          time: 0,
          isActive: false,
          currentTask: null,
          criticalPathWorker: i === 0,
        });
      }

      setWorkers(newWorkers);
      console.log(`Created ${workerCount} workers for ${workflow.tasks.length} tasks`);
    }
  }, [workflow?.tasks.length]);

  // Helper function to get display name for workflow type
  const getWorkflowDisplayName = () => {
    if (!workflowType) return 'Generated Workflow';
    return `${workflowTypeMetadata[workflowType].name} Workflow`;
  };

  // Helper function to get workflow description
  const getWorkflowDescription = () => {
    const nodeCount = state?.nodeCount || generatedNodes?.length || 0;
    return `Generated ${workflowTypeMetadata[workflowType].name.toLowerCase()} workflow with ${nodeCount} nodes.`;
  };

  useEffect(() => {
    const processWorkflow = async () => {
      try {
        setLoading(true);
        setError(null);

        if (generatedNodes) {
          setWorkflow({
            name: getWorkflowDisplayName(),
            tasks: generatedNodes,
            criticalPath: [],
            info: getWorkflowDescription(),
          });
          setLoading(false);
          return;
        }

        // Handle uploaded file
        if (file) {
          console.log('Processing uploaded file:', file.name);
          const parsedNodes = await InputFileHandler(file);
          setWorkflow({
            name: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
            tasks: parsedNodes,
            criticalPath: [],
            info: `Loaded workflow from: ${file.name}`,
          });
          setLoading(false);
          return;
        }

        // No valid workflow data provided - redirect to home with a message
        console.warn('No valid workflow data provided, redirecting to home screen');

        setTimeout(() => {
          navigate('/', {
            state: {
              message: 'Please upload a workflow file or create a custom workflow to continue.',
            },
          });
        }, 100);
      } catch (err) {
        console.error('Error processing workflow:', err);
        setError(err instanceof Error ? err.message : 'Failed to process workflow');
        setLoading(false);
      }
    };

    processWorkflow();
  }, [file, generatedNodes, workflowType, state, navigate]);

  const testSaveWorkflow = async () => {
    if (!workflow) {
      console.error('No workflow to save');
      return;
    }

    try {
      for(const task of workflow.tasks) {
        console.log(task.gammaDistribution);
      }
      const workflowId = await WorkflowService.saveWorkflowTopology(workflow, undefined, [
        workflowType || 'unknown',
      ]);

      if (workflowId) {
        console.log('Saved! Workflow ID:', workflowId);
        alert(`Workflow saved! ID: ${workflowId}`);
      } else {
        console.error('Failed to save');
        alert('Failed to save workflow');
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
      alert(
        'Failed to save workflow: ' + (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error Processing Workflow</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Go Back Home
            </button>
            <button
              onClick={() => navigate('/test')}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Try Test Workflow
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!workflow) {
    return null;
  }

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow-lg p-6 flex justify-between items-center">
        <div className="text-2xl font-bold text-gray-800">{getWorkflowDisplayName()}</div>
        <button
          onClick={testSaveWorkflow}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          Save to Database
        </button>
      </div>
      <div>
        <VisualWorkflow
          nodes={workflow.tasks}
          workers={workers}
          onWorkersUpdate={setWorkers}
          cpmAnalysis={workflow.criticalPathResult || null}
        />
      </div>
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Schedule Visualization</h3>

        <div className="space-y-4">
          {/* Algorithm Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scheduling Algorithm
            </label>
            <div className="flex flex-wrap gap-2">
              {ALGORITHMS.map(algorithm => (
                <button
                  key={algorithm}
                  onClick={() => {
                    setChosenAlgorithm(algorithm);
                    setRunVisualization(false);
                  }}
                  className={`px-4 py-2 rounded font-medium transition-colors ${
                    chosenAlgorithm === algorithm
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {algorithm.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Workers Input and Run Button */}
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Workers
              </label>
              <input
                type="text"
                value={numberOfWorkers ?? ''}
                onChange={e => setNumberOfWorkers(parseInt(e.target.value) || undefined)}
                placeholder="Enter number"
                className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={() => setRunVisualization(true)}
              className="mt-6 px-6 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 transition-colors"
            >
              Run Visualization
            </button>
          </div>
        </div>
      </div>

      {chosenAlgorithm && workers.length > 0 && workflow.criticalPathResult && runVisualization && (
        <div>
          <VisualizeScheduler
            workflow={workflow}
            scheduler={chosenAlgorithm}
            workers={workers.slice(0, numberOfWorkers ?? workers.length)}
          />
        </div>
      )}
    </Layout>
  );
}

export default WorkflowScreen;
