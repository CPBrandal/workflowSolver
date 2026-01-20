const API_BASE = 'http://localhost:3001';

export interface ODPIPResult {
  value: number;
  timeMs: number;
  partition: number[][];
}

export interface ODPIPError {
  error: string;
  details?: string;
}

/**
 * Call the ODP-IP solver backend to find the optimal partition.
 *
 * @param numOfAgents Number of agents/elements to partition
 * @param coalitionValues Array of coalition values (length must be 2^numOfAgents)
 * @returns The optimal partition result
 */
export async function solveODPIP(
  numOfAgents: number,
  coalitionValues: number[]
): Promise<ODPIPResult> {
  const response = await fetch(`${API_BASE}/api/odpip/solve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ numOfAgents, coalitionValues }),
  });

  if (!response.ok) {
    const errorData: ODPIPError = await response.json();
    throw new Error(errorData.error || 'Solver request failed');
  }

  return response.json();
}

/**
 * Check if the backend server is running.
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}
