import { BrowserRouter, Route, Routes } from "react-router-dom";
import HomeScreen from "./screens/homeScreen/HomeScreen";
import WorkflowScreen from "./screens/workflowScreen/WorkflowScreen";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/workflow" element={<WorkflowScreen />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;