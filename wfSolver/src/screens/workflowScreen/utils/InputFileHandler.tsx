import * as yaml from 'js-yaml';
import type { WorkflowNode } from '../../../types';
import generateDescription from '../../../utils/generateDescription';
import { capitalizeTaskName } from '../../../utils/capitalizeTaskName';
import type { ArgoTask, ArgoWorkflow } from '../../../types';

/**
 * This is a test
 * @param file 
 * @returns
 */

export async function InputFileHandler(file: File): Promise<WorkflowNode[]> {
    try {
        const fileContent = await file.text();
        const workflow = yaml.load(fileContent) as ArgoWorkflow;
        
        const dagTemplate = workflow.spec.templates.find(t => t.name === 'workflow-dag');
        if (!dagTemplate || !('dag' in dagTemplate)) {
            throw new Error('No DAG template found in workflow');
        }
        
        const tasks = (dagTemplate as any).dag.tasks as ArgoTask[];
        const templates = workflow.spec.templates;
        
        const templateDurations = new Map<string, number>();
        templates.forEach(template => {
            if (!template.container?.args) return

            const sleepArg = template.container.args.find(arg => arg.includes('sleep'));
            if (!sleepArg) return

            const match = sleepArg.match(/sleep\s+([\d.]+)/);
            if(!match) return

            templateDurations.set(template.name, parseFloat(match[1]));
            }
        );
        
        const taskMap = new Map<string, ArgoTask>();
        tasks.forEach(task => {
            taskMap.set(task.name, task);
        });
        
        const levels = calculateNodeLevels(tasks);
        
        const nodesByLevel = new Map<number, string[]>();

        Object.entries(levels).forEach(([taskName, level]) => {
        if (!nodesByLevel.has(level)) {
            nodesByLevel.set(level, []);
        }
            nodesByLevel.get(level)!.push(taskName);
        });
        
        const workflowNodes: WorkflowNode[] = [];
        let nodeIdCounter = 1;
        
        const taskNameToId = new Map<string, string>();
        tasks.forEach((task, index) => {
            taskNameToId.set(task.name, (index + 1).toString());
        });
        
        tasks.forEach(task => {
            const level = levels[task.name];
            const nodesAtLevel = nodesByLevel.get(level)!;
            const indexAtLevel = nodesAtLevel.indexOf(task.name);
            
            let x: number;
            if (nodesAtLevel.length === 1) {
                x = 2;
            } else {
                const spacing = 2;
                const totalWidth = (nodesAtLevel.length - 1) * spacing;
                const startX = Math.max(0, 2 - totalWidth / 2);
                x = startX + (indexAtLevel * spacing);
            }
            
            x = Math.max(x, 0);
            
        const connections: string[] = [];
        
        tasks.forEach(t => {
            if (t.dependencies?.includes(task.name)) {
                const dependentNodeId = taskNameToId.get(t.name);
                if (dependentNodeId) {
                    connections.push(dependentNodeId);
                }
            }
        });
        
        const template = templates.find(t => t.name === task.template);

        const node: WorkflowNode = {
            id: nodeIdCounter.toString(),
            name: capitalizeTaskName(task.name),
            status: 'pending',
            position: { x: x, y: level },
            connections: [],
            description: generateDescription(task.name, task.template, template, workflow.metadata),
            executionTime: templateDurations.get(task.template) || 1,
            level: level
        };
        
        workflowNodes.push(node);
        nodeIdCounter++;
    }       
    );
    
    // Validate and fix outgoing connections for uploaded workflows
    validateAndFixOutgoingConnections(workflowNodes);
    
    return workflowNodes;
    
    } catch (error) {
        console.error('Error parsing workflow file:', error);
        const errorMessage = typeof error === 'object' && error !== null && 'message' in error ? (error as { message: string }).message : String(error);
        throw new Error(`Failed to parse workflow file: ${errorMessage}`);
    }
};

function calculateNodeLevels(tasks: ArgoTask[]): Record<string, number> {
  const levels: Record<string, number> = {};
  const visited = new Set<string>();
  
  function dfs(taskName: string): number {
    if (visited.has(taskName)) {
      return levels[taskName];
    }
    
    visited.add(taskName);
    const task = tasks.find(t => t.name === taskName);
    
    if (!task || !task.dependencies || task.dependencies.length === 0) {
      levels[taskName] = 0;
      return 0;
    }
    
    const maxDepLevel = Math.max(...task.dependencies.map(dep => dfs(dep)));
    levels[taskName] = maxDepLevel + 1;
    return levels[taskName];
  }
  
  tasks.forEach(task => {
    if (!visited.has(task.name)) {
      dfs(task.name);
    }
  });
  
  return levels;
}

function validateAndFixOutgoingConnections(nodes: WorkflowNode[]): void {
  console.log('Validating outgoing connections for uploaded workflow...');
  
  // Group nodes by level
  const nodesByLevel = new Map<number, WorkflowNode[]>();
  let maxLevel = 0;
  
  for (const node of nodes) {
    const level = node.level || node.position.y;
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, []);
    }
    nodesByLevel.get(level)!.push(node);
    maxLevel = Math.max(maxLevel, level);
  }
  
  // Check each node (except those in the final level) for outgoing connections
  for (let level = 0; level < maxLevel; level++) {
    const nodesInLevel = nodesByLevel.get(level) || [];
    
    for (const node of nodesInLevel) {
      // Skip if this node already has outgoing connections
      if (node.connections.length > 0) continue;
      
      // Find available target nodes in subsequent levels
      const availableTargets: WorkflowNode[] = [];
      
      // Look at all subsequent levels for potential targets
      for (let targetLevel = level + 1; targetLevel <= maxLevel; targetLevel++) {
        const targetNodes = nodesByLevel.get(targetLevel) || [];
        availableTargets.push(...targetNodes);
      }
      
      // If we have targets, connect to one randomly (preferably in the next level)
      if (availableTargets.length > 0) {
        // Prefer nodes in the immediate next level
        const nextLevelNodes = nodesByLevel.get(level + 1) || [];
        const preferredTargets = nextLevelNodes.length > 0 ? nextLevelNodes : availableTargets;
        
        const randomTarget = preferredTargets[Math.floor(Math.random() * preferredTargets.length)];
        node.connections.push( { sourceNodeId: node.id, targetNodeId: randomTarget.id, transferTime: 1, label: 'Merge Results → Complete' }); // TODO fix transfer time and label
        console.log(`Fixed uploaded workflow: Added required outgoing connection: ${node.name} -> ${randomTarget.name}`);
      } else {
        console.warn(`Could not find target for node ${node.name} at level ${level} in uploaded workflow`);
      }
    }
  }
  
  // Identify and validate terminal nodes (should be in the highest level and have no outgoing connections)
  const finalLevelNodes = nodesByLevel.get(maxLevel) || [];
  
  // Clean up any connections from final level nodes to other final level nodes
  for (const node of finalLevelNodes) {
    // Remove any connections from final level nodes to other final level nodes
    const originalConnectionCount = node.connections.length;
    node.connections = node.connections.filter(edge => {
      const targetNode = nodes.find(n => n.id === edge.targetNodeId);
      return targetNode && (targetNode.level || targetNode.position.y) !== maxLevel;
    });
    
    if (node.connections.length !== originalConnectionCount) {
      console.log(`Cleaned up ${originalConnectionCount - node.connections.length} invalid final-level connections for ${node.name}`);
    }
  }
  
  console.log('Outgoing connection validation completed for uploaded workflow.');
}