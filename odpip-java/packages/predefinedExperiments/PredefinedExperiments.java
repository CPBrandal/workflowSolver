package predefinedExperiments;

import inputOutput.Input;
import inputOutput.SolverNames;
import inputOutput.ValueDistribution;

public class PredefinedExperiments
{
	/**
	 * This method runs pre-defined experiments.
	 */
	public void run()
	{	
		boolean readCoalitionValuesFromFile = false; // Whatever value you assign to this parameter, all problem instances (i.e., coalition values) will be generated randomly.
		// However, the main question is whether to store those value in a file, so that later on all solvers "read" and solve the exact same instances. Setting this parameter
		// to false means it's ok for different solvers to solve different problem instances (since all those problems are generated from the same distribution).
		if( readCoalitionValuesFromFile )
			generateAndWriteCoalitionValuesToFile(); // we need to generate and store coalition values, before running any experiment. 
		
		/* Compute and print the number of movements evaluated by DP, IDP, and ODP
		 */
//		NumOfEvaluatedSplitsByDPAndIDPAndODP computeNumOfEvaluatedSplits = new NumOfEvaluatedSplitsByDPAndIDPAndODP();
//		computeNumOfEvaluatedSplits.run();
		
	    /* Compute and print the number of coalition structures and subspaces that are pruned by IDP at different coalition sizes.
	     */
//		NumOfCSandSubspacesPrunedByIDP numOfCSandSubspacesPrunedByIDP = new NumOfCSandSubspacesPrunedByIDP();
//		numOfCSandSubspacesPrunedByIDP.run();
		
		/* Run DP and IDP and ODP given different Numbers of agents.
		 */
//		RunDPAndIDPAndODP runDPAndIDPAndODP = new RunDPAndIDPAndODP();
//		runDPAndIDPAndODP.run( readCoalitionValuesFromFile );
		
		/* Run ODP in parallel with IP
		 */
//		RunIPorODPIP runODPIP = new RunIPorODPIP();  
//		runODPIP.run( readCoalitionValuesFromFile, SolverNames.ODPinParallelWithIP, false, false ); // run ODP in parallel with IP
		
		/* Run ODP-IP for different numbers of agents and different distributions, without searching multiple subspaces simultaneously)
		 */
//		RunIPorODPIP runODPIP_withoutSimultaneousSearch = new RunIPorODPIP();  
//		runODPIP_withoutSimultaneousSearch.run( readCoalitionValuesFromFile, SolverNames.ODPIP, true, false ); // run ODP-IP with searching subspaces simultaneously
		
		/* Run ODP-IP for different numbers of agents and different distributions, without improving IP's branch-and-bound using ODP's outcome)
		 */
		RunIPorODPIP runODPIP_withoutFasterBranchAndBound = new RunIPorODPIP();  
		runODPIP_withoutFasterBranchAndBound.run( readCoalitionValuesFromFile, SolverNames.ODPIP, false, true ); // run ODP-IP with improved branch-and-bound

		/* Run ODP-IP for different numbers of agents and different distributions.
		 */
		RunIPorODPIP runODPinParallelWithIP = new RunIPorODPIP();  
		runODPinParallelWithIP.run( readCoalitionValuesFromFile, SolverNames.ODPIP, true, true ); // run ODP-IP

		/* Run IP for different numbers of agents, and for different distributions.
		 */
		RunIPorODPIP runIP = new RunIPorODPIP(); 
		runIP.run( readCoalitionValuesFromFile, SolverNames.IP, false, false ); // run IP
		
		/* Run the Inclusion-Exclusion algorithm given different Numbers of agents.
		 */
//		RunInclusionExclusion runInclusionExclusion = new RunInclusionExclusion();
//		runInclusionExclusion.run( readCoalitionValuesFromFile );

	}
	
	//*****************************************************************************************************
	
	/**
	 * We will be computing the results as an average of several runs. This
	 * method computes the number of runs based on the number of agents.
	 */
	public int getNumOfRunningTimes( int numOfAgents )
	{
		if( numOfAgents == 5 ) return(300);
		if( numOfAgents == 6 ) return(100);
		if( numOfAgents == 7 ) return(50);
		if( numOfAgents == 8 ) return(25);
		if( numOfAgents == 9 ) return(10);
		if( numOfAgents == 10 ) return(7);
		if( numOfAgents == 11 ) return(4);
		if( numOfAgents == 12 ) return(1);
		if( numOfAgents == 13 ) return(1);
		if( numOfAgents == 14 ) return(3);
		if( numOfAgents == 15 ) return(3);
		if( numOfAgents == 16 ) return(400);
		if( numOfAgents == 17 ) return(3);
		if( numOfAgents == 18 ) return(3);
		if( numOfAgents == 19 ) return(3);
		if( numOfAgents == 20 ) return(3);
		if( numOfAgents == 21 ) return(3);
		if( numOfAgents == 22 ) return(175);
		if( numOfAgents == 23 ) return(150);
		if( numOfAgents == 24 ) return(120);
		if( numOfAgents == 25 ) return(100);
		if( numOfAgents == 26 ) return(50);
		if( numOfAgents == 27 ) return(15);
		return(1);
	}
	
	//******************************************************************************************************

	/**
	 * For different No. of agents, generate multiple coalition values (and externalities) and store them in a file
	 */
	public void generateAndWriteCoalitionValuesToFile()
	{
		Input input = new Input();
		input.folderInWhichCoalitionValuesAreStored = "D:/CSGdata/coalitionValues";
		
		//The range of agents for which we need to write coalition values and externalities
		int minNumOfAgents = 15; int maxNumOfAgents = 15;
		
		//Set the distributions that are going to be used in the experiments
		ValueDistribution[] valueDistributions = { ValueDistribution.UNIFORM, ValueDistribution.NORMAL, ValueDistribution.NDCS, ValueDistribution.EXPONENTIAL, ValueDistribution.BETA,
				ValueDistribution.GAMMA, ValueDistribution.MODIFIEDUNIFORM, ValueDistribution.MODIFIEDNORMAL, ValueDistribution.AGENTBASEDUNIFORM, ValueDistribution.AGENTBASEDNORMAL};
		
		//for every value distribution
		for(int distributionID = 0; distributionID < valueDistributions.length; distributionID++)
		{
			input.valueDistribution = valueDistributions[ distributionID ];

			input.folderInWhichCoalitionValuesAreStored = "D:/CSGdata/coalitionValues";

			//For every number of agents
			for(input.numOfAgents=minNumOfAgents; input.numOfAgents<=maxNumOfAgents; input.numOfAgents++)
			{
				//Get the number of instances (of coalition values and externalities) we want to generate
				int numOfRunningTimes = getNumOfRunningTimes( input.numOfAgents );
				
				for(int problemID=1; problemID<=numOfRunningTimes; problemID++)
				{
					//Generate new coalition values
					input.generateCoalitionValues();
					
					//Write the new coalition values to a file
					input.storeCoalitionValuesInFile( problemID );
				}
			}
		}
	}
}