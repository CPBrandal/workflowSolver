import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import VisualWorkflow from "./VisualWorkflow";
import { InputFileHandler } from './utils/InputFileHandler';
import type { WorkflowNode } from '../../types';

function WorkflowScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const file = location.state?.file as File | null;
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processFile = async () => {
      if (!file) {
        setError('No file provided.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const parsedNodes = await InputFileHandler(file);
        setNodes(parsedNodes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process workflow file');
      } finally {
        setLoading(false);
      }
    };

    processFile();
  }, [file]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Processing workflow file...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error Processing File</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return <VisualWorkflow nodes={nodes} />;
}

export default WorkflowScreen;
