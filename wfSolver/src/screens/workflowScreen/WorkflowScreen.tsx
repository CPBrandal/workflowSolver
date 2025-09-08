import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import VisualWorkflow from "./VisualWorkflow";
import { InputFileHandler } from './utils/InputFileHandler';
import type { WorkflowNode } from '../../types';

interface LocationState {
  file?: File;
  generatedNodes?: WorkflowNode[];
  workflowType?: string;
  nodeCount?: number;
  layout?: string;
}

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

  useEffect(() => {
    const processWorkflow = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (generatedNodes && workflowType === 'arbitrary') {
          // Handle generated workflow
          setNodes(generatedNodes);
          setWorkflowInfo(`Generated ${state?.layout || 'linear'} workflow with ${state?.nodeCount || generatedNodes.length} nodes`);
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
              message: 'Please upload a workflow file or create a custom workflow to continue.' 
            } 
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
            {workflowType === 'arbitrary' ? 'Generating workflow...' : 'Processing workflow...'}
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
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
              Go Back Home
            </button>
            <button
              onClick={() => navigate('/test')}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors">
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
        <div className="max-w-5xl mx-auto px-6 pt-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-blue-800 text-sm font-medium">{workflowInfo}</p>
          </div>
        </div>
      )}
      <VisualWorkflow nodes={nodes} />
    </div>
  );
}

export default WorkflowScreen;