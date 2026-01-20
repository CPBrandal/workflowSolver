/**
 * The Inclusion-Exclusion algorithm [Björklund et al., Set Partitioning via Inclusion-Exclusion, 2009]
 * @author Talal Rahwan
 */

//TODO: check that indices are: i-1, not i 
//COMMENT: my computer runs out of memory when computer: n^n^i  for n=5 and i=10,000,000
//COMMENT: to return the grand coalition: int[][] grandCoalition = new int[1][n]; for(int kk=0; kk<n; kk++) grandCoalition[0][kk]=kk+1;if(grandCoalition.length==1)return grandCoalition;

package inclusionExclusionSolver;

import java.math.BigInteger;

import mainSolver.Result;
import inputOutput.Input;

public class InclusionExclusionSolver
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
		int[] f = computePositiveScaledIntegerCharacteristicFunction( input, maxAllowedValue );

		int[][] optimalCoalitionStructure = inclusionExclusion( f, n);
		
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
		int[] f = new int[ input.coalitionValues.length ];
		for(int c=f.length-1; c>=0; c--){ //for every coalition, c
			f[c] = (int)Math.round(  input.coalitionValues[c]  *  scaleFactor  );
			if( minValue > f[c] )
				minValue = f[c] ;
		}
		//Now, check if the minimum value is negative. If so, normalize by replacing v[C] with: v[C] - (minValue*|C|)
		if( minValue < 0 ){
			for(int c = f.length-1; c>=0; c--){ //for every coalition, c
				f[c] -= (minValue * Integer.bitCount(c));
			}
		}
		return f;
	}

	//********************************************************************************

	//findBestPartition - finding the best partition, p.10
	private int[][] inclusionExclusion( int[] v, int n )
	{		
		//Compute f'
		BigInteger B = ((BigInteger.valueOf(n)).pow(n)).add(BigInteger.valueOf(1)); // B = (int)Math.pow(n, n) + 1;
		BigInteger[][] f_prime = new BigInteger[n][];
		for(int c=1; c<=n; c++) //for every color, c
			f_prime[c-1] = new BigInteger[(int)Math.pow(2,n)];
		for(int S = (int)Math.pow(2,n)-1; S>=0; S--){ //for every coalition, S
			BigInteger x = B.pow(v[S]); // x = B^{v(S)}
			for(int c=1; c<=n; c++){
				f_prime[c-1][S] = x; //f'_c(S) = B^{v(S)}
			}
		}

		//call findMaxWeight with the initial f'. This should return the value of an optimal coalition structure
		long optimalValue = findMaxWeight( f_prime, n );

		//Initialization
		int[] color = new int[n]; //the color of each agent
		int[] numOfAgentsOfThisColor = new int[n]; //the number of agents of each color
		for(int c=1; c<=n; c++) //for every color c
			numOfAgentsOfThisColor[c-1] = 0;			

		//Assign colors to agents
		for(int i=1; i<=n; i++){ //for every agent, a_i
			for(int c=1; c<=n; c++){ //try to assign color c to agent a_i, starting from color 1, then 2, etc. (order matters)
				BigInteger[] f_tilda = new BigInteger[(int)Math.pow(2,n)];
				for(int S = 0; S<=(int)Math.pow(2,n)-1; S++){ //define the function f_tilda for every coalition, S
					if( (S & (1<<(i-1))) != 0 ) //if agent a_i is in S
						f_tilda[S] = f_prime[c-1][S];
					else
						f_tilda[S] = BigInteger.valueOf(1); //because B^0 = 1
				}
				BigInteger[][] F_prime = new BigInteger[n][];
				for(int j=1; j<=n; j++){ // for each color, j
					if( j == c ) F_prime[j-1] = f_tilda;
					else         F_prime[j-1] = f_prime[j-1];
				}
				//call maxWP with the new f'
				long valueAfterColoring = findMaxWeight( F_prime, n );
				
				if( valueAfterColoring == optimalValue ){
					color[i-1] = c; //set c to be the color of agent a_i
					numOfAgentsOfThisColor[c-1]++;

					for(int S = 0; S<=(int)Math.pow(2,n)-1; S++){ //for every coalition, S
						if( (S & (1<<(i-1))) != 0 ){ //if agent a_i is in S
							for(int j=1; j<=n; j++){ //for every color j other than i's color
								if( j != c ){
									F_prime[j-1][S] = BigInteger.valueOf(1); //because B^0 = 1
								}
							}
						}
					}
					f_prime = F_prime;	//now, f' is updated to reflect that c is now the color of a_i				
					break;
				}   
			}
		}
		//count the total number of used colors
		int numOfUsedColors=0;
		for(int c=1; c<=n; c++) //for every color
			if( numOfAgentsOfThisColor[c-1] != 0 )
				numOfUsedColors++;

		//Each coalition in the optimal partition corresponds to a different color
		int[][] optimalPartition = new int[numOfUsedColors][];
		int k=0; //the index of the current coalition that we are filling
		for(int c=1; c<=n; c++) { //for every color c
			if( numOfAgentsOfThisColor[c-1] != 0 ){ //if there is at least one agent whose color is c
				optimalPartition[k] = new int[ numOfAgentsOfThisColor[c-1] ]; //make "optimalPartition[k]" contain all agents whose color is c 
				int m=0; //the index of the current agent that we are adding to "optimalPartition[k]"
				for(int i=1; i<=n; i++){ //find all agents whose color is c
					if( color[i-1] == c ){
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

	private int findMaxWeight( BigInteger[][] f, int n )
	{
		BigInteger t = p_n( f, n );
		BigInteger B = ((BigInteger.valueOf(n)).pow(n)).add(BigInteger.valueOf(1)); // B = (int)Math.pow(n, n) + 1;
		int r = 0;
		BigInteger temp = B.pow(r); 
		while( temp.compareTo(t) == -1) { // while( B^r < t ){
			r++;
			temp = B.pow(r);
		}
		return r-1; //this is basically just floor{log_B(t)}
	}

	//********************************************************************************

	private BigInteger p_n( BigInteger[][] f, int n ) { //sum of weighted partitions of A into n parts (some of which may be empty), page 8
		BigInteger t = BigInteger.valueOf(0); // t=0;
		for(int X = (int)Math.pow(2,n)-1; X>=0; X--){ // for every subset, X
			t = t.add( ((BigInteger.valueOf(-1)).pow(Integer.bitCount(X))).multiply(b_n(X,f,n))  ); // t = t + ((-1)^{|X|} * b_n(X));
		}
		return t;
	}

	//********************************************************************************

	private BigInteger b_n( int X, BigInteger[][] f, int n ) { //auxiliary function for computing p_n, page 8
		return g(1, n, n, X, f, n);
	}

	//********************************************************************************

	private BigInteger g(int s, int t, int m, int X, BigInteger[][] f, int n) { // auxiliary function for computing b(X), page 9
		int A = (int)(Math.pow(2, n)) - 1; // set A to be the grand coalition
		if( s == t ){
			return Zeta(f[s-1], A - X, m, n); // return Zeta(f[s], A\X, m);
		}else{
			int r = (int)Math.floor((s+t)/2); 
			BigInteger temp = BigInteger.valueOf(0); // temp = 0;
			for( int m0 = 0; m0 <= m; m0++) {
				int m1 = m - m0;
				temp = temp.add(  (g(s, r, m0, X, f, n)).multiply(g(r+1, t, m1, X, f, n))   ); // temp := temp + g(s, r, m0, X, f)*g(r+1, t, m1, X, f);  
			}
			return temp;
		}
	}

	//********************************************************************************

	private BigInteger Zeta(BigInteger[] f, int Y, int ell, int n) { // zeta-transform of f that only sums over coalitions of size \ell, page 9  
		return z(f, n, Y, ell);
	}

	//********************************************************************************

	private BigInteger z(BigInteger[] f, int i, int Y, int ell) { //auxiliary function for computing Zeta(f,X,\ell)
		if( i == 0 ){
			if( Integer.bitCount(Y) == ell ) // if |Y|=\ell 
				return f[Y];
			else
				return BigInteger.valueOf(0);
		}else{
			int singleton_i = (int)Math.pow(2, i-1);
			BigInteger t;
			if( (Y & (1<<(i-1))) != 0 ) //if a_i \in Y
				t = ( z(f, i-1, Y, ell) ).add( z(f, i-1, Y-singleton_i , ell) );
			else 
				t =   z(f, i-1, Y, ell); 
			return t;
		}
	}
}
