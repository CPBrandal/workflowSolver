import type { WorkflowNode } from "../../../types";
import { getWorkflowProgress } from "../utils/GetWorkflowProgress";

interface WorkflowProgressProps {
  nodes: WorkflowNode[];
}

function WorkflowProgress({ nodes }: WorkflowProgressProps) {
  return (
    <div className="mb-6">
      <div className="flex justify-between text-sm text-gray-600 mb-1">
        <span>Progress</span>
        <span>{getWorkflowProgress(nodes)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${getWorkflowProgress(nodes)}%` }}
        ></div>
      </div>
    </div>
  );
}

export default WorkflowProgress;