package inputOutput;

public enum SolverNames {
	
	DP, // [Yeh, 1986] 
	
	IDP, // [Rahwan & Jennings, AAMAS 2008]
	
	ODP, // [Rahwan et al., 2014]

	IP, // [Rahwan et al., JAIR 2009]
	
	ODPIP, // [Rahwan et al., AIJ 2015]
	
	ODPinParallelWithIP, // simply running ODP and IP in parallel
	
	InclusionExclusion; //the algorithm from the paper: "SET PARTITIONING VIA INCLUSION-EXCLUSION [2009]" 
	
	public static String toString( SolverNames solverName ){
		if( solverName == DP    ) return( "DP" );
		if( solverName == IDP   ) return( "IDP" );
		if( solverName == ODP   ) return( "ODP" );
		if( solverName == IP    ) return( "IP" );
		if( solverName == ODPIP ) return( "ODP-IP" );
		if( solverName == InclusionExclusion ) return( "Inclusion-Exclusion" );
		if( solverName == ODPinParallelWithIP ) return( "ODP-in-Parallel-with-IP" );
		return "";
	}
}
