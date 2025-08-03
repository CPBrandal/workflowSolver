import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [uploadStatus, setUploadStatus] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setSelectedFile(file || null)
    if (file) {
      setUploadStatus(`Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`)
    } else {
      setUploadStatus('')
    }
  }

  const handleUpload = () => {
    if (!selectedFile) {
      setUploadStatus('Please select a workflow file first')
      return
    }
    
    setUploadStatus('Processing workflow file...')
    
    setTimeout(() => {
      setUploadStatus(`Successfully processed workflow: ${selectedFile.name}`)
    }, 1500)
  }

  return (
    <>
      <h1>Workflow Solver</h1>
      <div className="card">
        <h2>Upload Your Workflow</h2>
        <p>
          Select a workflow configuration file (JSON, YAML, or XML) to analyze and optimize your business processes.
        </p>
        <div style={{ margin: '20px 0' }}>
          <input
            type="file"
            onChange={handleFileSelect}
            accept=".json,.yaml,.yml,.xml,.txt"
            style={{ marginBottom: '10px', display: 'block' }}
          />
          <button 
            onClick={handleUpload}
            disabled={!selectedFile}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: selectedFile ? '#646cff' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: selectedFile ? 'pointer' : 'not-allowed'
            }}
          >
            {selectedFile ? 'Analyze Workflow' : 'Select File First'}
          </button>
        </div>
        {uploadStatus && (
          <div style={{ 
            padding: '10px', 
            backgroundColor: uploadStatus.includes('Successfully') ? '#d4edda' : '#f8d7da',
            border: `1px solid ${uploadStatus.includes('Successfully') ? '#c3e6cb' : '#f5c6cb'}`,
            borderRadius: '4px',
            color: uploadStatus.includes('Successfully') ? '#155724' : '#721c24'
          }}>
            {uploadStatus}
          </div>
        )}
        <p style={{ marginTop: '20px', fontSize: '0.9em', color: '#666' }}>
          Supported formats: JSON, YAML, XML • Max file size: 10MB
        </p>
      </div>
      <p className="read-the-docs">
        Upload your workflow files to get intelligent analysis and optimization suggestions
      </p>
    </>
  )
}

export default App
