import type { WorkflowNode } from '../types';
import { getNodeDependencies } from './getNodeDependencies';

export interface CriticalPathNode extends WorkflowNode {
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  slack: number;
  isOnCriticalPath: boolean;
}

export interface CriticalPathResult {
  nodes: CriticalPathNode[];
  criticalPath: CriticalPathNode[];
  orderedCriticalPath: CriticalPathNode[];
  totalDuration: number;
  criticalPathDuration: number;
}

/**
 * Performs Critical Path Method (CPM) analysis on a workflow
 */
export class CriticalPathAnalyzer {
  private nodes: CriticalPathNode[] = [];

  private workflowNodes: WorkflowNode[];

  constructor(workflowNodes: WorkflowNode[]) {
    this.workflowNodes = workflowNodes;
    this.initializeNodes();
  }

  /**
   * Initialize nodes with CPM properties
   */
  private initializeNodes(): void {
    this.nodes = this.workflowNodes.map(node => ({
      ...node,
      earliestStart: 0,
      earliestFinish: 0,
      latestStart: 0,
      latestFinish: 0,
      slack: 0,
      isOnCriticalPath: false
    }));
  }

  /**
   * Performs topological sort using DFS
   */
  private topologicalSort(): string[] {
    const visited = new Set<string>();
    const stack: string[] = [];

    const dfsVisit = (nodeId: string) => {
      visited.add(nodeId);
      
      // Visit all successors (outgoing connections)
      const node = this.nodes.find(n => n.id === nodeId);
      if (node) {
        for (const successorId of node.connections) {
          if (!visited.has(successorId)) {
            dfsVisit(successorId);
          }
        }
      }
      
      stack.push(nodeId);
    };

    // Visit all nodes
    for (const node of this.nodes) {
      if (!visited.has(node.id)) {
        dfsVisit(node.id);
      }
    }

    // Return in reverse order (topological order)
    return stack.reverse();
  }

  /**
   * Forward pass: Calculate earliest start and finish times
   */
  private forwardPass(sortedNodeIds: string[]): void {
    for (const nodeId of sortedNodeIds) {
      const node = this.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      // Get all predecessors (dependencies)
      const predecessorIds = getNodeDependencies(nodeId, this.workflowNodes);
      
      let maxPredecessorFinish = 0;
      for (const predId of predecessorIds) {
        const predecessor = this.nodes.find(n => n.id === predId);
        if (predecessor) {
          maxPredecessorFinish = Math.max(maxPredecessorFinish, predecessor.earliestFinish);
        }
      }

      node.earliestStart = maxPredecessorFinish;
      node.earliestFinish = node.earliestStart + (node.duration || 1);
    }
  }

  /**
   * Backward pass: Calculate latest start and finish times
   */
  private backwardPass(sortedNodeIds: string[]): void {
    // Find maximum earliest finish time
    const maxFinish = Math.max(...this.nodes.map(n => n.earliestFinish));
    
    // Initialize all latest finish times to the project completion time
    for (const node of this.nodes) {
      // For nodes with no successors, set latest finish to earliest finish
      if (node.connections.length === 0) {
        node.latestFinish = node.earliestFinish;
      } else {
        node.latestFinish = maxFinish;
      }
    }

    // Process nodes in reverse topological order
    for (let i = sortedNodeIds.length - 1; i >= 0; i--) {
      const nodeId = sortedNodeIds[i];
      const node = this.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      let minSuccessorStart = node.latestFinish;

      // Check all successors
      for (const successorId of node.connections) {
        const successor = this.nodes.find(n => n.id === successorId);
        if (successor) {
          minSuccessorStart = Math.min(minSuccessorStart, successor.latestStart);
        }
      }

      node.latestFinish = minSuccessorStart;
      node.latestStart = node.latestFinish - (node.duration || 1);
    }
  }

  /**
   * Calculate slack and identify critical path nodes
   */
  private calculateSlackAndCriticalPath(): void {
    for (const node of this.nodes) {
      node.slack = node.latestStart - node.earliestStart;
      
      // Mark as critical if slack is near zero (accounting for floating point precision)
      node.isOnCriticalPath = Math.abs(node.slack) < 0.001;
    }
  }

  /**
   * Get nodes that are on the critical path
   */
  private getCriticalPathNodes(): CriticalPathNode[] {
    return this.nodes.filter(node => node.isOnCriticalPath);
  }

  /**
   * Get the critical path as an ordered sequence
   */
  private getOrderedCriticalPath(): CriticalPathNode[] {
    const criticalNodes = this.getCriticalPathNodes();
    if (criticalNodes.length === 0) return [];

    const ordered: CriticalPathNode[] = [];
    const visited = new Set<string>();

    // Find the starting node (no critical predecessors)
    const startNode = criticalNodes.find(node => {
      const predecessors = getNodeDependencies(node.id, this.workflowNodes);
      return !predecessors.some(predId => 
        criticalNodes.some(critNode => critNode.id === predId)
      );
    });

    if (!startNode) {
      // If no clear start, use the one with earliest start time
      const earliestNode = criticalNodes.reduce((earliest, current) => 
        current.earliestStart < earliest.earliestStart ? current : earliest
      );
      return this.buildOrderedPath(earliestNode, criticalNodes, visited);
    }

    return this.buildOrderedPath(startNode, criticalNodes, visited);
  }

  /**
   * Recursively build the ordered critical path
   */
  private buildOrderedPath(
    current: CriticalPathNode, 
    criticalNodes: CriticalPathNode[], 
    visited: Set<string>
  ): CriticalPathNode[] {
    const path: CriticalPathNode[] = [];
    
    if (visited.has(current.id)) return path;
    
    visited.add(current.id);
    path.push(current);

    // Find next critical node in the sequence
    for (const successorId of current.connections) {
      const successor = criticalNodes.find(node => node.id === successorId);
      if (successor && !visited.has(successor.id)) {
        // Verify this is a critical connection (timing consistency)
        const expectedStart = current.earliestFinish;
        if (Math.abs(expectedStart - successor.earliestStart) < 0.001) {
          path.push(...this.buildOrderedPath(successor, criticalNodes, visited));
        }
      }
    }

    return path;
  }

  /**
   * Perform complete critical path analysis
   */
  public analyze(): CriticalPathResult {
    // 1. Topological sort
    const sortedNodeIds = this.topologicalSort();
    
    // 2. Forward pass
    this.forwardPass(sortedNodeIds);
    
    // 3. Backward pass
    this.backwardPass(sortedNodeIds);
    
    // 4. Calculate slack and identify critical path
    this.calculateSlackAndCriticalPath();
    
    // 5. Get results
    const criticalPath = this.getCriticalPathNodes();
    const orderedCriticalPath = this.getOrderedCriticalPath();
    const totalDuration = Math.max(...this.nodes.map(n => n.earliestFinish));
    
    // Calculate critical path duration
    const criticalPathDuration = orderedCriticalPath.length > 0
      ? orderedCriticalPath[orderedCriticalPath.length - 1].earliestFinish
      : 0;

    return {
      nodes: this.nodes,
      criticalPath,
      orderedCriticalPath,
      totalDuration,
      criticalPathDuration
    };
  }

  /**
   * Print detailed analysis results (for debugging)
   */
  public printDetailedResults(): void {
    const result = this.analyze();
    const sortedNodeIds = this.topologicalSort();
    
    console.log('=== Critical Path Analysis Results ===\n');
    
    // Forward pass
    console.log('Forward pass:');
    for (const nodeId of sortedNodeIds) {
      const node = result.nodes.find(n => n.id === nodeId);
      if (node) {
        console.log(`${node.name} (${nodeId}): EST = ${node.earliestStart.toFixed(1)}, EFT = ${node.earliestFinish.toFixed(1)}`);
      }
    }
    
    // Backward pass
    console.log('\nBackward pass:');
    for (let i = sortedNodeIds.length - 1; i >= 0; i--) {
      const nodeId = sortedNodeIds[i];
      const node = result.nodes.find(n => n.id === nodeId);
      if (node) {
        console.log(`${node.name} (${nodeId}): LFT = ${node.latestFinish.toFixed(1)}, LST = ${node.latestStart.toFixed(1)}`);
      }
    }
    
    // Slack calculations
    console.log('\nSlack calculations:');
    for (const nodeId of sortedNodeIds) {
      const node = result.nodes.find(n => n.id === nodeId);
      if (node) {
        const criticalStatus = node.isOnCriticalPath ? '(Critical)' : '(Not Critical)';
        console.log(`${node.name} (${nodeId}): Slack = ${node.latestStart.toFixed(1)} - ${node.earliestStart.toFixed(1)} = ${node.slack.toFixed(1)} ${criticalStatus}`);
      }
    }
    
    // Critical path
    if (result.orderedCriticalPath.length > 0) {
      const pathNames = result.orderedCriticalPath.map(node => node.name).join(' → ');
      console.log(`\nCritical path: ${pathNames}`);
      console.log(`Total project duration: ${result.totalDuration.toFixed(1)} time units`);
    } else {
      console.log('\nNo critical path found.');
    }
  }
}

/**
 * Utility function to analyze critical path for workflow nodes
 */
export function analyzeCriticalPath(nodes: WorkflowNode[]): CriticalPathResult {
  const analyzer = new CriticalPathAnalyzer(nodes);
  return analyzer.analyze();
}

/**
 * Get just the critical path nodes in order
 */
export function getCriticalPath(nodes: WorkflowNode[]): WorkflowNode[] {
  const result = analyzeCriticalPath(nodes);
  return result.orderedCriticalPath;
}

/**
 * Get the project completion time
 */
export function getProjectDuration(nodes: WorkflowNode[]): number {
  const result = analyzeCriticalPath(nodes);
  return result.totalDuration;
}