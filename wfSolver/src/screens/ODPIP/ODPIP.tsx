import { useEffect, useState } from "react";
import { Layout } from "../../components/Layout";
import type { Workflow } from "../../types";
import type { WorkflowRecord } from "../../types/database";
import { WorkflowService } from "../database/services/workflowService";
import { createSubsetValues, exportSubsetValuesToFile, getSubsetValuesDescription } from "./createPartitionValues";

function ODPIP() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [dbWorkflows, setDbWorkflows] = useState<WorkflowRecord[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [subsetValues, setSubsetValues] = useState<number[]>([]);
  const [description, setDescription] = useState<string>("");

  useEffect(() => {
    const fetchWorkflows = async () => {
      setLoadingWorkflows(true);
      const workflows = await WorkflowService.getAllWorkflows();
      setDbWorkflows(workflows);
      setLoadingWorkflows(false);
    };

    fetchWorkflows();
  }, []);

  useEffect(() => {
    if (selectedWorkflow) {
      try {
        const {values, criticalPathDuration} = createSubsetValues(selectedWorkflow);
        setSubsetValues(values);
        setDescription(getSubsetValuesDescription(selectedWorkflow, values, criticalPathDuration));
      } catch (error) {
        console.error(error);
      }
    }
  }, [selectedWorkflow]);

  const handleExport = () => {
    if (subsetValues.length > 0) {
      const filename = selectedWorkflow 
        ? `${selectedWorkflow.name}-subset-values.txt`
        : 'subset-values.txt';
      exportSubsetValuesToFile(subsetValues, filename);
    }
  };

  const handleWorkflowSelect = async (workflowRecord: WorkflowRecord) => {
    const record = await WorkflowService.getWorkflow(workflowRecord.id);
    if (record) {
      setSelectedWorkflow(record.topology);
    }
  };

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">ODP-IP Subset Values</h1>
        
        {/* Workflow Selection */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Select Workflow</h2>
          {loadingWorkflows ? (
            <p>Loading workflows...</p>
          ) : (
            <select 
              className="border rounded p-2 w-full max-w-md"
              onChange={(e) => {
                const selected = dbWorkflows.find(w => w.id === e.target.value);
                if (selected) handleWorkflowSelect(selected);
              }}
              defaultValue=""
            >
              <option value="" disabled>Choose a workflow...</option>
              {dbWorkflows.map((workflow) => (
                <option key={workflow.id} value={workflow.id}>
                  {workflow.topology.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Results */}
        {selectedWorkflow && subsetValues.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold">
                Subset Values ({subsetValues.length} subsets)
              </h2>
              <button
                onClick={handleExport}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
              >
                Export to .txt
              </button>
            </div>

            {/* ODP-IP Format Preview */}
            <div className="bg-gray-100 p-4 rounded">
              <h3 className="font-medium mb-2">ODP-IP Format:</h3>
              <code className="text-sm break-all">{subsetValues.join(' ')}</code>
            </div>

            {/* Detailed Description */}
            <div className="bg-gray-50 p-4 rounded max-h-96 overflow-y-auto">
              <h3 className="font-medium mb-2">Subset Details:</h3>
              <pre className="text-sm whitespace-pre-wrap">{description}</pre>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default ODPIP;
