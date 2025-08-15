import * as yaml from 'js-yaml';
import type { WorkflowNode } from '../../../types';
import generateDescription from '../../../utils/generateDescription';
import type { ArgoTask, ArgoWorkflow } from '../../../types/argo';
import { capitalizeTaskName } from '../../../utils/capitalizeTaskName';

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
            x: x,
            y: level,
            connections: connections,
            description: generateDescription(task.name, task.template, template, workflow.metadata),
            duration: templateDurations.get(task.template) || 1
        };
        
        workflowNodes.push(node);
        nodeIdCounter++;
    }       
    );
    
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