import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

// Lazy load all screens
const HomeScreen = lazy(() => import('./screens/homeScreen/HomeScreen'));
const WorkflowScreen = lazy(() => import('./screens/workflowScreen/WorkflowScreen'));
const WorkflowFromDBScreen = lazy(
  () => import('./screens/database/db-run-simulation/WorkflowFromDBScreen')
);
const SimulationsFromDBScreen = lazy(
  () => import('./screens/database/db-simulations/SimulationsFromDBScreen')
);
const ViewWorkflow = lazy(() => import('./screens/database/db-view-workflow/ViewWorkflow'));
const DataBaseEditScreen = lazy(() => import('./screens/database/editDatabase/DataBaseEditScreen'));
const EfficiencyGraph = lazy(() =>
  import('./screens/algorithmComparison/EfficiencyGraph').then(m => ({
    default: m.EfficiencyGraph,
  }))
);

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/workflow" element={<WorkflowScreen />} />
          <Route path="/db-workflows" element={<WorkflowFromDBScreen />} />
          <Route path="/db-simulations" element={<SimulationsFromDBScreen />} />
          <Route path="/db-view-workflow" element={<ViewWorkflow />} />
          <Route path="/edit-database" element={<DataBaseEditScreen />} />
          <Route path="/comparison" element={<EfficiencyGraph />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
