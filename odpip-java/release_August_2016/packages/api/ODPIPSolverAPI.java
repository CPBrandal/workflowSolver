package api;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintStream;

import inputOutput.Input;
import inputOutput.SolverNames;
import mainSolver.MainSolver;
import mainSolver.Result;

/**
 * A simple API for the ODP-IP solver without GUI.
 * 
 * Usage:
 *   ODPIPSolverAPI.SolverResult result = ODPIPSolverAPI.solve(numOfAgents, coalitionValues);
 *   System.out.println("Best partition: " + result.bestPartition);
 *   System.out.println("Value: " + result.value);
 */
public class ODPIPSolverAPI {
    
    /**
     * Result class containing the optimal partition and its value
     */
    public static class SolverResult {
        /** The optimal partition as a 2D array with agent indices (1-indexed) */
        public int[][] bestPartition;
        
        /** The value of the optimal partition */
        public double value;
        
        /** Time taken in milliseconds */
        public long timeMs;
        
        /** JSON representation of the result */
        public String toJSON() {
            StringBuilder sb = new StringBuilder();
            sb.append("{");
            sb.append("\"value\":").append(value).append(",");
            sb.append("\"timeMs\":").append(timeMs).append(",");
            sb.append("\"partition\":[");
            for (int i = 0; i < bestPartition.length; i++) {
                sb.append("[");
                for (int j = 0; j < bestPartition[i].length; j++) {
                    sb.append(bestPartition[i][j]);
                    if (j < bestPartition[i].length - 1) sb.append(",");
                }
                sb.append("]");
                if (i < bestPartition.length - 1) sb.append(",");
            }
            sb.append("]}");
            return sb.toString();
        }
        
        @Override
        public String toString() {
            StringBuilder sb = new StringBuilder();
            sb.append("Optimal Partition: {");
            for (int i = 0; i < bestPartition.length; i++) {
                sb.append("{");
                for (int j = 0; j < bestPartition[i].length; j++) {
                    sb.append("a").append(bestPartition[i][j]);
                    if (j < bestPartition[i].length - 1) sb.append(",");
                }
                sb.append("}");
                if (i < bestPartition.length - 1) sb.append(", ");
            }
            sb.append("}\n");
            sb.append("Value: ").append(value).append("\n");
            sb.append("Time: ").append(timeMs).append(" ms");
            return sb.toString();
        }
    }
    
    /**
     * Solve the complete set partitioning problem using ODP-IP algorithm.
     * 
     * @param numOfAgents Number of agents/elements to partition
     * @param coalitionValues Array of coalition values. Must have exactly 2^numOfAgents elements.
     *                        coalitionValues[i] is the value of the coalition represented by bits of i.
     *                        Example for 4 agents: coalitionValues[5] = value of {a1,a3} since 5 = 0101 binary
     * @return SolverResult containing the optimal partition and its value
     */
    public static SolverResult solve(int numOfAgents, double[] coalitionValues) {
        // Validate input
        int expectedLength = (int) Math.pow(2, numOfAgents);
        if (coalitionValues.length != expectedLength) {
            throw new IllegalArgumentException(
                "coalitionValues must have exactly 2^numOfAgents = " + expectedLength + 
                " elements, but got " + coalitionValues.length
            );
        }
        if (numOfAgents > 25) {
            throw new IllegalArgumentException(
                "Number of agents cannot exceed 25 (got " + numOfAgents + ")"
            );
        }
        
        // Setup input
        Input input = new Input();
        input.initInput();
        input.numOfAgents = numOfAgents;
        input.coalitionValues = coalitionValues;
        input.solverName = SolverNames.ODPIP;
        input.acceptableRatio = 100; // 100% means find exact optimal
        input.orderIntegerPartitionsAscendingly = false;
        input.printInterimResultsOfIPToFiles = false;
        input.printTimeTakenByIPForEachSubspace = false;
        
        // Suppress solver's debug output (both stdout and stderr)
        PrintStream originalOut = System.out;
        PrintStream originalErr = System.err;
        PrintStream nullStream = new PrintStream(new java.io.OutputStream() {
            public void write(int b) {}
        });
        System.setOut(nullStream);
        System.setErr(nullStream);
        
        // Run solver
        long startTime = System.currentTimeMillis();
        MainSolver mainSolver = new MainSolver();
        Result result = mainSolver.solve(input);
        long endTime = System.currentTimeMillis();
        
        // Wait briefly for any background threads to finish their output
        try { Thread.sleep(50); } catch (InterruptedException e) {}
        
        // Restore output
        System.setOut(originalOut);
        System.setErr(originalErr);
        
        // Build result - ipBestCSFound is already in agent index format (1-indexed)
        SolverResult solverResult = new SolverResult();
        solverResult.bestPartition = result.get_ipBestCSFound();
        solverResult.value = result.get_ipValueOfBestCSFound();
        solverResult.timeMs = endTime - startTime;
        
        return solverResult;
    }
    
    /**
     * Convenience method that accepts int array instead of double array
     */
    public static SolverResult solve(int numOfAgents, int[] coalitionValues) {
        double[] doubleValues = new double[coalitionValues.length];
        for (int i = 0; i < coalitionValues.length; i++) {
            doubleValues[i] = coalitionValues[i];
        }
        return solve(numOfAgents, doubleValues);
    }
    
    /**
     * Main method for command-line usage.
     * Usage: java api.ODPIPSolverAPI <numOfAgents> <value0> <value1> ... <value2^n-1>
     * Or read from stdin: java api.ODPIPSolverAPI --stdin
     */
    public static void main(String[] args) {
        if (args.length == 0) {
            // Example usage
            System.out.println("ODP-IP Solver API");
            System.out.println("=================\n");

            // Example from README: 4 agents
            int numOfAgents = 4;
            double[] coalitionValues = {
                0,    // {}
                30,   // {a1}
                40,   // {a2}
                50,   // {a1,a2}
                25,   // {a3}
                60,   // {a1,a3}
                55,   // {a2,a3}
                90,   // {a1,a2,a3}
                45,   // {a4}
                80,   // {a1,a4}
                70,   // {a2,a4}
                120,  // {a1,a2,a4}
                80,   // {a3,a4}
                100,  // {a1,a3,a4}
                115,  // {a2,a3,a4}
                140   // {a1,a2,a3,a4}
            };

            System.out.println("Running example with " + numOfAgents + " agents...\n");

            SolverResult result = solve(numOfAgents, coalitionValues);
            System.out.println(result);
            System.out.println("\nJSON output:");
            System.out.println(result.toJSON());

        } else if (args[0].equals("--stdin")) {
            // Read JSON from stdin
            try {
                BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
                StringBuilder jsonInput = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    jsonInput.append(line);
                }
                reader.close();

                // Simple JSON parsing (no external library needed)
                String json = jsonInput.toString();

                // Extract numOfAgents
                int numStart = json.indexOf("\"numOfAgents\":") + 14;
                int numEnd = json.indexOf(",", numStart);
                if (numEnd == -1) numEnd = json.indexOf("}", numStart);
                int numOfAgents = Integer.parseInt(json.substring(numStart, numEnd).trim());

                // Extract coalitionValues array
                int arrStart = json.indexOf("[", json.indexOf("\"coalitionValues\"")) + 1;
                int arrEnd = json.lastIndexOf("]");
                String arrStr = json.substring(arrStart, arrEnd);
                String[] valueStrings = arrStr.split(",");

                double[] coalitionValues = new double[valueStrings.length];
                for (int i = 0; i < valueStrings.length; i++) {
                    coalitionValues[i] = Double.parseDouble(valueStrings[i].trim());
                }

                SolverResult result = solve(numOfAgents, coalitionValues);
                System.out.println(result.toJSON());

            } catch (Exception e) {
                System.err.println("Error reading stdin: " + e.getMessage());
                System.exit(1);
            }
        } else {
            // Parse command line arguments
            try {
                int numOfAgents = Integer.parseInt(args[0]);
                int expectedValues = (int) Math.pow(2, numOfAgents);

                if (args.length != expectedValues + 1) {
                    System.err.println("Expected " + expectedValues + " coalition values for " +
                                       numOfAgents + " agents, got " + (args.length - 1));
                    System.exit(1);
                }

                double[] coalitionValues = new double[expectedValues];
                for (int i = 0; i < expectedValues; i++) {
                    coalitionValues[i] = Double.parseDouble(args[i + 1]);
                }

                SolverResult result = solve(numOfAgents, coalitionValues);
                System.out.println(result.toJSON());

            } catch (NumberFormatException e) {
                System.err.println("Error parsing arguments: " + e.getMessage());
                System.exit(1);
            }
        }
    }
}
