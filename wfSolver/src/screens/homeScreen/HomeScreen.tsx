import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateArbitraryWorkflow } from '../../utils/generateArbitraryWorkflow'

function HomeScreen() {
    const navigate = useNavigate()
    const [uploadStatus, setUploadStatus] = useState('')
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    
    // Arbitrary workflow state
    const [nodeCount, setNodeCount] = useState<number>(5)
    const [workflowLayout, setWorkflowLayout] = useState<'linear' | 'branching' | 'parallel'>('linear')
    const [generatingWorkflow, setGeneratingWorkflow] = useState(false)

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

        setGeneratingWorkflow(true)

        try {
            const nodes = generateArbitraryWorkflow({
                nodeCount,
                layout: workflowLayout,
                maxDuration: 10,
                minDuration: 1
            })

            setTimeout(() => {
                setGeneratingWorkflow(false)
                navigate('/workflow', { 
                    state: { 
                        generatedNodes: nodes,
                        workflowType: 'arbitrary',
                        nodeCount,
                        layout: workflowLayout
                    } 
                })
            }, 500)

        } catch (error) {
            setGeneratingWorkflow(false)
            alert(`Error generating workflow: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
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
                <h2 className="text-2xl font-semibold mb-4 text-center">Create Custom Workflow</h2>
                <p className="text-gray-700 mb-6 text-center">
                    Generate a workflow with a specified number of nodes and layout pattern.
                </p>
                
                <div className="space-y-4 max-w-md mx-auto">
                    {/* Node Count Input */}
                    <div>
                        <label htmlFor="nodeCount" className="block text-sm font-medium text-gray-700 mb-1">
                            Number of Nodes
                        </label>
                        <input
                            id="nodeCount"
                            type="number"
                            min="1"
                            max="50"
                            value={nodeCount}
                            onChange={(e) => setNodeCount(parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter number of nodes (1-50)"
                        />
                    </div>

                    {/* Layout Selection */}
                    <div>
                        <label htmlFor="workflowLayout" className="block text-sm font-medium text-gray-700 mb-1">
                            Workflow Layout
                        </label>
                        <select
                            id="workflowLayout"
                            value={workflowLayout}
                            onChange={(e) => setWorkflowLayout(e.target.value as 'linear' | 'branching' | 'parallel')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="linear">Linear (Sequential)</option>
                            <option value="branching">Branching (Fork & Merge)</option>
                            <option value="parallel">Parallel (Fan-out & Fan-in)</option>
                        </select>
                    </div>

                    {/* Layout Descriptions */}
                    <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-md">
                        <div className="space-y-1">
                            <p><strong>Linear:</strong> Tasks execute one after another in sequence</p>
                            <p><strong>Branching:</strong> Fork into parallel paths that merge back together</p>
                            <p><strong>Parallel:</strong> All tasks run in parallel after start, then merge to finish</p>
                        </div>
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
                        {generatingWorkflow ? 'Generating Workflow...' : `Create ${workflowLayout.charAt(0).toUpperCase() + workflowLayout.slice(1)} Workflow`}
                    </button>
                </div>
            </div>

            {/* Footer */}
            <p className="text-center text-gray-600">
                Upload workflow files to get scheduling optimization suggestions or create custom workflows for testing
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