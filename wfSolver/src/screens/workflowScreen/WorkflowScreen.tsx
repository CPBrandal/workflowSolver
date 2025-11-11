import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { WorkflowService } from '../../screens/database/services/workflowService';
import type { LocationState, Worker, Workflow } from '../../types';
import {
  analyzeCriticalPath,
  getMinimumProjectDuration,
  setCriticalPathEdgesTransferTimes,
} from '../../utils/criticalPathAnalyzer';
import { workflowTypeMetadata } from '../../utils/workflowPresets';
import VisualWorkflow from './VisualWorkflow';
import { InputFileHandler } from './utils/InputFileHandler';

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
  {
    /* Critical path */
  }
  useEffect(() => {
    if (workflow?.tasks && workflow.tasks.length > 0) {
      console.log('=== Performing Critical Path Analysis ===');
      const minimumDuration = getMinimumProjectDuration(workflow.tasks);
      console.log('The minimum time the project will take is: ', minimumDuration, ' seconds');

      const cpResult = analyzeCriticalPath(workflow.tasks, false);

      console.log(
        'Critical path sequence:',
        cpResult.orderedCriticalPath.map(n => n.name)
      );

      // Update nodes with critical path information
      const updatedTasks = workflow.tasks.map(task => {
        const isOnCriticalPath = cpResult.orderedCriticalPath.some(n => n.id === task.id);
        return { ...task, criticalPath: isOnCriticalPath };
      });

      setCriticalPathEdgesTransferTimes(updatedTasks);

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

  // Initial Workflow Processing Effect
  useEffect(() => {
    const processWorkflow = async () => {
      try {
        setLoading(true);
        setError(null);

        // Handle generated workflows (new system)
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
      <div>
        <VisualWorkflow
          nodes={workflow.tasks}
          workers={workers}
          onWorkersUpdate={setWorkers}
          cpmAnalysis={workflow.criticalPathResult || null}
        />
        <div className="max-w-4xl mx-auto p-6 space-y-4">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <button
              onClick={testSaveWorkflow}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Save to Database
            </button>{' '}
          </div>

          {/* Workflow Info Panel */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-2">Workflow Information</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Type:</span>
                <div className="font-medium">{getWorkflowDisplayName()}</div>
              </div>
              <div>
                <span className="text-gray-600">Tasks:</span>
                <div className="font-medium">{workflow.tasks.length}</div>
              </div>
              <div>
                <span className="text-gray-600">Generation:</span>
                <div className="font-medium capitalize">{workflowType || 'Unknown'}</div>
              </div>
              <div>
                <span className="text-gray-600">Critical Path:</span>
                <div className="font-medium">{workflow.criticalPath?.length || 0} tasks</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default WorkflowScreen;
