export class SCPCPUtils {
  static calculateSCPCP(
    totalTasks: number,
    criticalPathLength: number,
    totalWorkerTime: number
  ): number {
    if (totalTasks === 0 || criticalPathLength === 0) {
      return 0;
    }

    const idealTime = Math.max(criticalPathLength, totalTasks / (totalWorkerTime || 1));
    const scpcp = idealTime / criticalPathLength;

    return scpcp;
  }
}
