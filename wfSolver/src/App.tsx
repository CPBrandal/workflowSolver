import { BrowserRouter, Route, Routes } from "react-router-dom";
import HomeScreen from "./screens/homeScreen/HomeScreen";
import WorkflowScreen from "./screens/workflowScreen/WorkflowScreen";
import TestScreen from "./screens/testScreen/TestScreen";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/workflow" element={<WorkflowScreen />} />
        <Route path='/test' element={<TestScreen />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;