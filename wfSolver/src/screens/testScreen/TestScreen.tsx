import VisualWorkflow from '../workflowScreen/VisualWorkflow';
import { defaultNodes } from '../../data/defaultNodes';

function TestScreen() {
  return (
    <VisualWorkflow nodes={defaultNodes}></VisualWorkflow>
  );
}

export default TestScreen;