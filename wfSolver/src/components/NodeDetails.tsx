import type { WorkflowNode } from "../types"

interface NodeDetailsProps{
    selectedNode: WorkflowNode;
}

export function NodeDetails ({selectedNode}: NodeDetailsProps) {
    return(
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-blue-800 mb-2">Node Details</h3>
          <div className="text-sm text-blue-700 space-y-1">
            <p><span className="font-medium">Name:</span> {selectedNode.name}</p>
            <p><span className="font-medium">Status:</span> 
              <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                selectedNode.status === 'completed' ? 'bg-green-200 text-green-800' :
                selectedNode.status === 'running' ? 'bg-blue-200 text-blue-800' :
                selectedNode.status === 'error' ? 'bg-red-200 text-red-800' :
                selectedNode.status === 'paused' ? 'bg-yellow-200 text-yellow-800' :
                'bg-gray-200 text-gray-800'
              }`}>
                {selectedNode.status}
              </span>
            </p>
            <p><span className="font-medium">Type:</span> {selectedNode.type}</p>
            {selectedNode.duration && (
              <p><span className="font-medium">Duration:</span> {selectedNode.duration}</p>
            )}
            {selectedNode.description && (
              <p><span className="font-medium">Description:</span> {selectedNode.description}</p>
            )}
            <p><span className="font-medium">Connections:</span> {selectedNode.connections.length} outgoing</p>
          </div>
        </div>
    )
}