package predefinedExperiments;

import java.text.SimpleDateFormat;
import java.util.Calendar;

import general.General;
import inputOutput.Input;
import inputOutput.SolverNames;
import inputOutput.ValueDistribution;
import mainSolver.MainSolver;
import mainSolver.Result;

public class RunInclusionExclusion
{
	private String[][] str_inclusionExclusionTime;
	private String[][] str_inclusionExclusionTime_confidenceInterval;


	//*****************************************************************************************************

	/**
	 * Run Inclusion-Exclusion for different numbers of agents, and for different distributions. It prints the the average time.
	 * 
	 * @param readCoalitionValuesFromFile  if this is "true", coalition values will be read from a file. Otherwise, they will be generated randomly.
	 */	
	public void run( boolean readCoalitionValuesFromFile  )
	{
		//Initialize the input parameters
		Input input = initializeInput();
		input.readCoalitionValuesFromFile = readCoalitionValuesFromFile;

		//Create the main output folder
		Calendar calendar = Calendar.getInstance();
		SimpleDateFormat simpleDateFormat = new SimpleDateFormat( "yyyy-MM-dd (HH-mm-ss)" );
		String mainOutputFolder;
		mainOutputFolder = "D:/CSGresults/InclusionExclusion "+simpleDateFormat.format(calendar.getTime());
		General.createFolder( mainOutputFolder );

		//The numbers of agents for which we are going to run our experiments
		int minNumOfAgents = 5; int maxNumOfAgents = 12;

		//Set the distributions that are going to be used in the experiments
		ValueDistribution[] valueDistributions = { /*ValueDistribution.BETA, ValueDistribution.AGENTBASEDNORMAL,*/ ValueDistribution.GAMMA, ValueDistribution.NORMAL, ValueDistribution.UNIFORM,
				ValueDistribution.NDCS, ValueDistribution.EXPONENTIAL, ValueDistribution.MODIFIEDUNIFORM, ValueDistribution.MODIFIEDNORMAL, ValueDistribution.AGENTBASEDUNIFORM};
		
		//Initialize the strings in which we're storing results
		initializeStringsOfResults( minNumOfAgents, maxNumOfAgents, valueDistributions.length );

		//For every number of agents
		for(input.numOfAgents=minNumOfAgents; input.numOfAgents<=maxNumOfAgents; input.numOfAgents++)
		{
			//Get the No. of running times based on the number of agents
			input.numOfRunningTimes = (new PredefinedExperiments()).getNumOfRunningTimes( input.numOfAgents );

			//for every value distribution
			for(int distributionID=0; distributionID < valueDistributions.length; distributionID++)
			{
				input.valueDistribution = valueDistributions[ distributionID ];

				//Set the name of the output folder for interim results
				setNameOfOutputFolder( mainOutputFolder, input, valueDistributions[ distributionID ] );

				//determine whether to read the coalition values from a file, or generate random ones
				if( input.readCoalitionValuesFromFile ){
					input.folderInWhichCoalitionValuesAreStored = "D:/CSGdata/coalitionValues";
					input.readCoalitionValuesFromFile( 1 );
				}else
					input.generateCoalitionValues();

				Result result = (new MainSolver()).solve( input ); //Run the CSG algorithm(s)

				updateStringsOfResults( input, result, distributionID ); //Update the strings in which we are storing the results
				printCurrentResultsToFile(input, mainOutputFolder, valueDistributions, distributionID );
			}
		}
	}

	//*****************************************************************************************************

	/**
	 * Set the majority of the input parameters
	 */
	private Input initializeInput()
	{
		Input input = new Input();
		input.solverName = SolverNames.InclusionExclusion;
		input.folderInWhichCoalitionValuesAreStored = "D:/CSGdata/coalitionValues";

		//We set the rest to "false" since we do not want the solver(s) to print any results. This is because this class uses
		//its own printing method (to produce results in a certain format that is designed to facilitate plotting in Matlab)
		input.printNumOfIntegerPartitionsWithRepeatedParts = false;
		input.storeCoalitionValuesInFile = false;
		input.printDetailsOfSubspaces = false;
		input.printTimeTakenByIPForEachSubspace = false;

		return( input );
	}

	//*****************************************************************************************************

	/**
	 * Set the name of the output folder for the interim results
	 */
	private void setNameOfOutputFolder( String mainOutputFolder, Input input, ValueDistribution valueDistribution )
	{
		input.outputFolder = mainOutputFolder;
		input.outputFolder += "/individual runs";
		input.outputFolder += "/"+input.numOfAgents+"Agents_";
		input.outputFolder += ValueDistribution.toString(valueDistribution);
	}

	//*****************************************************************************************************

	/**
	 * Initialize the strings in which we are storing the results
	 */
	private void initializeStringsOfResults( int minNumOfAgents, int maxNumOfAgents, int numOfDistributions )
	{
		str_inclusionExclusionTime = new String[ maxNumOfAgents+1 ][ numOfDistributions ];
		str_inclusionExclusionTime_confidenceInterval = new String[ maxNumOfAgents+1 ][ numOfDistributions ];

		for(int numOfAgents=minNumOfAgents; numOfAgents<=maxNumOfAgents; numOfAgents++) //for every number of agents
			for(int distributionID=0; distributionID<numOfDistributions; distributionID++) //for every distribution
			{
				str_inclusionExclusionTime[numOfAgents][distributionID] = "inclusionExclusionTime("+numOfAgents+") = ";
				str_inclusionExclusionTime_confidenceInterval[numOfAgents][distributionID] = "inclusionExclusionTime_confidenceInterval("+numOfAgents+") = ";
			}
	}

	//*****************************************************************************************************

	/**
	 * Update the strings in which we are storing the results
	 */
	private void updateStringsOfResults( Input input, Result result, int distributionID )
	{
		int numOfAgents = input.numOfAgents;
		str_inclusionExclusionTime[numOfAgents][distributionID] += result.inclusionExclusionTime+" ";
		str_inclusionExclusionTime_confidenceInterval[numOfAgents][distributionID] += result.inclusionExclusionTime_confidenceInterval+" ";
	}

	//*****************************************************************************************************

	/**
	 * Print the strings (in which we are storing the results) to a file
	 */
	private void printCurrentResultsToFile( Input input, String mainOutputFolder, ValueDistribution[] valueDistributions,
			int distributionID )
	{
		int numOfAgents = input.numOfAgents;

		//Set the name and path of the output file
		String filePathAndName = mainOutputFolder + "/"+valueDistributions[distributionID];

		//Print the results
		General.printToFile( filePathAndName+".txt", "numOfAgents = "+numOfAgents+"\n", false);
		str_inclusionExclusionTime[numOfAgents][distributionID] += "\n";
		General.printToFile( filePathAndName+".txt", str_inclusionExclusionTime[numOfAgents][distributionID], false);
		str_inclusionExclusionTime_confidenceInterval[numOfAgents][distributionID] += "\n";
		General.printToFile( filePathAndName+".txt", str_inclusionExclusionTime_confidenceInterval[numOfAgents][distributionID], false);
	}
}