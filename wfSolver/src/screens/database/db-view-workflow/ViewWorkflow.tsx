import { useEffect, useState } from 'react';
import { Layout } from '../../../components/Layout';
import type { SchedulingAlgorithm } from '../../../constants/constants';
import { ALGORITHMS } from '../../../constants/constants';
import { CP_HEFT_Schedule } from '../../../schedulers/cpHeftScheduler';
import { heftScheduleWithWorkerConstraints } from '../../../schedulers/heft';
import { peftSchedule } from '../../../schedulers/peft';
import { scheduleWithWorkerConstraints } from '../../../schedulers/scheduler';
import type { Worker, Workflow } from '../../../types';
import type { SimulationRecord, WorkflowRecord } from '../../../types/database';
import VisualWorkflow from '../../workflowScreen/VisualWorkflow';
import { WorkflowService } from '../services/workflowService';
import TaskTimelineChart from './TaskTimelineChart';
import { ViewWorkflowController } from './ViewWorkflow.controller';

function ViewWorkflow() {
  const [savedWorkflows, setSavedWorkflows] = useState<WorkflowRecord[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [selectedNumberOfWorkers, setSelectedNumberOfWorkers] = useState<number>(0);

  // Simulation states
  const [simulations, setSimulations] = useState<SimulationRecord[]>([]);
  const [selectedSimulationId, setSelectedSimulationId] = useState<string>('');
  const [loadingSimulations, setLoadingSimulations] = useState(false);
  const [selectedSimulation, setSelectedSimulation] = useState<SimulationRecord | null>(null);
  const [chosenAlgorithm, setChosenAlgorithm] = useState<SchedulingAlgorithm>('Greedy');

  // Simulation running states
  const [simulationResult, setSimulationResult] = useState<{
    workflow: Workflow;
    schedule: any[];
    workers: Worker[];
  } | null>(null);
  // compare cp heft running states
  const [simulationCompareResult, setSimulationCompareResult] = useState<{
    workflow: Workflow;
    schedule: any[];
    workers: Worker[];
  } | null>(null);
  // k-heft running states
  const [simulationNewSchedulerResult, setSimulationNewSchedulerResult] = useState<{
    workflow: Workflow;
    schedule: any[];
    workers: Worker[];
  } | null>(null);
  const [processingSimulation, setProcessingSimulation] = useState(false);

  // Function to run the simulation with all three algorithms
  const runSimulationWithAllAlgorithms = async (sim: SimulationRecord, workflowData: Workflow) => {
    if (!sim || !workflowData) {
      setSimulationResult(null);
      setSimulationCompareResult(null);
      setSimulationNewSchedulerResult(null);
      return;
    }

    setProcessingSimulation(true);

    try {
      // Create a copy of the workflow with the simulation's execution times
      const simulatedWorkflow: Workflow = {
        ...workflowData,
        tasks: workflowData.tasks.map(task => ({
          ...task,
          executionTime: sim.node_execution_times[task.id] || 0,
          connections: task.connections.map(edge => ({
            ...edge,
            transferTime:
              sim.edge_transfer_times[`${edge.sourceNodeId}->${edge.targetNodeId}`] || 0,
          })),
        })),
      };

      // Create workers based on the simulation's worker count
      const workers: Worker[] = [];
      const workerCount = sim.worker_count || 2;
      for (let i = 0; i < workerCount; i++) {
        workers.push({
          id: `worker-${i + 1}`,
          time: 0,
          isActive: false,
          currentTask: null,
          criticalPathWorker: i === 0,
        });
      }

      // Mark critical path nodes
      if (sim.critical_path_node_ids) {
        simulatedWorkflow.tasks = simulatedWorkflow.tasks.map(task => ({
          ...task,
          criticalPath: sim.critical_path_node_ids?.includes(task.id) || false,
        }));
      }

      // ================== Algorithm 1: Chosen Algorithm ==================
      const schedule =
        chosenAlgorithm === 'Greedy'
          ? scheduleWithWorkerConstraints(simulatedWorkflow.tasks, workers)
          : chosenAlgorithm === 'CP_HEFT'
            ? CP_HEFT_Schedule(simulatedWorkflow.tasks, workers)
            : heftScheduleWithWorkerConstraints(simulatedWorkflow.tasks, workers);

      const finalWorkers = workers.map(w => ({ ...w }));
      schedule.forEach(task => {
        const worker = finalWorkers.find(w => w.id === task.workerId);
        if (worker) {
          worker.time += task.endTime - task.startTime;
        }
      });

      setSimulationResult({
        workflow: simulatedWorkflow,
        schedule,
        workers: finalWorkers,
      });

      // ================== Algorithm 2: Regular HEFT ==================
      const compareCpHeftSchedule = heftScheduleWithWorkerConstraints(
        simulatedWorkflow.tasks,
        workers
      );
      const compareFinalWorkers = workers.map(w => ({ ...w }));
      compareCpHeftSchedule.forEach(task => {
        const worker = compareFinalWorkers.find(w => w.id === task.workerId);
        if (worker) {
          worker.time += task.endTime - task.startTime;
        }
      });

      setSimulationCompareResult({
        workflow: simulatedWorkflow,
        schedule: compareCpHeftSchedule,
        workers: compareFinalWorkers,
      });

      // ================== Algorithm 3: PEFT ==================
      const peftScheduledTasks = peftSchedule(simulatedWorkflow.tasks, workers);
      const peftFinalWorkers = workers.map(w => ({ ...w }));
      peftScheduledTasks.forEach(task => {
        const worker = peftFinalWorkers.find(w => w.id === task.workerId);
        if (worker) {
          worker.time += task.endTime - task.startTime;
        }
      });

      setSimulationNewSchedulerResult({
        workflow: simulatedWorkflow,
        schedule: peftScheduledTasks,
        workers: peftFinalWorkers,
      });

      // Brief delay for visual feedback
      setTimeout(() => {
        setProcessingSimulation(false);
      }, 500);
    } catch (error) {
      console.error('Error processing simulation:', error);
      setProcessingSimulation(false);
    }
  };

  // Handler for re-run button
  const handleRerunSimulation = () => {
    if (selectedSimulation && workflow) {
      runSimulationWithAllAlgorithms(selectedSimulation, workflow);
    }
  };

  // Fetch saved workflows when component mounts
  useEffect(() => {
    const fetchWorkflows = async () => {
      setLoadingWorkflows(true);
      const workflows = await WorkflowService.getAllWorkflows();
      setSavedWorkflows(workflows);
      setLoadingWorkflows(false);
    };

    fetchWorkflows();
  }, []);

  // Load workflow and simulations when workflow is selected
  useEffect(() => {
    const loadSelectedWorkflow = async () => {
      if (!selectedWorkflowId) {
        setWorkflow(null);
        setSimulations([]);
        setSelectedSimulationId('');
        setSelectedSimulation(null);
        setSimulationResult(null);
        return;
      }

      const workflowData = await WorkflowService.getWorkflow(selectedWorkflowId);
      if (workflowData) {
        setWorkflow(workflowData.topology);
      } else {
        alert('Failed to load workflow');
        return;
      }

      // Load simulations for this workflow
      setLoadingSimulations(true);
      try {
        const sims = await ViewWorkflowController.getSimulationsByWorkersAndAlgorithm({
          workflowId: selectedWorkflowId,
          numberOfWorkers: selectedNumberOfWorkers,
          algorithm: chosenAlgorithm,
        });
        setSimulations(sims);
      } catch (error) {
        console.error('Error loading simulations:', error);
        setSimulations([]);
      } finally {
        setLoadingSimulations(false);
      }
    };

    loadSelectedWorkflow();
  }, [selectedWorkflowId, selectedNumberOfWorkers, chosenAlgorithm]);

  // Load selected simulation details and automatically run it
  useEffect(() => {
    const runSimulation = async () => {
      if (!selectedSimulationId) {
        setSelectedSimulation(null);
        setSimulationResult(null);
        setSimulationCompareResult(null);
        setSimulationNewSchedulerResult(null);
        return;
      }

      const sim = simulations.find(s => s.id === selectedSimulationId);
      setSelectedSimulation(sim || null);

      if (sim && workflow) {
        await runSimulationWithAllAlgorithms(sim, workflow);
      }
    };

    runSimulation();
  }, [selectedSimulationId, simulations, workflow, chosenAlgorithm]);

  const getSelectedWorkflowDetails = () => {
    return savedWorkflows.find(w => w.id === selectedWorkflowId);
  };

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-4 text-center">View & Run Workflows</h2>
        <p className="text-gray-700 mb-6 text-center">
          Browse saved workflows and replay specific simulations.
        </p>

        <div className="space-y-6 max-w-2xl mx-auto">
          {/* Workflow Selector */}
          <div>
            <label
              htmlFor="workflowSelect"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Select Workflow
            </label>
            {loadingWorkflows ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-gray-600 mt-2 text-sm">Loading workflows...</p>
              </div>
            ) : (
              <>
                <select
                  id="workflowSelect"
                  value={selectedWorkflowId}
                  onChange={e => setSelectedWorkflowId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choose a workflow --</option>
                  {savedWorkflows.map(wf => (
                    <option key={wf.id} value={wf.id}>
                      {wf.topology.name} ({wf.node_count} nodes) -{' '}
                      {new Date(wf.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {savedWorkflows.length} workflow{savedWorkflows.length !== 1 ? 's' : ''} available
                </p>
              </>
            )}
          </div>
          <div className="space-y-6 max-w-2xl mx-auto">
            <label
              htmlFor="numberOfWorkers"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Number of Workers
            </label>
            <select
              id="numberOfWorkers"
              value={selectedNumberOfWorkers}
              onChange={e => setSelectedNumberOfWorkers(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={0}>-- Select workers --</option>
              {selectedWorkflowId &&
                Array.from(
                  {
                    length: savedWorkflows.find(w => w.id === selectedWorkflowId)?.node_count || 1,
                  },
                  (_, i) => i + 1
                ).map(num => (
                  <option key={num} value={num}>
                    {num} worker{num !== 1 ? 's' : ''}
                  </option>
                ))}
            </select>
          </div>

          {workflow && (
            <div className="mt-4 mx-auto p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex-1 mb-3">
                <label className="text-sm font-medium text-gray-700">Scheduling Algorithm</label>
                <p className="text-xs text-gray-500 mt-1">
                  Choose the algorithm to use for task scheduling
                </p>
              </div>
              <div className="flex gap-2">
                {ALGORITHMS.map(algorithm => (
                  <button
                    key={algorithm}
                    type="button"
                    onClick={() => setChosenAlgorithm(algorithm)}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      chosenAlgorithm === algorithm
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {algorithm}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Simulation Selector */}
          {selectedWorkflowId && selectedNumberOfWorkers > 0 && (
            <div>
              <label
                htmlFor="simulationSelect"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Select Simulation
              </label>
              {loadingSimulations ? (
                <div className="text-center py-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-gray-600 mt-1 text-xs">Loading simulations...</p>
                </div>
              ) : simulations.length === 0 ? (
                <p className="text-gray-500 text-sm py-2">
                  No simulations found for this workflow.
                </p>
              ) : (
                <>
                  <select
                    id="simulationSelect"
                    value={selectedSimulationId}
                    onChange={e => setSelectedSimulationId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Choose a simulation --</option>
                    {simulations.map(sim => (
                      <option key={sim.id} value={sim.id}>
                        Simulation #{sim.simulation_number} - Actual:{' '}
                        {sim.actual_runtime.toFixed(2)}s, Theoretical:{' '}
                        {sim.theoretical_runtime.toFixed(2)}s
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {simulations.length} simulation{simulations.length !== 1 ? 's' : ''} available
                  </p>
                </>
              )}
            </div>
          )}

          {/* Simulation Details */}
          {selectedSimulation && (
            <div className="bg-green-50 p-4 rounded-md border border-green-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Simulation Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <p>
                    <strong>Simulation #:</strong> {selectedSimulation.simulation_number}
                  </p>
                  <p>
                    <strong>Actual Runtime:</strong> {selectedSimulation.actual_runtime.toFixed(2)}s
                  </p>
                  <p>
                    <strong>Theoretical Runtime:</strong>{' '}
                    {selectedSimulation.theoretical_runtime.toFixed(2)}s
                  </p>
                </div>
                <div>
                  <p>
                    <strong>Workers Used:</strong> {selectedSimulation.worker_count}
                  </p>
                  <p>
                    <strong>Efficiency:</strong>{' '}
                    {(
                      (selectedSimulation.theoretical_runtime / selectedSimulation.actual_runtime) *
                      100
                    ).toFixed(1)}
                    %
                  </p>
                  <p>
                    <strong>Created:</strong>{' '}
                    {new Date(selectedSimulation.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <p>
                  <strong>Critical Path Length:</strong>{' '}
                  {selectedSimulation.critical_path_node_ids?.length || 0} tasks
                </p>
              </div>
            </div>
          )}

          {/* Processing Indicator */}
          {processingSimulation && (
            <div className="text-center py-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-gray-600 mt-2 text-sm">Processing simulation...</p>
            </div>
          )}

          {/* Workflow Details */}
          {selectedWorkflowId && (
            <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Workflow Details</h4>
              {(() => {
                const selected = getSelectedWorkflowDetails();
                if (!selected) return null;

                return (
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      <strong>Name:</strong> {selected.topology.name}
                    </p>
                    <p>
                      <strong>Nodes:</strong> {selected.node_count}
                    </p>
                    <p>
                      <strong>Created:</strong> {new Date(selected.created_at).toLocaleString()}
                    </p>
                    {selected.tags && selected.tags.length > 0 && (
                      <p>
                        <strong>Tags:</strong> {selected.tags.join(', ')}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Workflow Visualization */}
        {(workflow || simulationResult) && (
          <div className="mt-8 pt-6 border-t">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-700">
                {simulationResult ? 'Simulation Result' : 'Workflow Visualization'}
              </h3>

              {/* Re-run Button */}
              {selectedSimulation && workflow && (
                <button
                  onClick={handleRerunSimulation}
                  disabled={processingSimulation}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2"
                >
                  <svg
                    className={`w-4 h-4 ${processingSimulation ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  {processingSimulation ? 'Re-running...' : 'Re-run Simulation'}
                </button>
              )}
            </div>

            {simulationResult && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">Execution Summary:</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p>
                      <strong>Scheduled Runtime:</strong>{' '}
                      {Math.max(...simulationResult.schedule.map(t => t.endTime)).toFixed(2)}s
                    </p>
                  </div>
                  <div>
                    <p>
                      <strong>Workers Used:</strong> {simulationResult.workers.length}
                    </p>
                  </div>
                  <div>
                    <p>
                      <strong>Tasks Scheduled:</strong> {simulationResult.schedule.length}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {simulationResult && (
              <div className="mb-6">
                <h4 className="text-md font-semibold text-gray-800 mb-2">
                  {chosenAlgorithm}: CP tasks on one same worker
                </h4>
                <TaskTimelineChart
                  schedule={simulationResult.schedule}
                  workflow={simulationResult.workflow}
                  workers={simulationResult.workers}
                />
              </div>
            )}

            {simulationCompareResult && (
              <div className="mb-6">
                <h4 className="text-md font-semibold text-gray-800 mb-2">Regular HEFT</h4>
                <TaskTimelineChart
                  schedule={simulationCompareResult.schedule}
                  workflow={simulationCompareResult.workflow}
                  workers={simulationCompareResult.workers}
                />
              </div>
            )}

            {simulationNewSchedulerResult && (
              <div className="mb-6">
                <h4 className="text-md font-semibold text-gray-800 mb-2">PEFT</h4>
                <TaskTimelineChart
                  schedule={simulationNewSchedulerResult.schedule}
                  workflow={simulationNewSchedulerResult.workflow}
                  workers={simulationNewSchedulerResult.workers}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => console.log('Workers:', simulationNewSchedulerResult.workers)}
                    className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded text-gray-700"
                  >
                    Log Workers
                  </button>
                  <button
                    onClick={() => console.log('Schedule:', simulationNewSchedulerResult.schedule)}
                    className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded text-gray-700"
                  >
                    Log Schedule
                  </button>
                </div>
              </div>
            )}

            <VisualWorkflow
              nodes={(simulationResult?.workflow || workflow)!.tasks}
              workers={simulationResult?.workers || []}
              onWorkersUpdate={() => {}}
              cpmAnalysis={null}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}

export default ViewWorkflow;
