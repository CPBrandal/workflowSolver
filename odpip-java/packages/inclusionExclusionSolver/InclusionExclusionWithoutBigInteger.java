/**
 * The Inclusion-Exclusion algorithm [Björklund et al., Set Partitioning via Inclusion-Exclusion, 2009]
 * @author Talal Rahwan
 */

//TODO: check that indices are: i-1, not i 
//COMMENT: my computer runs out of memory when computer: n^n^i  for n=5 and i=10,000,000
//COMMENT: to return the grand coalition: int[][] grandCoalition = new int[1][n]; for(int kk=0; kk<n; kk++) grandCoalition[0][kk]=kk+1;if(grandCoalition.length==1)return grandCoalition;

package inclusionExclusionSolver;

import mainSolver.Result;
import inputOutput.Input;

public class InclusionExclusionWithoutBigInteger
{
	int maxAllowedValue = 1000;
	/** 
	 * Run the Inclusion Exclusion Algorithm
	 * @param input
	 * @param result
	 */
	public void solve( Input input, Result result )
	{
		long startTime = System.currentTimeMillis();
		int n = input.numOfAgents;

		//create a scaled, positive, integer version of the characteristic function
		int[] integerCharacteristicFunction = computePositiveScaledIntegerCharacteristicFunction( input, maxAllowedValue );

		int[][] optimalCoalitionStructure = findWP( integerCharacteristicFunction, n);
		
		result.inclusionExclusionTime = System.currentTimeMillis() - startTime;
		result.inclusionExclusionBestCSFound = optimalCoalitionStructure;
		result.inclusionExclusionValueOfBestCSFound = input.getCoalitionStructureValue( optimalCoalitionStructure );
	}

	//********************************************************************************

	/**
	 * create a scaled, positive, integer version of the characteristic function 
	 */
	private int[] computePositiveScaledIntegerCharacteristicFunction( Input input, int maxAllowedValue )
	{
		//Find the maximum coalition value
		double maxValue = Double.MIN_VALUE;
		for(int c=input.coalitionValues.length-1; c>=0; c--){ //for every coalition, c
			if( maxValue < input.coalitionValues[c] )
				maxValue = input.coalitionValues[c] ;
		}
		double scaleFactor = 1;
		if( maxValue > maxAllowedValue)
			scaleFactor = maxAllowedValue / maxValue; 
		
		//First, convert every coalition value into a scaled integer value, while keeping track of the minimum value
		int minValue = Integer.MAX_VALUE;
		int[] integerCharacteristicFunction = new int[ input.coalitionValues.length ];
		for(int c=integerCharacteristicFunction.length-1; c>=0; c--){ //for every coalition, c
			integerCharacteristicFunction[c] = (int)Math.round(  input.coalitionValues[c]  *  scaleFactor  );
			if( minValue > integerCharacteristicFunction[c] )
				minValue = integerCharacteristicFunction[c] ;
		}
		//Now, check if the minimum value is negative. If so, normalize by replacing v[C] with: v[C] - (minValue*|C|)
		if( minValue < 0 ){
			for(int c=integerCharacteristicFunction.length-1; c>=0; c--){ //for every coalition, c
				integerCharacteristicFunction[c] -= (minValue * Integer.bitCount(c));
			}
		}
		return integerCharacteristicFunction;
	}

	//********************************************************************************

	//FindWP - finding the best partition, p.10
	private int[][] findWP( int[] integerCharacteristicFunction, int n )
	{		
		long startTime = System.currentTimeMillis();
	
		//for all i=1, ..., n, set f_i to be equal to the integer version of the characteristic function
		int[][] original_f = new int[n][];
		for(int i=1; i<=n; i++)
			original_f[i-1] = integerCharacteristicFunction;
		
		//Compute F
		int B = (int)Math.pow(n, n) + 1;
		int[][] original_F = new int[n][];
		for(int i=1; i<=n; i++)
			original_F[i-1] = new int[(int)Math.pow(2,n)];
		for(int S = (int)Math.pow(2,n)-1; S>=0; S--){ //for every subset, S
			int x = (int)Math.pow(B,integerCharacteristicFunction[S]); // x = B^{f_i(S)}
			for(int i=1; i<=n; i++){
				original_F[i-1][S] = x; //F_i(S) = b^{f_i(S)}
			}
		}
		System.out.println("Inclusion-Exclusion has just finished preprocessing (to compute F). This took: "+(System.currentTimeMillis()-startTime)+" milliseconds. ");
		
		//call maxWP with the initial F
		long r = maxWP( original_F, n );
		System.out.println("Inclusion-Exclusion has just computed the value of an optimal partition. This value is: "+r+". This computation took: "+(System.currentTimeMillis()-startTime)+" milliseconds. ");

		//Initialization
		int[] color = new int[n]; //the color of each element
		int[] numOfElementsOfThisColor = new int[n]; //the number of elements of each color
		for(int j=1; j<=n; j++) //for every color j
			numOfElementsOfThisColor[j-1] = 0;			

		//Assign colors to elements
		for(int i=1; i<=n; i++){ //for every element, i
			for(int j=1; j<=n; j++){ //try to assign color j to element i
				int[] F_tilda = new int[(int)Math.pow(2,n)];
				for(int S = 0; S<=(int)Math.pow(2,n)-1; S++){ //for every subset, S
					if( (S & (1<<(i-1))) != 0 ) //if element i is in S
						F_tilda[S] = original_F[j-1][S];
					else
						F_tilda[S] = 1; //because B^0 = 1
				}
				int[][] new_F = new int[n][];
				for(int jj=1; jj<=n; jj++){ // for each color, jj
					if( jj == j ) new_F[jj-1] = F_tilda;
					else          new_F[jj-1] = original_F[jj-1];
				}
				//call maxWP with the new F
				long t = maxWP( new_F, n );
				if( t == r ){
					color[i-1] = j; //assign color j to element i
					numOfElementsOfThisColor[j-1]++;

					
for(int S = 0; S<=(int)Math.pow(2,n)-1; S++){ //for every subset, S
	if( (S & (1<<(i-1))) != 0 ){ //if element i is in S
		for(int jj=1; jj<=n; jj++){ //for every color jj other than i's color
			if( jj != j ){
				new_F[jj-1][S] = 1; //because B^0 = 1
			}
		}
	}
}
					
	
					original_F = new_F;					
					break;
				}   
			}
		}
		//count the total number of used colors
		int numOfUsedColors=0;
		for(int j=1; j<=n; j++) //for every color
			if( numOfElementsOfThisColor[j-1] != 0 )
				numOfUsedColors++;

		//Each subset in the optimal partition corresponds to a different color
		int[][] optimalPartition = new int[numOfUsedColors][];
		int k=0; //the index of the current subset that we are filling
		for(int j=1; j<=n; j++) { //for every color j
			if( numOfElementsOfThisColor[j-1] != 0 ){ //if there is at least one element whose color is j
				optimalPartition[k] = new int[ numOfElementsOfThisColor[j-1] ]; //make "optimalPartition[k]" contain all elements whose color is j 
				int m=0; //the index of the current element that we are adding to "optimalPartition[k]"
				for(int i=1; i<=n; i++){ //find all agents whose color is j
					if( color[i-1] == j ){
						optimalPartition[k][m] = i;
						m++;
					}
				}
				k++;
			}
		}
		return optimalPartition;
	}

	//********************************************************************************

	private int maxWP( int[][] F, int n )
	{
		int t = SumWP( F, n );
		int b = (int)Math.pow(n,n) + 1; // b = (int)Math.pow(n, n) + 1;
		int r = 0;
		int temp = (int)Math.pow(b,r); 
		while( temp < t ) { // while( Math.pow(b,r) < t ){
			r++;
			temp = (int)Math.pow(b,r);
		}
		return r-1; //this is basically just floor{log_b(t)}
	}

	//********************************************************************************

	private int SumWP( int[][] F, int n ) { //sum of weighted partitions of N into n parts (some of which may be empty), p.8
		int t = 0; // t=0;
		for(int X = (int)Math.pow(2,n)-1; X>=0; X--){ // for every subset, X
			t = t + (int)(Math.pow(-1,Integer.bitCount(X)) * b(X,F,n)); // t = t + (-1)^|X|b(X);
		}
		return t;
	}

	//********************************************************************************

	private int b( int X, int[][] F, int n ) { //auxiliary function for computing SumWP, p.8
		return g(1, n, n, X, F, n);
	}

	//********************************************************************************

	private int g(int s, int t, int m, int X, int[][] F, int n) { // auxiliary function for computing b(X), p.9
		int N = (int)(Math.pow(2, n)) - 1; // set N to be the grand coalition
		if( s == t ){
			int z = Zeta1(F[s-1], N - X, m, n); // z = Zeta1(F[s], N\X, m);
			return z;
		}
		else {
			int r = (int)Math.floor((s+t)/2); 
			int temp = 0; // temp = 0;
			for( int m0 = 0; m0 <= m; m0++) {
				int m1 = m - m0;
				temp = temp + (g(s, r, m0, X, F, n) * g(r+1, t, m1, X, F, n)); // temp := temp + g(s, r, m0, X, F)*g(r+1, t, m1, X, F);  
			}
			return temp;
		}
	}

	//********************************************************************************

	private int Zeta1(int[] F_s, int Y, int ell, int n) { // zeta-transform of F that only sums over subsets of size \ell, p.9  
		return zeta1_prime(F_s, n, Y, ell);
	}

	//********************************************************************************

	private int zeta1_prime(int[] Fs, int i, int Y, int ell) { //auxiliary function for computing Zeta(F,Y,\ell)
		if( i == 0 ){
			if( Integer.bitCount(Y) == ell ) // if |Y|=\ell 
				return Fs[Y];
			else
				return 0;
		}else{
			int singleton_i = (int)Math.pow(2, i-1);
			int t;
			if( (Y & (1<<(i-1))) != 0 ) //if i \in Y
				t =   zeta1_prime(Fs, i-1, Y, ell) + zeta1_prime(Fs, i-1, Y-singleton_i , ell);
			else 
				t =   zeta1_prime(Fs, i-1, Y, ell); 
			return t;
		}
	}
}
