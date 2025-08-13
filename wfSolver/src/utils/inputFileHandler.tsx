import * as yaml from 'js-yaml';
import type { NodeType, WorkflowNode } from '../types';


interface ArgoTask {
  name: string;
  dependencies?: string[];
  template: string;
}

interface ArgoTemplate {
  name: string;
  container?: {
    args?: string[];
  };
  nodeSelector?: Record<string, string>;
  metadata?: {
    annotations?: Record<string, string>;
    labels?: Record<string, string>;
  };
}

interface ArgoWorkflow {
  metadata?: {
    annotations?: Record<string, string>;
    labels?: Record<string, string>;
  };
  spec: {
    templates: ArgoTemplate[];
  };
}

export const inputFileHandler = async (file: File): Promise<WorkflowNode[]> => {
  try {
    // Read the file content
    const fileContent = await file.text();
    
    // Parse YAML
    const workflow = yaml.load(fileContent) as ArgoWorkflow;
    
    // Extract DAG tasks and templates
    const dagTemplate = workflow.spec.templates.find(t => t.name === 'workflow-dag');
    if (!dagTemplate || !('dag' in dagTemplate)) {
      throw new Error('No DAG template found in workflow');
    }
    
    const tasks = (dagTemplate as any).dag.tasks as ArgoTask[];
    const templates = workflow.spec.templates;
    
    // Create a map of template name to duration
    const templateDurations = new Map<string, number>();
    templates.forEach(template => {
      if (template.container?.args) {
        const sleepArg = template.container.args.find(arg => arg.includes('sleep'));
        if (sleepArg) {
          const match = sleepArg.match(/sleep\s+([\d.]+)/);
          if (match) {
            templateDurations.set(template.name, parseFloat(match[1]));
          }
        }
      }
    });
    
    // Build dependency map
    const taskMap = new Map<string, ArgoTask>();
    tasks.forEach(task => {
      taskMap.set(task.name, task);
    });
    
    // Calculate node levels for positioning
    const levels = calculateNodeLevels(tasks);
    
    // Group nodes by level for x positioning
    const nodesByLevel = new Map<number, string[]>();
    Object.entries(levels).forEach(([taskName, level]) => {
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level)!.push(taskName);
    });
    
    // Convert to WorkflowNode format
    const workflowNodes: WorkflowNode[] = [];
    let nodeIdCounter = 1;
    
    tasks.forEach(task => {
      const level = levels[task.name];
      const nodesAtLevel = nodesByLevel.get(level)!;
      const indexAtLevel = nodesAtLevel.indexOf(task.name);
      
      // Calculate x position (center nodes at each level)
      const maxNodesAtLevel = Math.max(...Array.from(nodesByLevel.values()).map(arr => arr.length));
      const xOffset = maxNodesAtLevel > 1 ? (indexAtLevel - (nodesAtLevel.length - 1) / 2) : 0;
      const x = Math.max(0, Math.round(2 + xOffset));
      
      // Determine node type
      let nodeType: NodeType = 'process';
      if (!task.dependencies || task.dependencies.length === 0) {
        nodeType = 'start';
      } else if (task.name.toLowerCase().includes('end') || 
                 !tasks.some(t => t.dependencies?.includes(task.name))) {
        // Check if no other tasks depend on this one (it's a terminal node)
        const isTerminal = !tasks.some(t => t.dependencies?.includes(task.name));
        if (isTerminal) {
          nodeType = 'end';
        }
      }
      
      // Find connections (tasks that depend on this task)
      const connections: string[] = [];
      tasks.forEach(t => {
        if (t.dependencies?.includes(task.name)) {
          connections.push((nodeIdCounter + tasks.findIndex(task => task.name === t.name)).toString());
        }
      });
      
      // Find the corresponding template for this task
      const template = templates.find(t => t.name === task.template);

      const node: WorkflowNode = {
        id: nodeIdCounter.toString(),
        name: capitalizeTaskName(task.name),
        type: nodeType,
        status: 'pending',
        x: x,
        y: level,
        connections: [], // Will be filled in second pass
        description: generateDescription(task.name, task.template, template, workflow.metadata),
        duration: templateDurations.get(task.template) || 1
      };
      
      workflowNodes.push(node);
      nodeIdCounter++;
    });
    
    // Second pass: fill in connections with correct IDs
    workflowNodes.forEach((node, index) => {
      const task = tasks[index];
      const connections: string[] = [];
      
      tasks.forEach((t, tIndex) => {
        if (t.dependencies?.includes(task.name)) {
          connections.push((tIndex + 1).toString());
        }
      });
      
      node.connections = connections;
    });
    
    return workflowNodes;
    
  } catch (error) {
    console.error('Error parsing workflow file:', error);
    const errorMessage = typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message: string }).message
      : String(error);
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

function capitalizeTaskName(taskName: string): string {
  return taskName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function generateDescription(
  taskName: string, 
  templateName: string, 
  template?: ArgoTemplate,
  workflowMeta?: { annotations?: Record<string, string>; labels?: Record<string, string> }
): string {
  // 1. First, check for description in template annotations
  if (template?.metadata?.annotations) {
    const annotations = template.metadata.annotations;
    // Try common description annotation keys
    const descriptionKeys = [
      'description',
      'workflows.argoproj.io/description',
      'summary',
      'documentation',
      'doc',
      'info'
    ];
    
    for (const key of descriptionKeys) {
      if (annotations[key]) {
        return annotations[key];
      }
    }
  }

  // 2. Check for description in template labels
  if (template?.metadata?.labels) {
    const labels = template.metadata.labels;
    if (labels.description || labels.summary) {
      return labels.description || labels.summary;
    }
  }

  // 3. Check workflow-level annotations for task-specific descriptions
  if (workflowMeta?.annotations) {
    const taskSpecificKey = `${taskName}.description`;
    const templateSpecificKey = `${templateName}.description`;
    
    if (workflowMeta.annotations[taskSpecificKey]) {
      return workflowMeta.annotations[taskSpecificKey];
    }
    if (workflowMeta.annotations[templateSpecificKey]) {
      return workflowMeta.annotations[templateSpecificKey];
    }
  }

  // 4. Extract description from container args (like echo statements)
  if (template?.container?.args) {
    const echoArg = template.container.args.find(arg => 
      arg.includes('echo') && arg.includes('Executing')
    );
    if (echoArg) {
      // Extract the echo message: echo 'Executing B task' -> Executing B task
      const match = echoArg.match(/echo\s+['"]([^'"]+)['"]/);
      if (match) {
        return match[1];
      }
    }
  }

  // 5. Use template name (often more descriptive than task name)
  const cleanTemplateName = templateName
    .replace(/-template$/, '') // Remove common -template suffix
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());

  if (cleanTemplateName !== capitalizeTaskName(taskName)) {
    return `Execute ${cleanTemplateName}`;
  }

  // 6. Fall back to task name
  return `Execute ${capitalizeTaskName(taskName)} task`;
}