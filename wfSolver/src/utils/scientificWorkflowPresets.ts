// utils/workflowPresets.ts - Workflow type presets with REDUCED CONNECTIVITY

import type { WorkflowNode } from '../types';
import { createDeterministicMontageWorkflow } from './montageCreation';
import { generateProbabilisticWorkflow } from './probabilisticGenerator';

export type ScientificWorkflowType =
  | 'montage'
  | 'cybershake'
  | 'epigenomics'
  | 'broadband'
  | 'sipht';

export const scientificWorkflowMetadata = {
  montage: {
    name: 'Montage',
    organization: 'NASA/IPAC Infrared Science Archive',
    description: 'Astronomy workflow for generating custom mosaics of the sky from FITS images',
    icon: '🔭',
    characteristics: [
      'Diamond shape structure',
      'Image projection parallelism',
      'Central coordination point',
      'Scalable with image count',
    ],
    bestFor: 'Astronomical image processing, sky surveys, mosaic generation',
    domain: 'Astronomy',
    structure:
      'Re-project → Difference fitting → Coordination → Background correction → Image assembly',
    scalability: 'Workflow size scales with number of input images',
  },

  cybershake: {
    name: 'CyberShake',
    organization: 'Southern California Earthquake Center (SCEC)',
    description: 'Probabilistic Seismic Hazard Analysis (PSHA) for earthquake characterization',
    icon: '🌊',
    characteristics: [
      'Data-intensive pipeline',
      'High parallelism',
      'Sequential hazard stages',
      'Large-scale seismic modeling',
    ],
    bestFor: 'Earthquake hazard analysis, seismic risk assessment, PSHA calculations',
    domain: 'Seismology',
    structure: 'Site characterization → Wave propagation simulation → Hazard curve generation',
    scalability: 'Scales with number of rupture variations and frequency ranges',
  },

  epigenomics: {
    name: 'Epigenomics',
    organization: 'USC Epigenome Center',
    description:
      'Genome-wide mapping of epigenetic state in human cells through sequencing pipeline',
    icon: '🧬',
    characteristics: [
      'Data processing pipeline',
      'Automated sequencing operations',
      'Fan-out structure',
      'High-throughput parallel processing',
    ],
    bestFor: 'Genome sequencing, epigenetic analysis, DNA methylation studies',
    domain: 'Bioinformatics',
    structure: 'Data filtering → Alignment → Analysis → Lane processing → Aggregation',
    scalability: 'Scales with number of sequencing lanes and chromosomes',
  },

  broadband: {
    name: 'Broadband',
    organization: 'Southern California Earthquake Center (SCEC)',
    description:
      'Integrates multiple seismic codes to model earthquake impacts on recording stations',
    icon: '📡',
    characteristics: [
      'Complex integration workflow',
      'Multiple simulation codes',
      'Frequency combination',
      'Station-based parallelism',
    ],
    bestFor: 'Seismogram synthesis, engineering analysis, earthquake impact modeling',
    domain: 'Seismology',
    structure: 'Low-frequency deterministic + High-frequency stochastic → Combination → Validation',
    scalability: 'Scales with number of recording stations and rupture scenarios',
  },

  sipht: {
    name: 'SIPHT',
    organization: 'Harvard Medical School',
    description: 'Searches for small untranslated RNAs (sRNAs) regulating bacterial processes',
    icon: '🦠',
    characteristics: [
      'Modular structure',
      'Composable sub-workflows',
      'Nearly identical patterns',
      'Independent workflow units',
    ],
    bestFor: 'sRNA discovery, bacterial genomics, virulence research, regulatory RNA analysis',
    domain: 'Bioinformatics',
    structure: 'BLAST search → Candidate identification → Pattern analysis → Verification',
    scalability: 'Composed of independent sub-workflows, scales with genome database size',
  },
};

export const createMontageWorkflow = (nodeCount: number): WorkflowNode[] => {
  return createDeterministicMontageWorkflow(nodeCount);
};

export const createCybershakeWorkflow = (nodeCount: number): WorkflowNode[] => {
  return generateProbabilisticWorkflow({
    nodeCount,
    topologyType: 'pipeline', // Many sequential stages
    levelDistribution: 'geometric', // Exponentially decreasing level probability
    levelParams: { p: 0.3 }, // 30% chance to stop adding levels
    widthDistribution: 'exponential', // Most levels narrow, few wide
    widthParams: { scale: 0.4 }, // Low scale = prefer narrow levels

    // MINIMAL CONNECTIVITY PARAMETERS
    edgeProbability: 0.15, // VERY LOW - pipelines should be sparse
    connectivityDecay: 0.95, // VERY HIGH decay - mostly adjacent connections
    hubProbability: 0.02, // MINIMAL hubs in pipelines
    maxEdgeSpan: 1, // ONLY adjacent level connections
    clusteringCoefficient: 0.1, // MINIMAL clustering
    preferentialAttachment: false, // NO preferential attachment
  });
};

export const createEpigenomicsWorkflow = (nodeCount: number): WorkflowNode[] => {
  return generateProbabilisticWorkflow({
    nodeCount,
    topologyType: 'fan', // High parallelism
    widthDistribution: 'poisson', // Natural width variation
    widthParams: { lambda: 5 }, // Average 5 nodes per level

    // CONTROLLED CONNECTIVITY PARAMETERS
    edgeProbability: 0.1, // REDUCED from higher values
    connectivityDecay: 0.8, // MODERATE decay for some long connections
    hubProbability: 0.1, // REDUCED from 0.2 to 0.1
    maxEdgeSpan: 2, // REDUCED from longer spans
    clusteringCoefficient: 0.15, // REDUCED clustering
    preferentialAttachment: false, // DISABLED to control connection growth
  });
};

export const createBroadbandWorkflow = (nodeCount: number): WorkflowNode[] => {
  return generateProbabilisticWorkflow({
    nodeCount,
    topologyType: 'custom',
    levelDistribution: 'poisson',
    levelParams: { lambda: Math.ceil(Math.sqrt(nodeCount)) },
    widthDistribution: 'power_law',
    widthParams: { alpha: 2.0 }, // Lower alpha = more hubs
    maxWidth: Math.min(Math.floor(nodeCount * 0.4), nodeCount - 2),

    // REDUCED EVEN FOR "COMPLEX" WORKFLOWS
    edgeProbability: 0.1, // REDUCED from 0.6 to 0.4
    connectivityDecay: 0.7, // INCREASED from 0.5 to 0.7
    hubProbability: 0.15, // REDUCED from 0.25 to 0.15
    maxEdgeSpan: 3, // REDUCED from 4 to 3
    clusteringCoefficient: 0.25, // REDUCED from 0.4 to 0.25
    preferentialAttachment: false, // DISABLED even for complex
  });
};

export const createSiphtWorkflow = (nodeCount: number): WorkflowNode[] => {
  return generateProbabilisticWorkflow({
    nodeCount,
    topologyType: 'custom',
    levelDistribution: 'poisson',
    levelParams: { lambda: Math.ceil(Math.sqrt(nodeCount)) },
    widthDistribution: 'power_law',
    widthParams: { alpha: 2.0 }, // Lower alpha = more hubs
    maxWidth: Math.min(Math.floor(nodeCount * 0.4), nodeCount - 2),

    // REDUCED EVEN FOR "COMPLEX" WORKFLOWS
    edgeProbability: 0.1, // REDUCED from 0.6 to 0.4
    connectivityDecay: 0.7, // INCREASED from 0.5 to 0.7
    hubProbability: 0.15, // REDUCED from 0.25 to 0.15
    maxEdgeSpan: 3, // REDUCED from 4 to 3
    clusteringCoefficient: 0.25, // REDUCED from 0.4 to 0.25
    preferentialAttachment: false, // DISABLED even for complex
  });
};

/**
 * BALANCED WORKFLOWS - SPARSE AND CLEAN
 * Best for: General use, testing, balanced characteristics
 * Characteristics: Clean, readable structure with minimal excess connections
 */
export const createBalancedWorkflow = (nodeCount: number): WorkflowNode[] => {
  return generateProbabilisticWorkflow({
    nodeCount,
    topologyType: 'balanced',
    widthDistribution: 'poisson',
    widthParams: { lambda: Math.ceil(nodeCount / 4) },

    // SPARSE, CLEAN PARAMETERS
    edgeProbability: 0.2, // REDUCED for clean appearance
    connectivityDecay: 0.85, // HIGH decay for local connections
    hubProbability: 0.05, // MINIMAL hubs
    maxEdgeSpan: 2, // SHORT spans only
    clusteringCoefficient: 0.15, // MINIMAL clustering
    preferentialAttachment: false, // NO preferential attachment

    maxWidth: Math.ceil(nodeCount / 3),
    singleSink: true,
  });
};

/**
 * WORKFLOW METADATA FOR DISPLAY (Updated descriptions)
 */
export const workflowTypeMetadata = {
  scientific: {
    name: 'Scientific Research',
    description: 'Research workflows with sparse coordinator tasks and clean structure',
    icon: '🔬',
    characteristics: ['Diamond shape', 'Few coordinators', 'Clean connections'],
    bestFor: 'Data analysis, simulations, research pipelines',
  },
  dataPipeline: {
    name: 'Data Pipeline',
    description: 'Sequential processing stages with minimal cross-connections',
    icon: '🔄',
    characteristics: ['Sequential stages', 'Adjacent connections', 'Pipeline structure'],
    bestFor: 'ETL processes, stream processing, data transformation',
  },
  machineLearning: {
    name: 'Machine Learning',
    description: 'Parallel workflows with controlled connectivity',
    icon: '🤖',
    characteristics: ['Controlled parallelism', 'Fan structure', 'Sparse connections'],
    bestFor: 'Model training, hyperparameter tuning, ensemble methods',
  },
  complex: {
    name: 'Complex Systems',
    description: 'More connected workflows but still readable and manageable',
    icon: '🕸️',
    characteristics: ['Moderate connections', 'Some hubs', 'Controlled complexity'],
    bestFor: 'Testing scenarios, distributed computing, moderate mesh networks',
  },
  balanced: {
    name: 'Balanced General',
    description: 'Clean, sparse workflows ideal for visualization and testing',
    icon: '⚖️',
    characteristics: ['Sparse connections', 'Clean structure', 'Highly readable'],
    bestFor: 'General testing, benchmarking, clean visualizations',
  },
};

export const createScientificWorkflowByType = (
  nodeCount: number,
  type: ScientificWorkflowType
): WorkflowNode[] => {
  switch (type) {
    case 'montage':
      return createMontageWorkflow(nodeCount);
    case 'cybershake':
      return createCybershakeWorkflow(nodeCount);
    case 'epigenomics':
      return createEpigenomicsWorkflow(nodeCount);
    case 'broadband':
      return createBroadbandWorkflow(nodeCount);
    case 'sipht':
      return createSiphtWorkflow(nodeCount);
    default:
      return createBalancedWorkflow(nodeCount);
  }
};
