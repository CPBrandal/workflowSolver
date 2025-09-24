import type { CriticalPathNode, CriticalPathResult, WorkflowNode } from '../types';
import { getNodeDependencies } from './getNodeDependencies';

/**
 * Performs Critical Path Method (CPM) analysis on a workflow
 */
export class CriticalPathAnalyzer {
  private nodes: CriticalPathNode[] = [];
  private workflowNodes: WorkflowNode[];
  private includeTransferTimes: boolean;

  constructor(workflowNodes: WorkflowNode[], includeTransferTimes: boolean = false) {
    this.workflowNodes = workflowNodes;
    this.includeTransferTimes = includeTransferTimes;
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
      isOnCriticalPath: false,
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

      const node = this.nodes.find(n => n.id === nodeId);
      if (node) {
        for (const edge of node.connections) {
          const successorId = edge.targetNodeId;
          if (!visited.has(successorId)) {
            dfsVisit(successorId);
          }
        }
      }

      stack.push(nodeId);
    };

    for (const node of this.nodes) {
      if (!visited.has(node.id)) {
        dfsVisit(node.id);
      }
    }

    return stack.reverse();
  }

  /**
   * Find the edge between two nodes
   */
  private findEdge(fromNodeId: string, toNodeId: string): { transferTime: number } | null {
    const fromNode = this.workflowNodes.find(n => n.id === fromNodeId);
    if (!fromNode) return null;

    const edge = fromNode.connections.find(edge => edge.targetNodeId === toNodeId);
    return edge ? { transferTime: edge.transferTime || 0 } : null;
  }

  /**
   * Forward pass: Calculate earliest start and finish times
   */
  private forwardPass(sortedNodeIds: string[]): void {
    for (const nodeId of sortedNodeIds) {
      const node = this.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      const predecessorIds = getNodeDependencies(nodeId, this.workflowNodes);

      let maxPredecessorFinishWithTransfer = 0;

      for (const predId of predecessorIds) {
        const predecessor = this.nodes.find(n => n.id === predId);
        if (predecessor) {
          const edge = this.findEdge(predId, nodeId);
          // Use transfer time only if includeTransferTimes is true
          const transferTime = this.includeTransferTimes ? edge?.transferTime || 0 : 0;

          const availableTime = predecessor.earliestFinish + transferTime;
          maxPredecessorFinishWithTransfer = Math.max(
            maxPredecessorFinishWithTransfer,
            availableTime
          );
        }
      }

      node.earliestStart = maxPredecessorFinishWithTransfer;
      node.earliestFinish = node.earliestStart + (node.executionTime || 1);
    }
  }

  /**
   * Backward pass: Calculate latest start and finish times
   */
  private backwardPass(sortedNodeIds: string[]): void {
    const maxFinish = Math.max(...this.nodes.map(n => n.earliestFinish));

    for (const node of this.nodes) {
      if (node.connections.length === 0) {
        node.latestFinish = node.earliestFinish;
      } else {
        node.latestFinish = maxFinish;
      }
    }

    for (let i = sortedNodeIds.length - 1; i >= 0; i--) {
      const nodeId = sortedNodeIds[i];
      const node = this.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      let minLatestFinish = node.latestFinish;

      for (const edge of node.connections) {
        const successor = this.nodes.find(n => n.id === edge.targetNodeId);
        if (successor) {
          // Use transfer time only if includeTransferTimes is true
          const transferTime = this.includeTransferTimes ? edge.transferTime || 0 : 0;
          const requiredFinishTime = successor.latestStart - transferTime;
          minLatestFinish = Math.min(minLatestFinish, requiredFinishTime);
        }
      }

      node.latestFinish = minLatestFinish;
      node.latestStart = node.latestFinish - (node.executionTime || 1);
    }
  }

  private calculateSlackAndCriticalPath(): void {
    // Set all nodes with slack 0 to CP=True
    for (const node of this.nodes) {
      node.slack = node.latestStart - node.earliestStart;
      node.isOnCriticalPath = Math.abs(node.slack) < 0.001;
    }

    // Create list to track the single critical path
    const criticalPath: CriticalPathNode[] = [];

    // Find start node (earliest start == 0 and is on critical path)
    const startNode = this.nodes.find(n => n.earliestStart === 0 && n.isOnCriticalPath);
    if (!startNode) return;

    // Add start node to critical path
    criticalPath.push(startNode);

    // Traverse through connections to build the critical path
    let currentNode = startNode;

    while (currentNode.connections.length > 0) {
      let nextNode: CriticalPathNode | undefined = undefined;

      // First try to find a node at the next level (no level skipping)
      for (const connection of currentNode.connections) {
        const node = this.nodes.find(
          n =>
            n.id === connection.targetNodeId &&
            n.isOnCriticalPath &&
            n.level === currentNode.level + 1 // Ensure we go level by level
        );
        if (node) {
          nextNode = node;
          break;
        }
      }

      // If no node found at next level, look for any connected critical node (for end nodes)
      if (!nextNode) {
        for (const connection of currentNode.connections) {
          const node = this.nodes.find(n => n.id === connection.targetNodeId && n.isOnCriticalPath);
          if (node) {
            nextNode = node;
            break;
          }
        }
      }

      if (!nextNode) break;

      criticalPath.push(nextNode);
      currentNode = nextNode;
    }

    // Get IDs of nodes in the critical path
    const criticalPathIds = new Set(criticalPath.map(n => n.id));

    // Set all nodes not in criticalPath to criticalPath = false
    for (const node of this.nodes) {
      if (!criticalPathIds.has(node.id)) {
        node.isOnCriticalPath = false;
      }
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

    const visited = new Set<string>();

    const startNode = criticalNodes.find(node => {
      const predecessors = getNodeDependencies(node.id, this.workflowNodes);
      return !predecessors.some(predId => criticalNodes.some(critNode => critNode.id === predId));
    });

    if (!startNode) {
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

    for (const edge of current.connections) {
      const successor = criticalNodes.find(node => node.id === edge.targetNodeId);
      if (successor && !visited.has(successor.id)) {
        // Use transfer time only if includeTransferTimes is true
        const transferTime = this.includeTransferTimes ? edge.transferTime || 0 : 0;
        const expectedStart = current.earliestFinish + transferTime;

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
    const sortedNodeIds = this.topologicalSort();
    this.forwardPass(sortedNodeIds);
    this.backwardPass(sortedNodeIds);
    this.calculateSlackAndCriticalPath();

    const criticalPath = this.getCriticalPathNodes();
    const orderedCriticalPath = this.getOrderedCriticalPath();
    const minimumProjectDuration = Math.max(...this.nodes.map(n => n.earliestFinish));

    const criticalPathDuration =
      orderedCriticalPath.length > 0
        ? orderedCriticalPath[orderedCriticalPath.length - 1].earliestFinish
        : 0;

    return {
      nodes: this.nodes,
      criticalPath,
      orderedCriticalPath,
      minimumProjectDuration,
      criticalPathDuration,
    };
  }
}

/**
 * Utility function to analyze critical path for workflow nodes
 */
export function analyzeCriticalPath(
  nodes: WorkflowNode[],
  includeTransferTimes: boolean = true
): CriticalPathResult {
  const analyzer = new CriticalPathAnalyzer(nodes, includeTransferTimes);
  return analyzer.analyze();
}

/**
 * Get just the critical path nodes in order
 */
export function getCriticalPath(
  nodes: WorkflowNode[],
  includeTransferTimes: boolean = true
): WorkflowNode[] {
  if (!nodes || nodes.length === 0) return [];
  const result = analyzeCriticalPath(nodes, includeTransferTimes);
  return result.orderedCriticalPath;
}

/**
 * Get the project completion time
 */
export function getProjectDuration(
  nodes: WorkflowNode[],
  includeTransferTimes: boolean = true
): number {
  const result = analyzeCriticalPath(nodes, includeTransferTimes);
  return result.minimumProjectDuration;
}

export function setCriticalPathEdgesTransferTimes(nodes: WorkflowNode[]): Boolean {
  if (!nodes || nodes.length === 0) return false;
  const getCriticalPathNodes = getCriticalPath(nodes, false); // Use execution times only
  for (let i = 0; i < getCriticalPathNodes.length - 1; i++) {
    for (const edge of getCriticalPathNodes[i].connections) {
      if (edge.targetNodeId === getCriticalPathNodes[i + 1].id) {
        edge.transferTime = 0;
        break;
      }
    }
  }
  return true;
}

export function getMinimumProjectDuration(nodes: WorkflowNode[]): number {
  // Get theoretical minimum using execution times only
  const result = analyzeCriticalPath(nodes, false);
  return result.minimumProjectDuration;
}
