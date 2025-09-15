import type { WorkflowNode } from '../types';

export const defaultNodes: WorkflowNode[] = [
  {
    id: '1',
    name: 'Start',
    status: 'pending',
    position: { x: 2, y: 0 },
    connections: [
      { sourceNodeId: '1', targetNodeId: '2', transferTime: 0.5, label: 'Start → Data Validation' },
    ],
    description: 'Initialize the workflow process',
    executionTime: 1,
    criticalPath: false,
  },
  {
    id: '2',
    name: 'Data Validation',
    status: 'pending',
    position: { x: 2, y: 1 },
    connections: [
      {
        sourceNodeId: '2',
        targetNodeId: '3',
        transferTime: 1,
        label: 'Data Validation → Process A',
      },
      {
        sourceNodeId: '2',
        targetNodeId: '4',
        transferTime: 1,
        label: 'Data Validation → Process B',
      },
    ],
    description: 'Validate incoming data format and integrity',
    executionTime: 3,
    criticalPath: false,
  },
  {
    id: '3',
    name: 'Process A',
    status: 'pending',
    position: { x: 1, y: 2 },
    connections: [
      { sourceNodeId: '3', targetNodeId: '5', transferTime: 2, label: 'Process A → Merge Results' },
    ],
    description: 'Execute primary processing logic',
    executionTime: 10,
    criticalPath: false,
  },
  {
    id: '4',
    name: 'Process B',
    status: 'pending',
    position: { x: 3, y: 2 },
    connections: [
      { sourceNodeId: '4', targetNodeId: '5', transferTime: 2, label: 'Process B → Merge Results' },
    ],
    description: 'Execute secondary processing logic',
    executionTime: 8,
    criticalPath: false,
  },
  {
    id: '5',
    name: 'Merge Results',
    status: 'pending',
    position: { x: 2, y: 3 },
    connections: [
      { sourceNodeId: '5', targetNodeId: '6', transferTime: 1, label: 'Merge Results → Complete' },
    ],
    description: 'Combine results from parallel processes',
    executionTime: 3,
    criticalPath: false,
  },
  {
    id: '6',
    name: 'Complete',
    status: 'pending',
    position: { x: 2, y: 4 },
    connections: [],
    description: 'Finalize and complete the workflow',
    executionTime: 1,
    criticalPath: false,
  },
];
