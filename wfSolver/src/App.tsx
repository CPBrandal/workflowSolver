import { BrowserRouter, Route, Routes } from 'react-router-dom';
import SimulationsFromDBScreen from './screens/db-simulations/SimulationsFromDBScreen';
import WorkflowFromDBScreen from './screens/db-workflows/WorkflowFromDBScreen';
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
      </Routes>
    </BrowserRouter>
  );
}

export default App;
