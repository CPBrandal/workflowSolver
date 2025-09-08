import type { WorkflowNode } from "../types";

export const defaultNodes: WorkflowNode[] = [
    {
      id: '1',
      name: 'Start',
      status: 'pending',
      x: 2,
      y: 0,
      connections: ['2'],
      description: 'Initialize the workflow process',
      duration: 1
    },
    {
      id: '2',
      name: 'Data Validation',
      status: 'pending',
      x: 2,
      y: 1,
      connections: ['3', '4'],
      description: 'Validate incoming data format and integrity',
      duration: 3
    },
    {
      id: '3',
      name: 'Process A',
      status: 'pending',
      x: 1,
      y: 2,
      connections: ['5'],
      description: 'Execute primary processing logic',
      duration: 10
    },
    {
      id: '4',
      name: 'Process B',
      status: 'pending',
      x: 3,
      y: 2,
      connections: ['5'],
      description: 'Execute secondary processing logic',
      duration: 8
    },
    {
      id: '5',
      name: 'Merge Results',
      status: 'pending',
      x: 2,
      y: 3,
      connections: ['6'],
      description: 'Combine results from parallel processes',
      duration: 3
    },
    {
      id: '6',
      name: 'Complete',
      status: 'pending',
      x: 2,
      y: 4,
      connections: [],
      description: 'Finalize and cleanup workflow',
      duration: 1
    }
  ];