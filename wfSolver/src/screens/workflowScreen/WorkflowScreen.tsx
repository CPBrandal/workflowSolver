import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LocationState, Worker, WorkflowNode } from '../../types';
import {
  CriticalPathAnalyzer,
  getCriticalPath,
  getProjectDuration,
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

  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflowInfo, setWorkflowInfo] = useState<string>('');
  const [workers, setWorkers] = useState<Worker[]>([]);

  useEffect(() => {
    if (nodes.length > 0) {
      console.log('=== Performing Critical Path Analysis ===');

      // Simple utility functions
      const criticalPath = getCriticalPath(nodes);
      console.log(
        'Critical path:',
        criticalPath.map(n => n.name)
      );

      // Get project duration
      const duration = getProjectDuration(nodes);
      console.log('The minimum time the project will take is: ', duration, ' seconds');

      // Full analysis with detailed results
      const analyzer = new CriticalPathAnalyzer(nodes);
      const result = analyzer.analyze();

      console.log('Critical path nodes:', result.criticalPath.length);
      console.log('Total duration:', result.minimumProjectDuration);
      console.log(
        'Critical path sequence:',
        result.orderedCriticalPath.map(n => n.name)
      );

      const orderedCriticalPath = result.orderedCriticalPath;
      for (const node of orderedCriticalPath) {
        const criticalNode = nodes.find(n => n.id === node.id);
        if (criticalNode) {
          criticalNode.criticalPath = true;
        }
      }
    }
  }, [nodes]);

  useEffect(() => {
    if (nodes.length > 0) {
      const workerCount = nodes.length + 1;
      const newWorkers: Worker[] = [];

      for (let i = 0; i < workerCount; i++) {
        newWorkers.push({
          id: `worker-${i + 1}`,
          time: 0,
          isActive: false,
          currentTask: null,
        });
      }

      setWorkers(newWorkers);
      console.log(`Created ${workerCount} workers for ${nodes.length} tasks`);
    }
  }, [nodes]);

  useEffect(() => {
    const processWorkflow = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if we have generated nodes from arbitrary workflow creation
        if (
          generatedNodes &&
          (workflowType === 'arbitrary' || ['workflow', 'preset'].includes(workflowType || ''))
        ) {
          // Handle generated workflow
          setNodes(generatedNodes);
          const generatorName =
            workflowType === 'workflow'
              ? 'Workflow-Optimized'
              : workflowType === 'preset'
                ? 'Preset Configuration'
                : state?.layout || 'arbitrary';
          setWorkflowInfo(
            `Generated ${generatorName} workflow with ${state?.nodeCount || generatedNodes.length} nodes`
          );
          setLoading(false);
          return;
        }

        if (file) {
          // Handle uploaded file
          const parsedNodes = await InputFileHandler(file);
          setNodes(parsedNodes);
          setWorkflowInfo(`Loaded workflow from: ${file.name}`);
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

  return (
    <div>
      {workflowInfo && (
        <div className="max-w mx-auto px-6 pt-6 flex flex-col md:flex-row md:justify-between items-start md:items-center">
          <button
            onClick={() => navigate('/')}
            className="px-4 bg-gray-600 py-2 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Go Back Home
          </button>
          <div className="px-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm font-medium">{workflowInfo}</p>
          </div>
        </div>
      )}
      <VisualWorkflow nodes={nodes} workers={workers} onWorkersUpdate={setWorkers} />
    </div>
  );
}

export default WorkflowScreen;
