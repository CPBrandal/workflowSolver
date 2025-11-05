import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { EfficiencyGraph } from './screens/algorithmComparison/EfficiencyGraph';
import SimulationsFromDBScreen from './screens/database/db-simulations/SimulationsFromDBScreen';
import ViewWorkflow from './screens/database/db-view-workflow/ViewWorkflow';
import WorkflowFromDBScreen from './screens/database/db-workflows/WorkflowFromDBScreen';
import DataBaseEditScreen from './screens/database/editDatabase/DataBaseEditScreen';
import HomeScreen from './screens/homeScreen/HomeScreen';
import WorkflowScreen from './screens/workflowScreen/WorkflowScreen';
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/workflow" element={<WorkflowScreen />} />
        <Route path="/db-workflows" element={<WorkflowFromDBScreen />} />
        <Route path="/db-simulations" element={<SimulationsFromDBScreen />} />
        <Route path="/db-view-workflow" element={<ViewWorkflow />} />
        <Route path="/edit-database" element={<DataBaseEditScreen />} />
        <Route path="/comparison" element={<EfficiencyGraph />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
