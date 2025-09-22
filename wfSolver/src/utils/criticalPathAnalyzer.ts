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

  /**
   * Calculate slack and identify critical path nodes
   */
  private calculateSlackAndCriticalPath(): void {
    for (const node of this.nodes) {
      node.slack = node.latestStart - node.earliestStart;
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

  /**
   * Print detailed analysis results (for debugging) - now includes transfer times
   */
  public printDetailedResults(): void {
    const result = this.analyze();
    const sortedNodeIds = this.topologicalSort();

    console.log('=== Critical Path Analysis Results (with Transfer Times) ===\n');

    // Forward pass
    console.log('Forward pass:');
    for (const nodeId of sortedNodeIds) {
      const node = result.nodes.find(n => n.id === nodeId);
      if (node) {
        const predecessors = getNodeDependencies(nodeId, this.workflowNodes);
        let transferDetails = '';

        if (predecessors.length > 0) {
          const transfers = predecessors
            .map(predId => {
              const edge = this.findEdge(predId, nodeId);
              const predNode = this.workflowNodes.find(n => n.id === predId);
              return `${predNode?.name}+${edge?.transferTime || 0}s`;
            })
            .join(', ');
          transferDetails = ` [from: ${transfers}]`;
        }

        console.log(
          `${node.name} (${nodeId}): EST = ${node.earliestStart.toFixed(1)}, EFT = ${node.earliestFinish.toFixed(1)}${transferDetails}`
        );
      }
    }

    // Backward pass
    console.log('\nBackward pass:');
    for (let i = sortedNodeIds.length - 1; i >= 0; i--) {
      const nodeId = sortedNodeIds[i];
      const node = result.nodes.find(n => n.id === nodeId);
      if (node) {
        let transferDetails = '';

        if (node.connections.length > 0) {
          const transfers = node.connections
            .map(edge => {
              const targetNode = this.workflowNodes.find(n => n.id === edge.targetNodeId);
              return `${targetNode?.name}+${edge.transferTime || 0}s`;
            })
            .join(', ');
          transferDetails = ` [to: ${transfers}]`;
        }

        console.log(
          `${node.name} (${nodeId}): LFT = ${node.latestFinish.toFixed(1)}, LST = ${node.latestStart.toFixed(1)}${transferDetails}`
        );
      }
    }

    // Slack calculations
    console.log('\nSlack calculations:');
    for (const nodeId of sortedNodeIds) {
      const node = result.nodes.find(n => n.id === nodeId);
      if (node) {
        const criticalStatus = node.isOnCriticalPath ? '(Critical)' : '(Not Critical)';
        console.log(
          `${node.name} (${nodeId}): Slack = ${node.latestStart.toFixed(1)} - ${node.earliestStart.toFixed(1)} = ${node.slack.toFixed(1)} ${criticalStatus}`
        );
      }
    }

    // Critical path with transfer times
    if (result.orderedCriticalPath.length > 0) {
      const pathWithTransfers: string[] = [];

      for (let i = 0; i < result.orderedCriticalPath.length; i++) {
        const current = result.orderedCriticalPath[i];
        pathWithTransfers.push(current.name);

        // Add transfer time to next node if not the last node
        if (i < result.orderedCriticalPath.length - 1) {
          const next = result.orderedCriticalPath[i + 1];
          const edge = this.findEdge(current.id, next.id);
          if (edge && edge.transferTime > 0) {
            pathWithTransfers.push(`--${edge.transferTime}s--`);
          } else {
            pathWithTransfers.push('-->');
          }
        }
      }

      console.log(`\nCritical path: ${pathWithTransfers.join(' ')}`);
      console.log(`Total project duration: ${result.minimumProjectDuration.toFixed(1)} time units`);
    } else {
      console.log('\nNo critical path found.');
    }
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
