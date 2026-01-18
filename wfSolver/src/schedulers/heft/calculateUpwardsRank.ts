import type { WorkflowNode } from '../../types';

/**
 * Calculate upward rank for all nodes using recursive approach
 */
export function calculateUpwardRanks(nodes: WorkflowNode[], includeTransferTimes: boolean) {
  const ranks = new Map<string, number>();
  const visited = new Set<string>();

  nodes.forEach(node => calculateRank(node));

  function calculateRank(node: WorkflowNode) {
    if (ranks.has(node.id)) {
      return ranks.get(node.id)!;
    }

    if (visited.has(node.id)) {
      return 0;
    }

    visited.add(node.id);

    const executionTime = node.executionTime || 0;
    const successors = getSuccessors(node);

    if (successors.length === 0) {
      ranks.set(node.id, executionTime);
      return executionTime;
    }

    let maxSuccessorRank = 0;
    for (const successorId of successors) {
      const transferTime = getTransferTime(node.id, successorId);
      const successorNode = nodes.find(n => n.id === successorId)!;
      const successorRank = calculateRank(successorNode);
      maxSuccessorRank = Math.max(maxSuccessorRank, transferTime + successorRank);
    }

    const rank = executionTime + maxSuccessorRank;
    ranks.set(node.id, rank);
    return rank;
  }

  function getSuccessors(node: WorkflowNode) {
    return node.connections.map(conn => conn.targetNodeId);
  }

  function getTransferTime(sourceId: string, targetId: string) {
    if (!includeTransferTimes) return 0;
    const sourceNode = nodes.find(n => n.id === sourceId);
    if (!sourceNode) return 0;
    const connection = sourceNode.connections.find(c => c.targetNodeId === targetId);
    return connection ? connection.transferTime : 0;
  }

  return Array.from(ranks.entries()).map(([nodeId, rank]) => ({ nodeId, rank }));
}
