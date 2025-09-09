// DAGGEN-compliant workflow generator
import type { WorkflowNode } from '../types';

interface DAGGENConfig {
  nodeCount: number;          // n
  fat: number;               // fat parameter (default: 0.5)
  regular: number;           // regularity parameter 0-1 (default: 0.2)
  density: number;           // density parameter 0-1 (default: 0.5)
  jump: number;              // jump parameter (default: 1)
  
  // Legacy compatibility
  minDuration?: number;
  maxDuration?: number;
  minTransferAmount?: number;
  maxTransferAmount?: number;
}

export function generateDAGGENWorkflow(config: DAGGENConfig): WorkflowNode[] {
  const {
    nodeCount,
    fat = 0.5,
    regular = 0.2,
    density = 0.5,
    jump = 1,
    minDuration = 1,
    maxDuration = 10,
    minTransferAmount = 1000,
    maxTransferAmount = 100000
  } = config;

  console.log('Generating DAGGEN-compliant workflow:', { 
    nodeCount, fat, regular, density, jump 
  });

  if (nodeCount < 1) {
    throw new Error('Node count must be at least 1');
  }

  try {
    // Step 1: Generate the tasks
    const levels = generateTaskLevels(nodeCount, fat, regular);
    const nodes = createTaskNodes(levels, minDuration, maxDuration, minTransferAmount, maxTransferAmount);
    
    // Step 2: Generate dependencies using DAGGEN approach
    generateDAGGENDependencies(nodes, levels, density, jump);
    
    // Step 3: Ensure connectivity
    ensureBasicConnectivity(nodes, levels);
    
    console.log('Generated DAGGEN workflow with levels:', levels);
    console.log('Node details:', nodes.map(n => ({ id: n.id, level: n.level, connections: n.connections.length })));
    
    return nodes;
    
  } catch (error) {
    console.error('Error in generateDAGGENWorkflow:', error);
    throw new Error(`Failed to generate DAGGEN workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function generateTaskLevels(nodeCount: number, fat: number, regular: number): number[] {
  // Step 1a: Determine perfect number of tasks per level
  const perfectTasksPerLevel = fat * Math.log(nodeCount);
  
  // Calculate number of levels needed
  const estimatedLevels = Math.max(2, Math.ceil(nodeCount / perfectTasksPerLevel));
  
  console.log('Perfect tasks per level:', perfectTasksPerLevel);
  console.log('Estimated levels:', estimatedLevels);
  
  const levels: number[] = [];
  let remainingNodes = nodeCount;
  
  // Always start with 1 node
  levels.push(1);
  remainingNodes--;
  
  // Generate middle levels
  for (let level = 1; level < estimatedLevels - 1 && remainingNodes > 1; level++) {
    // Step 1b: Apply regularity parameter
    // DAGGEN: Pick random number around perfect value with (100*(1-regular))% latitude
    // Example: regular=0.2 gives range [0.2*perfect, 1.8*perfect]
    const minTasks = Math.max(1, Math.floor(perfectTasksPerLevel * regular));
    const maxTasks = Math.min(remainingNodes - 1, Math.ceil(perfectTasksPerLevel * (2 - regular)));
    
    // Pick random number around perfect value with latitude
    const tasksInLevel = Math.max(1, Math.min(maxTasks, 
      minTasks + Math.floor(Math.random() * (maxTasks - minTasks + 1))
    ));
    
    levels.push(tasksInLevel);
    remainingNodes -= tasksInLevel;
  }
  
  // Last level gets remaining nodes (at least 1)
  if (remainingNodes > 0) {
    levels.push(remainingNodes);
  }
  
  console.log('Generated levels:', levels);
  return levels;
}

function createTaskNodes(
  levels: number[], 
  minDuration: number, 
  maxDuration: number,
  minTransferAmount: number,
  maxTransferAmount: number
): WorkflowNode[] {
  const nodes: WorkflowNode[] = [];
  let nodeId = 1;
  
  for (let level = 0; level < levels.length; level++) {
    const nodesInLevel = levels[level];
    
    for (let i = 0; i < nodesInLevel; i++) {
      const isFirstLevel = level === 0;
      const isLastLevel = level === levels.length - 1;
      const isOnlyNodeInLastLevel = isLastLevel && nodesInLevel === 1;
      
      const node: WorkflowNode = {
        id: nodeId.toString(),
        name: isFirstLevel ? 'Start' : 
              isOnlyNodeInLastLevel ? 'Complete' : 
              `Task ${nodeId}`,
        status: 'pending',
        x: calculateXPosition(i, nodesInLevel),
        y: level,
        connections: [],
        level: level,
        description: isFirstLevel ? 'Initialize workflow execution' :
                    isOnlyNodeInLastLevel ? 'Complete workflow execution' :
                    `Execute task ${nodeId}`,
        // Step 1c: Assign costs (duration and transfer amount)
        duration: minDuration + Math.random() * (maxDuration - minDuration),
        transferAmount: minTransferAmount + Math.random() * (maxTransferAmount - minTransferAmount)
      };
      
      nodes.push(node);
      nodeId++;
    }
  }
  
  return nodes;
}

function generateDAGGENDependencies(
  nodes: WorkflowNode[], 
  levels: number[], 
  density: number, 
  jump: number
): void {
  // Group nodes by level
  const nodesByLevel: WorkflowNode[][] = [];
  let nodeIndex = 0;
  
  for (let level = 0; level < levels.length; level++) {
    nodesByLevel[level] = nodes.slice(nodeIndex, nodeIndex + levels[level]);
    nodeIndex += levels[level];
  }
  
  // Step 2: Generate dependencies using DAGGEN approach
  for (let targetLevel = 1; targetLevel < levels.length; targetLevel++) {
    const targetNodes = nodesByLevel[targetLevel];
    
    for (const targetNode of targetNodes) {
      // Determine how many parents this task should have
      // DAGGEN: MIN(1+random(0, density * #tasks in previous level), #tasks in previous level)
      
      // Consider all possible source levels within jump distance
      for (let sourceLevel = Math.max(0, targetLevel - jump); sourceLevel < targetLevel; sourceLevel++) {
        const sourceNodes = nodesByLevel[sourceLevel];
        const tasksInSourceLevel = sourceNodes.length;
        
        if (tasksInSourceLevel === 0) continue;
        
        // Calculate number of parents from this level
        const maxParentsFromLevel = Math.floor(density * tasksInSourceLevel);
        const numParentsFromLevel = Math.min(
          tasksInSourceLevel,
          1 + Math.floor(Math.random() * maxParentsFromLevel)
        );
        
        // Randomly select specific parent nodes
        const selectedParents = [];
        const availableParents = [...sourceNodes];
        
        for (let p = 0; p < numParentsFromLevel && availableParents.length > 0; p++) {
          const randomIndex = Math.floor(Math.random() * availableParents.length);
          const parentNode = availableParents.splice(randomIndex, 1)[0];
          selectedParents.push(parentNode);
        }
        
        // Create connections
        for (const parentNode of selectedParents) {
          if (!parentNode.connections.includes(targetNode.id)) {
            parentNode.connections.push(targetNode.id);
          }
        }
      }
    }
  }
}

function calculateXPosition(index: number, levelWidth: number): number {
  if (levelWidth === 1) return 2; // Center
  const spacing = 4 / (levelWidth - 1);
  return index * spacing;
}

function ensureBasicConnectivity(nodes: WorkflowNode[], levels: number[]): void {
  // Group nodes by level
  const nodesByLevel: WorkflowNode[][] = [];
  let nodeIndex = 0;
  
  for (let level = 0; level < levels.length; level++) {
    nodesByLevel[level] = nodes.slice(nodeIndex, nodeIndex + levels[level]);
    nodeIndex += levels[level];
  }
  
  // Ensure each level (except first) has at least one incoming connection
  for (let level = 1; level < levels.length; level++) {
    const targetNodes = nodesByLevel[level];
    const sourceNodes = nodesByLevel[level - 1];
    
    // Check if any node in this level has incoming connections
    let levelHasIncoming = false;
    for (const targetNode of targetNodes) {
      const hasIncoming = nodes.some(n => n.connections.includes(targetNode.id));
      if (hasIncoming) {
        levelHasIncoming = true;
        break;
      }
    }
    
    // If no connections to this level, create at least one
    if (!levelHasIncoming && sourceNodes.length > 0) {
      const randomSource = sourceNodes[Math.floor(Math.random() * sourceNodes.length)];
      const randomTarget = targetNodes[Math.floor(Math.random() * targetNodes.length)];
      
      if (!randomSource.connections.includes(randomTarget.id)) {
        randomSource.connections.push(randomTarget.id);
      }
    }
  }
}

// Export config type
export type { DAGGENConfig };

// Helper function to create DAGGEN config with sensible defaults
export function createDAGGENConfig(nodeCount: number, options: Partial<DAGGENConfig> = {}): DAGGENConfig {
  return {
    nodeCount,
    fat: 0.8,           // Slightly higher for more tasks per level
    regular: 0.3,       // 30% regularity (70% variation)
    density: 0.6,       // 60% density for good connectivity
    jump: 2,            // Allow jumping 2 levels
    minDuration: 1,
    maxDuration: 10,
    minTransferAmount: 1000,
    maxTransferAmount: 100000,
    ...options
  };
}