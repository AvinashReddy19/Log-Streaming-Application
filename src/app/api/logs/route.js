// src/app/api/logs/route.js
import { exec } from 'child_process';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

// This setup needs to be in a Node.js environment, not in Next.js API routes
// For production, you'd host this separately and connect to it from your Next.js app
// For simplicity in this example, I'm showing the implementation here

let wss;

// Initialize WebSocket server if it doesn't exist yet
if (!global.wssInitialized) {
  const server = createServer();
  wss = new WebSocketServer({ server });
  
  server.listen(3001, () => {
    console.log('WebSocket server is running on port 3001');
  });
  
  // Store WSS in global to prevent re-initialization on hot reload
  global.wssInitialized = true;
  global.wss = wss;
} else {
  wss = global.wss;
}

wss.on('connection', function connection(ws) {
  console.log('Client connected');
  
  ws.on('message', function incoming(message) {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'subscribe') {
        const containerId = data.containerId || 'nginx';
        subscribeToContainerLogs(ws, containerId);
      } else if (data.type === 'unsubscribe') {
        unsubscribeFromLogs(ws);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });
  
  ws.on('close', function close() {
    console.log('Client disconnected');
    unsubscribeFromLogs(ws);
  });
  
  // Send initial connection success message
  ws.send(JSON.stringify({ type: 'connected' }));
});

// Map to track Docker log processes
const logProcesses = new Map();

function subscribeToContainerLogs(ws, containerId) {
  // Kill any existing log process for this connection
  unsubscribeFromLogs(ws);
  
  // Start a new Docker logs process
  const command = `docker logs -f ${containerId} --tail 100`;
  const logProcess = exec(command);
  
  // Store process reference
  logProcesses.set(ws, logProcess);
  
  // Send log entries as they arrive
  logProcess.stdout.on('data', (data) => {
    const logEntries = data.toString().split('\n').filter(line => line.trim() !== '');
    
    for (const logEntry of logEntries) {
      try {
        // Parse log entry - this parsing logic depends on your container's log format
        // This is a simplified example - you'd need to adapt to your actual log format
        const timestamp = new Date().toISOString();
        let level = 'INFO';
        
        if (logEntry.includes('ERROR')) level = 'ERROR';
        else if (logEntry.includes('WARN')) level = 'WARN';
        else if (logEntry.includes('DEBUG')) level = 'DEBUG';
        
        const message = logEntry;
        
        ws.send(JSON.stringify({
          type: 'log',
          data: {
            timestamp,
            level,
            service: containerId,
            message
          }
        }));
      } catch (error) {
        console.error('Error parsing log entry:', error);
      }
    }
  });
  
  // Handle errors
  logProcess.stderr.on('data', (data) => {
    console.error(`Docker logs error: ${data}`);
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: `Error retrieving logs: ${data}` 
    }));
  });
  
  logProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Docker logs process exited with code ${code}`);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: `Log stream ended with code ${code}` 
      }));
    }
    
    // Remove process reference
    logProcesses.delete(ws);
  });
}

function unsubscribeFromLogs(ws) {
  const logProcess = logProcesses.get(ws);
  if (logProcess) {
    // Kill the process
    try {
      logProcess.kill();
    } catch (error) {
      console.error('Error killing log process:', error);
    }
    
    // Remove from map
    logProcesses.delete(ws);
  }
}

// For Next.js API route
export async function GET(request) {
  return new Response(JSON.stringify({ 
    message: 'WebSocket server running on port 3001. Connect directly to the WebSocket endpoint.' 
  }));
}