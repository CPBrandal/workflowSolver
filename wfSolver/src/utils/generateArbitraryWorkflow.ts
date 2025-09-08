import type { WorkflowNode } from '../types';

interface GenerateWorkflowOptions {
  nodeCount: number;
  layout?: 'linear' | 'branching' | 'parallel';
  maxDuration?: number;
  minDuration?: number;
}

export function generateArbitraryWorkflow({
  nodeCount,
  layout = 'linear',
  maxDuration = 10,
  minDuration = 1
}: GenerateWorkflowOptions): WorkflowNode[] {
  console.log('Generating workflow with:', { nodeCount, layout, maxDuration, minDuration });
  
  if (nodeCount < 1) {
    throw new Error('Node count must be at least 1');
  }

  if (nodeCount > 50) {
    throw new Error('Node count cannot exceed 50');
  }

  if (minDuration < 1 || maxDuration < minDuration) {
    throw new Error('Invalid duration settings');
  }

  // Generate random duration between min and max
  const getRandomDuration = () => Math.floor(Math.random() * (maxDuration - minDuration + 1)) + minDuration;

  let nodes: WorkflowNode[];

  try {
    switch (layout) {
      case 'linear':
        nodes = generateLinearWorkflow(nodeCount, getRandomDuration);
        break;
      
      case 'branching':
        nodes = generateBranchingWorkflow(nodeCount, getRandomDuration);
        break;
      
      case 'parallel':
        nodes = generateParallelWorkflow(nodeCount, getRandomDuration);
        break;
      
      default:
        console.warn(`Unknown layout '${layout}', falling back to linear`);
        nodes = generateLinearWorkflow(nodeCount, getRandomDuration);
    }

    console.log('Generated nodes:', nodes);
    
    if (!nodes || nodes.length === 0) {
      throw new Error('Failed to generate workflow nodes');
    }

    return nodes;
    
  } catch (error) {
    console.error('Error in generateArbitraryWorkflow:', error);
    throw new Error(`Failed to generate ${layout} workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function generateLinearWorkflow(nodeCount: number, getDuration: () => number): WorkflowNode[] {
  const nodes: WorkflowNode[] = [];
  
  for (let i = 0; i < nodeCount; i++) {
    const node: WorkflowNode = {
      id: (i + 1).toString(),
      name: `Task ${i + 1}`,
      status: 'pending',
      x: 2, // Center horizontally
      y: i, // Stack vertically
      connections: i < nodeCount - 1 ? [(i + 2).toString()] : [], // Connect to next node
      description: `Execute task ${i + 1} in the workflow sequence`,
      duration: getDuration()
    };
    nodes.push(node);
  }
  
  return nodes;
}

function generateBranchingWorkflow(nodeCount: number, getDuration: () => number): WorkflowNode[] {
  const nodes: WorkflowNode[] = [];
  
  if (nodeCount === 1) {
    return [{
      id: '1',
      name: 'Task 1',
      status: 'pending',
      x: 2,
      y: 0,
      connections: [],
      description: 'Single task workflow',
      duration: getDuration()
    }];
  }

  // Start node
  nodes.push({
    id: '1',
    name: 'Start',
    status: 'pending',
    x: 2,
    y: 0,
    connections: ['2', '3'], // Branch to two paths
    description: 'Initialize workflow and branch to parallel tasks',
    duration: getDuration()
  });

  if (nodeCount === 2) {
    nodes.push({
      id: '2',
      name: 'Task 2',
      status: 'pending',
      x: 2,
      y: 1,
      connections: [],
      description: 'Complete the workflow',
      duration: getDuration()
    });
    return nodes;
  }

  // Create branching paths
  const leftBranchSize = Math.floor((nodeCount - 1) / 2);
  const rightBranchSize = nodeCount - 1 - leftBranchSize;
  
  // Left branch
  for (let i = 0; i < leftBranchSize; i++) {
    const nodeId = (i + 2).toString();
    const isLast = i === leftBranchSize - 1;
    
    nodes.push({
      id: nodeId,
      name: `Task ${nodeId}`,
      status: 'pending',
      x: 1, // Left side
      y: i + 1,
      connections: isLast && rightBranchSize === 0 ? [] : 
                  isLast ? [(leftBranchSize + rightBranchSize + 1).toString()] : 
                  [(i + 3).toString()],
      description: `Execute task ${nodeId} on left branch`,
      duration: getDuration()
    });
  }

  // Right branch
  for (let i = 0; i < rightBranchSize; i++) {
    const nodeId = (leftBranchSize + i + 2).toString();
    const isLast = i === rightBranchSize - 1;
    
    nodes.push({
      id: nodeId,
      name: `Task ${nodeId}`,
      status: 'pending',
      x: 3, // Right side
      y: i + 1,
      connections: isLast && leftBranchSize > 0 ? [(leftBranchSize + rightBranchSize + 1).toString()] :
                  isLast ? [] :
                  [(leftBranchSize + i + 3).toString()],
      description: `Execute task ${nodeId} on right branch`,
      duration: getDuration()
    });
  }

  // Merge node (if both branches exist)
  if (leftBranchSize > 0 && rightBranchSize > 0) {
    nodes.push({
      id: (leftBranchSize + rightBranchSize + 1).toString(),
      name: 'Merge',
      status: 'pending',
      x: 2,
      y: Math.max(leftBranchSize, rightBranchSize) + 1,
      connections: [],
      description: 'Merge results from parallel branches',
      duration: getDuration()
    });
  }

  return nodes;
}

function generateParallelWorkflow(nodeCount: number, getDuration: () => number): WorkflowNode[] {
  const nodes: WorkflowNode[] = [];
  
  if (nodeCount <= 2) {
    return generateLinearWorkflow(nodeCount, getDuration);
  }

  // Start node
  const parallelTasks = nodeCount - 2; // Exclude start and end nodes
  const connections = [];
  for (let i = 2; i <= parallelTasks + 1; i++) {
    connections.push(i.toString());
  }

  nodes.push({
    id: '1',
    name: 'Start',
    status: 'pending',
    x: 2,
    y: 0,
    connections,
    description: 'Initialize workflow and start parallel tasks',
    duration: getDuration()
  });

  // Parallel tasks
  for (let i = 0; i < parallelTasks; i++) {
    const nodeId = (i + 2).toString();
    nodes.push({
      id: nodeId,
      name: `Task ${nodeId}`,
      status: 'pending',
      x: i, // Spread horizontally
      y: 1,
      connections: [(parallelTasks + 2).toString()], // All connect to end node
      description: `Execute parallel task ${nodeId}`,
      duration: getDuration()
    });
  }

  // End node
  nodes.push({
    id: (parallelTasks + 2).toString(),
    name: 'Complete',
    status: 'pending',
    x: Math.floor(parallelTasks / 2),
    y: 2,
    connections: [],
    description: 'Complete workflow after all parallel tasks finish',
    duration: getDuration()
  });

  return nodes;
}