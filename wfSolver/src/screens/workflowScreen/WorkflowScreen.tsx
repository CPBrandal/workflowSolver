import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WorkflowService } from '../../screens/database/services/workflowService';
import type { LocationState, Worker, Workflow } from '../../types';
import {
  analyzeCriticalPath,
  getCriticalPath,
  getMinimumProjectDuration,
  setCriticalPathEdgesTransferTimes,
} from '../../utils/criticalPathAnalyzer';
import VisualWorkflow from './VisualWorkflow';
import { InputFileHandler } from './utils/InputFileHandler';

function WorkflowScreen() {
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as LocationState | null;
  const file = state?.file;
  const generatedNodes = state?.generatedNodes;
  const workflowType = state?.workflowType;

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [numberOfSimulations, setNumberOfSimulations] = useState<number>(10);

  {
    /* Critical path */
  }
  useEffect(() => {
    if (workflow?.tasks && workflow.tasks.length > 0) {
      console.log('=== Performing Critical Path Analysis ===');

      const criticalPath = getCriticalPath(workflow.tasks);
      console.log(
        'Critical path:',
        criticalPath.map(n => n.name)
      );

      const minimumDuration = getMinimumProjectDuration(workflow.tasks);
      console.log('The minimum time the project will take is: ', minimumDuration, ' seconds');

      const cpResult = analyzeCriticalPath(workflow.tasks);

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

  // Initial Workflow Processing Effect
  useEffect(() => {
    const processWorkflow = async () => {
      try {
        setLoading(true);
        setError(null);

        if (
          generatedNodes &&
          (workflowType === 'arbitrary' || ['workflow', 'preset'].includes(workflowType || ''))
        ) {
          const generatorName =
            workflowType === 'workflow'
              ? 'Workflow-Optimized'
              : workflowType === 'preset'
                ? 'Preset Configuration'
                : state?.layout || 'arbitrary';

          setWorkflow({
            name: generatorName,
            tasks: generatedNodes,
            criticalPath: [],
            info: `Generated ${generatorName} workflow with ${state?.nodeCount || generatedNodes.length} nodes`,
          });
          setLoading(false);
          return;
        }

        if (file) {
          // Handle uploaded file
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

        // No workflow data provided - redirect to home with a message
        console.warn('No workflow data provided, redirecting to home screen');
        setTimeout(() => {
          navigate('/', {
            state: {
              message: 'Please upload a workflow file or create a custom workflow to continue.',
            },
          });
        }, 100);
      } catch (err) {
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

    const workflowId = await WorkflowService.saveWorkflowTopology(
      workflow,
      state?.gammaParams || { shape: 10, scale: 0.5 }, // Your gamma params
      undefined,
      ['test-save'] // Tags
    );

    if (workflowId) {
      console.log('Saved! Workflow ID:', workflowId);
      alert(`Workflow saved! ID: ${workflowId}`);
    } else {
      console.error('Failed to save');
      alert('Failed to save workflow');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {['workflow', 'preset'].includes(workflowType || '')
              ? 'Generating workflow...'
              : 'Processing workflow...'}
          </p>
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
    <div>
      {workflow.info && (
        <div className="max-w mx-auto px-6 pt-6 flex flex-col md:flex-row md:justify-between items-start md:items-center">
          <button
            onClick={() => navigate('/')}
            className="px-4 bg-gray-600 py-2 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Go Back Home
          </button>
          <div className="px-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm font-medium">{workflow.info}</p>
          </div>
        </div>
      )}
      <VisualWorkflow
        nodes={workflow.tasks}
        workers={workers}
        onWorkersUpdate={setWorkers}
        cpmAnalysis={workflow.criticalPathResult || null}
      />
      <div>
        <label
          htmlFor="numberOfSimulations"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Number of Simulations
        </label>
        <input
          id="numberOfSimulations"
          type="number"
          min="0.1"
          max="100"
          step="0.5"
          value={numberOfSimulations}
          onChange={e => {
            const value = e.target.valueAsNumber;
            // Only update if the value is a valid number
            if (!isNaN(value)) {
              setNumberOfSimulations(value);
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="10"
        />
        <p className="text-xs text-gray-500 mt-1">
          Set number of simulations to run, uses different values for execution and transfer time
          for each simulation{' '}
        </p>
        <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
          Run {numberOfSimulations} Simulations
        </button>
        <button
          onClick={testSaveWorkflow}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          Test Save to Database
        </button>
      </div>
    </div>
  );
}

export default WorkflowScreen;
