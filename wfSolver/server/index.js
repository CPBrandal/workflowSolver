import { spawn } from 'child_process';
import cors from 'cors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Path to the odpip-java directory (relative to wfSolver)
const ODPIP_DIR = path.resolve(__dirname, '../../odpip-java');

/**
 * POST /api/odpip/solve
 * Body: { numOfAgents: number, coalitionValues: number[] }
 * Returns: { value: number, timeMs: number, partition: number[][] }
 */
app.post('/api/odpip/solve', (req, res) => {
  const { numOfAgents, coalitionValues } = req.body;

  // Validate input
  if (!Number.isInteger(numOfAgents) || numOfAgents < 1) {
    return res.status(400).json({ error: 'numOfAgents must be a positive integer' });
  }

  const expectedLength = Math.pow(2, numOfAgents);
  if (!Array.isArray(coalitionValues) || coalitionValues.length !== expectedLength) {
    return res.status(400).json({
      error: `coalitionValues must be an array of length ${expectedLength} (2^${numOfAgents})`,
    });
  }

  if (numOfAgents > 25) {
    return res.status(400).json({ error: 'numOfAgents cannot exceed 25' });
  }

  // Run the Java solver with stdin input (to avoid command-line argument limits)
  const java = spawn('java', [
    '-cp',
    `.:release_August_2016/packages:commons-math-2.2.jar`,
    'api.ODPIPSolverAPI',
    '--stdin',
  ], {
    cwd: ODPIP_DIR,
  });

  // Send data via stdin as JSON
  const inputData = JSON.stringify({ numOfAgents, coalitionValues });
  java.stdin.write(inputData);
  java.stdin.end();

  let stdout = '';
  let stderr = '';

  java.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  java.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  java.on('close', (code) => {
    if (code !== 0) {
      console.error('Java solver error:', stderr);
      return res.status(500).json({
        error: 'Solver execution failed',
        details: stderr,
      });
    }

    try {
      // Parse the JSON output from the solver
      const result = JSON.parse(stdout.trim());
      res.json(result);
    } catch (e) {
      console.error('Failed to parse solver output:', stdout);
      res.status(500).json({
        error: 'Failed to parse solver output',
        output: stdout,
      });
    }
  });

  java.on('error', (err) => {
    console.error('Failed to spawn Java process:', err);
    res.status(500).json({
      error: 'Failed to start solver',
      details: err.message,
    });
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const server = app.listen(PORT, () => {
  console.log(`ODP-IP backend server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Kill the existing process or use a different port.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
