import { BrowserRouter, Route, Routes } from 'react-router-dom';
import HomeScreen from './screens/homeScreen/HomeScreen';
import WorkflowScreen from './screens/workflowScreen/WorkflowScreen';
import WorkflowFromDBScreen from './screens/db-workflows/WorkflowFromDBScreen';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/workflow" element={<WorkflowScreen />} />
        <Route path="/db-workflows" element={<WorkflowFromDBScreen />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
