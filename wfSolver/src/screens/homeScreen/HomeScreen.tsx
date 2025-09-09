import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ArbitraryWorkflowConfig } from '../../utils/generateArbitraryWorkflow'
import { generateArbitraryWorkflow, createComplexArbitraryWorkflow } from '../../utils/generateArbitraryWorkflow'
import { generateDAGGENWorkflow, createDAGGENConfig, type DAGGENConfig } from '../../utils/generateDaggenWorkflow'
import type { LocationState } from '../../types'

function HomeScreen() {
    const navigate = useNavigate()
    const [uploadStatus, setUploadStatus] = useState('')
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    
    // Generator selection
    const [generatorType, setGeneratorType] = useState<'workflow' | 'daggen' | 'preset'>('workflow')
    const [presetType, setPresetType] = useState<'complex' | 'daggen-default'>('complex')
    
    // Common parameters
    const [nodeCount, setNodeCount] = useState<number>(10)
    const [generatingWorkflow, setGeneratingWorkflow] = useState(false)
    
    // Workflow generator parameters
    const [maxWidth, setMaxWidth] = useState<number>(4)
    const [edgeProbability, setEdgeProbability] = useState<number>(0.4)
    const [maxEdgeSpan, setMaxEdgeSpan] = useState<number>(3)
    const [singleSink, setSingleSink] = useState<boolean>(true)
    
    // DAGGEN generator parameters
    const [fat, setFat] = useState<number>(0.8)
    const [regular, setRegular] = useState<number>(0.3)
    const [density, setDensity] = useState<number>(0.6)
    const [jump, setJump] = useState<number>(2)
    
    const [showAdvanced, setShowAdvanced] = useState<boolean>(false)

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        setSelectedFile(file || null)
        if (!file) return setUploadStatus('')
        
        setUploadStatus(`Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`)
    }

    const handleUpload = () => {
        if (!selectedFile) return setUploadStatus('Please select a workflow file first')
        
        setUploadStatus('Processing workflow file...')

        setTimeout(() => {
            setUploadStatus(`Successfully processed workflow: ${selectedFile.name}`)
            setTimeout(() => {
            navigate('/workflow', { state: { file: selectedFile } })
            }, 500)
        }, 1000)
    }

    const handleCreateArbitraryWorkflow = () => {
        if (nodeCount < 1 || nodeCount > 50) {
            alert('Please enter a node count between 1 and 50')
            return
        }

        // Validation for workflow generator
        if (generatorType === 'workflow') {
            if (maxWidth < 1 || maxWidth > nodeCount) {
                alert('Max width must be between 1 and the total node count')
                return
            }

            if (edgeProbability < 0 || edgeProbability > 1) {
                alert('Edge probability must be between 0 and 1')
                return
            }
        }

        // Validation for DAGGEN generator
        if (generatorType === 'daggen') {
            if (fat < 0.1 || fat > 2) {
                alert('Fat parameter must be between 0.1 and 2')
                return
            }

            if (regular < 0 || regular > 1) {
                alert('Regular parameter must be between 0 and 1')
                return
            }

            if (density < 0 || density > 1) {
                alert('Density parameter must be between 0 and 1')
                return
            }

            if (jump < 1 || jump > 5) {
                alert('Jump parameter must be between 1 and 5')
                return
            }
        }

        setGeneratingWorkflow(true)

        try {
            let nodes;

            if (generatorType === 'preset') {
                // Use preset configurations
                if (presetType === 'complex') {
                    nodes = createComplexArbitraryWorkflow(nodeCount)
                } else if (presetType === 'daggen-default') {
                    const daggenConfig = createDAGGENConfig(nodeCount)
                    nodes = generateDAGGENWorkflow(daggenConfig)
                }
            } else if (generatorType === 'workflow') {
                // Use custom workflow configuration
                const config: ArbitraryWorkflowConfig = {
                    nodeCount,
                    maxWidth,
                    edgeProbability,
                    maxEdgeSpan,
                    singleSink,
                    densityFactor: 0.6,
                    maxDuration: 10,
                    minDuration: 1,
                    maxTransferAmount: 100000,
                    minTransferAmount: 1000
                }
                nodes = generateArbitraryWorkflow(config)
            } else if (generatorType === 'daggen') {
                // Use custom DAGGEN configuration
                const daggenConfig: DAGGENConfig = {
                    nodeCount,
                    fat,
                    regular,
                    density,
                    jump,
                    minDuration: 1,
                    maxDuration: 10,
                    minTransferAmount: 1000,
                    maxTransferAmount: 100000
                }
                nodes = generateDAGGENWorkflow(daggenConfig)
            }

            if (!nodes) {
                throw new Error('Failed to generate nodes')
            }

            setTimeout(() => {
                setGeneratingWorkflow(false)
                navigate('/workflow', { 
                    state: { 
                        generatedNodes: nodes,
                        workflowType: generatorType,
                        nodeCount,
                        generatorType
                    } as LocationState
                })
            }, 500)

        } catch (error) {
            setGeneratingWorkflow(false)
            alert(`Error generating workflow: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    // Auto-calculate optimal maxWidth based on nodeCount
    const handleNodeCountChange = (newNodeCount: number) => {
        setNodeCount(newNodeCount)
        // Auto-adjust maxWidth to a reasonable value
        const optimalWidth = Math.max(2, Math.ceil(Math.sqrt(newNodeCount)))
        setMaxWidth(Math.min(optimalWidth, 8)) // Cap at 8 for visualization
    }

    const isSuccess = uploadStatus.includes('Successfully')

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <h1 className="text-4xl font-bold text-center mb-8">Workflow Solver</h1>
            
            {/* Upload Workflow Section */}
            <div className="bg-white rounded-lg shadow-lg p-8">
                <h2 className="text-2xl font-semibold mb-4 text-center">Upload Your Workflow</h2>
                <p className="text-gray-700 mb-6 text-center">
                    Select a workflow configuration file (YAML).
                </p>
                <div className="my-5 flex flex-col items-center space-y-4">
                    <input
                        type="file"
                        onChange={handleFileSelect}
                        accept=".json,.yaml,.yml,.xml,.txt"
                        className="mb-2.5 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <button
                        onClick={handleUpload}
                        disabled={!selectedFile}
                        className={`px-5 py-2.5 text-white border-0 rounded cursor-pointer transition-colors ${
                            selectedFile
                            ? 'bg-indigo-500 hover:bg-indigo-600 cursor-pointer'
                            : 'bg-gray-400 cursor-not-allowed'
                        }`}
                    >
                        {selectedFile ? 'Analyze Workflow' : 'Select File First'}
                    </button>
                </div>
                {uploadStatus && (
                    <div className={`p-2.5 rounded border ${
                        isSuccess
                            ? 'bg-green-100 border-green-300 text-green-800'
                            : 'bg-red-100 border-red-300 text-red-800'
                    }`}>
                        {uploadStatus}
                    </div>
                )}
                <p className="mt-5 text-sm text-gray-600 text-center">
                    Supported formats: YAML - Max file size: 10MB
                </p>
            </div>

            {/* Create Arbitrary Workflow Section */}
            <div className="bg-white rounded-lg shadow-lg p-8">
                <h2 className="text-2xl font-semibold mb-4 text-center">Generate Arbitrary Workflow</h2>
                <p className="text-gray-700 mb-6 text-center">
                    Create a random workflow using different generation approaches for realistic workflow structures.
                </p>
                
                <div className="space-y-6 max-w-lg mx-auto">
                    {/* Generator Type Selection */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-gray-800 border-b pb-2">Generator Type</h3>
                        
                        <div className="space-y-2">
                            <label className="flex items-center space-x-3">
                                <input
                                    type="radio"
                                    name="generatorType"
                                    value="workflow"
                                    checked={generatorType === 'workflow'}
                                    onChange={(e) => setGeneratorType(e.target.value as 'workflow' | 'daggen' | 'preset')}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                    <span className="text-sm font-medium text-gray-700">Workflow-Optimized</span>
                                    <p className="text-xs text-gray-500">Better visual layouts, guaranteed single sink</p>
                                </div>
                            </label>
                            
                            <label className="flex items-center space-x-3">
                                <input
                                    type="radio"
                                    name="generatorType"
                                    value="daggen"
                                    checked={generatorType === 'daggen'}
                                    onChange={(e) => setGeneratorType(e.target.value as 'workflow' | 'daggen' | 'preset')}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                    <span className="text-sm font-medium text-gray-700">DAGGEN Research</span>
                                    <p className="text-xs text-gray-500">Academic standard, more diverse structures</p>
                                </div>
                            </label>
                            
                            <label className="flex items-center space-x-3">
                                <input
                                    type="radio"
                                    name="generatorType"
                                    value="preset"
                                    checked={generatorType === 'preset'}
                                    onChange={(e) => setGeneratorType(e.target.value as 'workflow' | 'daggen' | 'preset')}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                    <span className="text-sm font-medium text-gray-700">Preset Configurations</span>
                                    <p className="text-xs text-gray-500">Pre-tuned settings for common use cases</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Preset Selection */}
                    {generatorType === 'preset' && (
                        <div>
                            <label htmlFor="presetType" className="block text-sm font-medium text-gray-700 mb-1">
                                Preset Type
                            </label>
                            <select
                                id="presetType"
                                value={presetType}
                                onChange={(e) => setPresetType(e.target.value as 'complex' | 'daggen-default')}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="complex">Complex Workflow (Gamma/Beta distributions)</option>
                                <option value="daggen-default">DAGGEN Default Settings</option>
                            </select>
                        </div>
                    )}

                    {/* Basic Parameters */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-gray-800 border-b pb-2">Basic Parameters</h3>
                        
                        {/* Node Count Input */}
                        <div>
                            <label htmlFor="nodeCount" className="block text-sm font-medium text-gray-700 mb-1">
                                Number of Tasks
                            </label>
                            <input
                                id="nodeCount"
                                type="number"
                                min="1"
                                max="50"
                                value={nodeCount}
                                onChange={(e) => handleNodeCountChange(parseInt(e.target.value) || 1)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Enter number of tasks (1-50)"
                            />
                            <p className="text-xs text-gray-500 mt-1">Total number of tasks in the workflow</p>
                        </div>

                        {/* Workflow-specific parameters */}
                        {generatorType === 'workflow' && (
                            <div>
                                <label htmlFor="maxWidth" className="block text-sm font-medium text-gray-700 mb-1">
                                    Maximum Parallelism Level
                                </label>
                                <input
                                    id="maxWidth"
                                    type="number"
                                    min="1"
                                    max={Math.min(nodeCount, 8)}
                                    value={maxWidth}
                                    onChange={(e) => setMaxWidth(parseInt(e.target.value) || 1)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <p className="text-xs text-gray-500 mt-1">Maximum number of tasks that can run in parallel</p>
                            </div>
                        )}

                        {/* DAGGEN-specific parameters */}
                        {generatorType === 'daggen' && (
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="fat" className="block text-sm font-medium text-gray-700 mb-1">
                                        Fat Parameter: {fat.toFixed(1)}
                                    </label>
                                    <input
                                        id="fat"
                                        type="range"
                                        min="0.1"
                                        max="2.0"
                                        step="0.1"
                                        value={fat}
                                        onChange={(e) => setFat(parseFloat(e.target.value))}
                                        className="w-full"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Controls tasks per level (fat * log(n))</p>
                                </div>

                                <div>
                                    <label htmlFor="regular" className="block text-sm font-medium text-gray-700 mb-1">
                                        Regularity: {(regular * 100).toFixed(0)}%
                                    </label>
                                    <input
                                        id="regular"
                                        type="range"
                                        min="0.0"
                                        max="1.0"
                                        step="0.1"
                                        value={regular}
                                        onChange={(e) => setRegular(parseFloat(e.target.value))}
                                        className="w-full"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">How regular the level sizes are (higher = more predictable)</p>
                                </div>

                                <div>
                                    <label htmlFor="density" className="block text-sm font-medium text-gray-700 mb-1">
                                        Density: {(density * 100).toFixed(0)}%
                                    </label>
                                    <input
                                        id="density"
                                        type="range"
                                        min="0.1"
                                        max="1.0"
                                        step="0.1"
                                        value={density}
                                        onChange={(e) => setDensity(parseFloat(e.target.value))}
                                        className="w-full"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Controls dependency density (higher = more connections)</p>
                                </div>

                                <div>
                                    <label htmlFor="jump" className="block text-sm font-medium text-gray-700 mb-1">
                                        Jump Distance
                                    </label>
                                    <select
                                        id="jump"
                                        value={jump}
                                        onChange={(e) => setJump(parseInt(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value={1}>1 - Only adjacent levels</option>
                                        <option value={2}>2 - Skip one level</option>
                                        <option value={3}>3 - Skip two levels</option>
                                        <option value={4}>4 - Skip three levels</option>
                                        <option value={5}>5 - Skip four levels</option>
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">Maximum levels a dependency can span</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Advanced Parameters for Workflow Generator */}
                    {generatorType === 'workflow' && (
                        <div>
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex items-center justify-between w-full px-4 py-2 text-left text-sm font-medium text-gray-700 bg-gray-50 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <span>Advanced Workflow Parameters</span>
                                <span className={`transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>▼</span>
                            </button>

                            {showAdvanced && (
                                <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-md">
                                    <div>
                                        <label htmlFor="edgeProbability" className="block text-sm font-medium text-gray-700 mb-1">
                                            Edge Probability: {edgeProbability.toFixed(2)}
                                        </label>
                                        <input
                                            id="edgeProbability"
                                            type="range"
                                            min="0.1"
                                            max="0.9"
                                            step="0.1"
                                            value={edgeProbability}
                                            onChange={(e) => setEdgeProbability(parseFloat(e.target.value))}
                                            className="w-full"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Probability of creating dependencies between tasks</p>
                                    </div>

                                    <div>
                                        <label htmlFor="maxEdgeSpan" className="block text-sm font-medium text-gray-700 mb-1">
                                            Maximum Edge Span
                                        </label>
                                        <select
                                            id="maxEdgeSpan"
                                            value={maxEdgeSpan}
                                            onChange={(e) => setMaxEdgeSpan(parseInt(e.target.value))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            <option value={1}>1 - Direct connections only</option>
                                            <option value={2}>2 - Skip one level</option>
                                            <option value={3}>3 - Skip two levels</option>
                                            <option value={4}>4 - Skip three levels</option>
                                        </select>
                                        <p className="text-xs text-gray-500 mt-1">Maximum number of levels a dependency can span</p>
                                    </div>

                                    <div>
                                        <label className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                checked={singleSink}
                                                onChange={(e) => setSingleSink(e.target.checked)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700">Single End Task</span>
                                        </label>
                                        <p className="text-xs text-gray-500 mt-1">Create a single final task that all paths converge to</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Generation Info */}
                    <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded-md">
                        <p className="font-medium mb-2">
                            {generatorType === 'workflow' ? '🔧 Workflow-Optimized Generation' : 
                             generatorType === 'daggen' ? '🔬 DAGGEN Research Standard' : 
                             '⚡ Preset Configuration'}
                        </p>
                        {generatorType === 'workflow' && (
                            <p>Creates workflow-friendly structures with predictable layouts, guaranteed single endpoints, and visual optimization.</p>
                        )}
                        {generatorType === 'daggen' && (
                            <p>Uses the academic DAGGEN approach for diverse DAG structures following research standards with configurable parameters.</p>
                        )}
                        {generatorType === 'preset' && (
                            <p>Uses pre-configured settings optimized for common workflow patterns and research scenarios.</p>
                        )}
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={handleCreateArbitraryWorkflow}
                        disabled={generatingWorkflow || nodeCount < 1 || nodeCount > 50}
                        className={`w-full px-5 py-2.5 text-white border-0 rounded cursor-pointer transition-colors ${
                            !generatingWorkflow && nodeCount >= 1 && nodeCount <= 50
                            ? 'bg-green-500 hover:bg-green-600'
                            : 'bg-gray-400 cursor-not-allowed'
                        }`}
                    >
                        {generatingWorkflow ? 'Generating Workflow...' : 
                         `Generate ${nodeCount}-Task ${generatorType === 'workflow' ? 'Workflow' : 
                                                      generatorType === 'daggen' ? 'DAG' : 
                                                      'Preset'}`}
                    </button>
                </div>
            </div>

            {/* Footer */}
            <p className="text-center text-gray-600">
                Upload workflow files to get scheduling optimization suggestions or generate arbitrary workflows for research and testing
            </p>
            
            <div className="flex justify-center space-x-4">
                <button
                    onClick={() => navigate('/test')}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">
                    Test Default Workflow
                </button>
            </div>
        </div>
    )
}

export default HomeScreen