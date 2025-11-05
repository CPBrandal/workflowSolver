// utils/workflowPresets.ts - Workflow type presets with REDUCED CONNECTIVITY

import type { WorkflowNode } from '../../types';
import { generateProbabilisticWorkflow } from '../probabilisticGenerator';
import { createBroadbandWorkflow } from './broadbandCreation';
import { createDeterministicCyberShakeWorkflow } from './cybershakeCreation';
import { createDeterministicEpigenomicsWorkflow } from './epigenomicCreation';
import { createDeterministicMontageWorkflow } from './montageCreation';
import { createSiphtWorkflow } from './siphtCreation';

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

export const createScientificWorkflowByType = (
  nodeCount: number,
  type: ScientificWorkflowType
): WorkflowNode[] => {
  switch (type) {
    case 'montage':
      return createDeterministicMontageWorkflow(nodeCount);
    case 'cybershake':
      return createDeterministicCyberShakeWorkflow(nodeCount);
    case 'epigenomics':
      return createDeterministicEpigenomicsWorkflow(nodeCount);
    case 'broadband':
      return createBroadbandWorkflow(nodeCount);
    case 'sipht':
      return createSiphtWorkflow(nodeCount);
    default:
      return createBalancedWorkflow(nodeCount);
  }
};
