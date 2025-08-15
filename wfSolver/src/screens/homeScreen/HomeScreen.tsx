import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function HomeScreen() {
    const navigate = useNavigate()
    const [uploadStatus, setUploadStatus] = useState('')
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

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

    const isSuccess = uploadStatus.includes('Successfully')

    return (
    <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-4xl font-bold text-center mb-8">Workflow Solver</h1>
        <div className="bg-white rounded-lg shadow-lg p-8 items-center">
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
        <p className="text-center mt-8 text-gray-600">
        Upload your workflow files to get scheduling optimization suggestions
        </p>
        <div className="flex justify-center space-x-4 mt-6">
        <button
            onClick={() => navigate('/test')}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">
            Test
        </button>
        </div>
    </div>
    )
}

export default HomeScreen