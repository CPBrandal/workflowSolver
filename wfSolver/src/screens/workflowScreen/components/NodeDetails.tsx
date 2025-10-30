import type { WorkflowNode } from '../../../types';

interface NodeDetailsProps {
  selectedNode: WorkflowNode;
}

export function NodeDetails({ selectedNode }: NodeDetailsProps) {
  const connections = selectedNode.connections;
  return (
    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <h3 className="font-semibold text-blue-800 mb-2">Node Details</h3>
      <div className="text-sm text-blue-700 space-y-1">
        <p>
          <span className="font-medium">Name:</span> {selectedNode.name}
        </p>
        <p>
          <span className="font-medium">Status:</span>
          <span
            className={`ml-2 px-2 py-1 rounded-full text-xs ${
              selectedNode.status === 'completed'
                ? 'bg-green-200 text-green-800'
                : selectedNode.status === 'running'
                  ? 'bg-blue-200 text-blue-800'
                  : 'bg-gray-200 text-gray-800'
            }`}
          >
            {selectedNode.status}
          </span>
        </p>
        {selectedNode.executionTime && (
          <p>
            <span className="font-medium">Duration:</span> {selectedNode.executionTime}
          </p>
        )}
        {selectedNode.description && (
          <p>
            <span className="font-medium">Description:</span> {selectedNode.description}
          </p>
        )}
        <p className="font-medium">Connections:</p>
        <ul>
          {connections.map(connection => (
            <li key={connection.label}>
              {connection.label} : {connection.transferTime}
            </li>
          ))}
        </ul>
        <p>
          <span className="font-medium">Assigned worker:</span> {selectedNode.assignedWorker}
        </p>
        <p>
          <span className="font-medium">Node level:</span> {selectedNode.level}
        </p>
        <p>
          <span className="font-medium">Critical path:</span>{' '}
          {selectedNode.criticalPath ? 'Critical' : 'Non-critical'}
        </p>
        <p>
          <span className="font-medium">Gamma parameters:</span>{' '}
          {selectedNode.gammaDistribution.scale && selectedNode.gammaDistribution.shape
            ? `Shape: ${selectedNode.gammaDistribution.shape}, Scale: ${selectedNode.gammaDistribution.scale}`
            : 'N/A'}
        </p>
      </div>
    </div>
  );
}
