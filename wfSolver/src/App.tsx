import { BrowserRouter, Route, Routes } from 'react-router-dom';
import SimulationsFromDBScreen from './screens/database/db-simulations/SimulationsFromDBScreen';
import ViewWorkflow from './screens/database/db-view-workflow/ViewWorkflow';
import WorkflowFromDBScreen from './screens/database/db-workflows/WorkflowFromDBScreen';
import HomeScreen from './screens/homeScreen/HomeScreen';
import WorkflowScreen from './screens/workflowScreen/WorkflowScreen';
import EditDatabaseScreen from './screens/database/editDatabase/editDatabaseScreen';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/workflow" element={<WorkflowScreen />} />
        <Route path="/db-workflows" element={<WorkflowFromDBScreen />} />
        <Route path="/db-simulations" element={<SimulationsFromDBScreen />} />
        <Route path="/db-view-workflow" element={<ViewWorkflow />} />
        <Route path="/edit-database" element={<EditDatabaseScreen />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
