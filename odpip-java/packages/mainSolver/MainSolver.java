package mainSolver;

import inclusionExclusionSolver.InclusionExclusionSolver;
import inclusionExclusionSolver.InclusionExclusionWithoutBigInteger;
import inputOutput.*;
import dpSolver.*;
import ipSolver.*;

public class MainSolver
{
	/** The main method which calls all solvers that are selected by the user.
	 */	
	public Result solve( Input input )	
	{
		ComputeErrorBars computeErrorBars = new ComputeErrorBars(input); //to compute the error when averaging over multiple runs

		for( int problemID=1; problemID<=input.numOfRunningTimes; problemID++) //for every problem instance
		{			
			input.problemID = (new Integer(problemID)).toString();
			Result result = new Result(input);
			Output output = new Output();
			output.initOutput( input );

			//If required, store the coalition values in a file
			if( input.storeCoalitionValuesInFile )
				input.storeCoalitionValuesInFile( problemID );
			
			if ( input.solverName == SolverNames.InclusionExclusion ){
				InclusionExclusionSolver inclusionExclusionSolver = new InclusionExclusionSolver(); inclusionExclusionSolver.solve( input, result );
			}
			else if ( (input.solverName == SolverNames.DP) || (input.solverName == SolverNames.IDP) ){
				DPSolver dpSolver = new DPSolver(input, result); dpSolver.runDPorIDP();
			}
			else if ( (input.solverName == SolverNames.ODP) ){
				DPSolver dpSolver = new DPSolver(input, result); dpSolver.runODP();
			}
			else if ( (input.solverName == SolverNames.IP) || (input.solverName == SolverNames.ODPIP)  || (input.solverName == SolverNames.ODPinParallelWithIP) ){
				IPSolver ipSolver = new IPSolver(); ipSolver.solve( input, output, result );
			}
			if( input.numOfRunningTimes == 1 ) {
				return( result );
			}else{
				computeErrorBars.addResults( result, input );
				if( problemID < input.numOfRunningTimes ){
					if( input.readCoalitionValuesFromFile )
						input.readCoalitionValuesFromFile( problemID+1 );
					else
						input.generateCoalitionValues();
				}
				System.out.println(input.numOfAgents+" agents, "+ValueDistribution.toString(input.valueDistribution)+" distribution. The solver just finished solving "+input.problemID+" problems out of  "+input.numOfRunningTimes);
				if ( input.solverName == SolverNames.InclusionExclusion ) System.out.println("runtime for Inclusion-Exclusion (in milliseconds) was: "+result.inclusionExclusionTime);
			}
		}		
		Result averageResult = computeErrorBars.setAverageResultAndConfidenceIntervals( input );
		return( averageResult );
	}
}