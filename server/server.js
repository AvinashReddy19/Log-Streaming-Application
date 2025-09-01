// server.js
const { exec } = require('child_process');
const { WebSocketServer } = require('ws');
const http = require('http');
const url = require('url');

// Create HTTP server
const server = http.createServer((req, res) => {
  const pathname = url.parse(req.url).pathname;
  
  if (pathname === '/health') {
    res.writeHead(200);
    res.end('WebSocket server is running');
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

console.log('WebSocket server starting...');

// Map to track Docker log processes
const logProcesses = new Map();

// Redis log parsing function - IMPORTANT: This needs to be defined before it's used
function parseRedisLog(logEntry) {
  let level = 'INFO';
  
  // Determine log level based on content and Redis log patterns
  if (logEntry.includes('ERROR') || 
      logEntry.includes('FAILED') || 
      logEntry.includes('error') || 
      logEntry.includes('# ERROR')) {
    level = 'ERROR';
  } else if (logEntry.includes('WARNING') || 
             logEntry.includes('warning') || 
             logEntry.includes('WARN') || 
             logEntry.includes('# WARNING')) {
    level = 'WARN';
  } else if (logEntry.includes('DEBUG') || 
             logEntry.includes('debug')) {
    level = 'DEBUG';
  }
  
  return {
    timestamp: new Date().toISOString(),
    level,
    service: 'redis',
    message: logEntry
  };
}

// Handle WebSocket connections
wss.on('connection', function connection(ws, req) {
  console.log('Client connected');
  
  // Handle client messages
  ws.on('message', function incoming(message) {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'subscribe') {
        const containerId = data.containerId || 'redis';
        subscribeToContainerLogs(ws, containerId);
      } else if (data.type === 'unsubscribe') {
        unsubscribeFromLogs(ws);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });
  
  // Handle disconnection
  ws.on('close', function close() {
    console.log('Client disconnected');
    unsubscribeFromLogs(ws);
  });
  
  // Send initial connection success message
  ws.send(JSON.stringify({ type: 'connected' }));
});

function subscribeToContainerLogs(ws, containerId) {
  // Kill any existing log process for this connection
  unsubscribeFromLogs(ws);
  
  console.log(`Subscribing to logs for container: ${containerId}`);
  
  // Start a new Docker logs process
  const command = `docker logs -f ${containerId} --tail 100`;
  const logProcess = exec(command);
  
  // Store process reference
  logProcesses.set(ws, logProcess);
  
  // Handle process exit (e.g., if container doesn't exist)
  logProcess.on('error', (error) => {
    console.error(`Error starting log process: ${error.message}`);
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: `Error retrieving logs: ${error.message}` 
    }));
    
    // If the container doesn't exist, start simulating logs
    simulateLogs(ws, containerId);
  });
  
  // Send log entries as they arrive
  logProcess.stdout.on('data', (data) => {
    const logEntries = data.toString().split('\n').filter(line => line.trim() !== '');
    
    for (const logEntry of logEntries) {
      try {
        // Parse log entry based on container type
        let logData;
        
        if (containerId.includes('redis') || containerId === 'b0553f497026') {
          // Use Redis-specific parsing
          logData = parseRedisLog(logEntry);
        } else {
          // Generic parsing for other containers
          const timestamp = new Date().toISOString();
          let level = 'INFO';
          
          if (logEntry.toLowerCase().includes('error')) level = 'ERROR';
          else if (logEntry.toLowerCase().includes('warn')) level = 'WARN';
          else if (logEntry.toLowerCase().includes('debug')) level = 'DEBUG';
          
          logData = {
            timestamp,
            level,
            service: containerId,
            message: logEntry
          };
        }
        
        ws.send(JSON.stringify({
          type: 'log',
          data: logData
        }));
      } catch (error) {
        console.error('Error parsing log entry:', error);
      }
    }
  });
  
  // Handle errors
  logProcess.stderr.on('data', (data) => {
    const errorMessage = data.toString().trim();
    console.error(`Docker logs error: ${errorMessage}`);
    
    // If the container doesn't exist, start simulating logs
    if (errorMessage.includes('No such container')) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: `Container ${containerId} not found. Using simulated logs.` 
      }));
      
      simulateLogs(ws, containerId);
    } else {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: `Error retrieving logs: ${errorMessage}` 
      }));
    }
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

// Simulate logs if Docker is not available or container doesn't exist
function simulateLogs(ws, containerId) {
  console.log(`Simulating logs for container: ${containerId}`);
  
  // Helper function to generate a simulated log
  function generateSimulatedLog(containerId) {
    const LOG_LEVELS = ["INFO", "DEBUG", "WARN", "ERROR"];
    const level = LOG_LEVELS[Math.floor(Math.random() * LOG_LEVELS.length)];
    const timestamp = new Date().toISOString();
    
    // Messages specific to the container type
    let messages;
    
    if (containerId === 'nginx') {
      messages = [
        "192.168.1.101 - - [GET /index.html HTTP/1.1] 200 2048",
        "192.168.1.102 - - [GET /assets/css/main.css HTTP/1.1] 200 1024",
        "192.168.1.103 - - [POST /api/login HTTP/1.1] 401 256",
        "192.168.1.104 - - [GET /images/logo.png HTTP/1.1] 200 5120",
        "SSL handshake successful from 192.168.1.105",
        "Worker process started, PID: 12345",
        "Reloading configuration...",
        "Configuration reload successful"
      ];
    } else if (containerId === 'mongo') {
      messages = [
        "Connection accepted from 192.168.1.106:48484",
        "Successfully authenticated as admin",
        "Creating collection: users",
        "Index build: users._id_ using: { _id: 1 }",
        "Query executed: { find: \"users\", filter: { email: { $exists: true } } }",
        "Write operation: inserted 1 document into users",
        "Slow query detected: 242ms",
        "Storage engine init completed"
      ];
    } else if (containerId === 'redis' || containerId === 'b0553f497026') {
      messages = [
        "1:M 02 Sep 2025 10:15:23.456 * Redis 7.0.4 Ready to accept connections",
        "1:M 02 Sep 2025 10:15:24.123 > Client connected from 192.168.1.107:50001",
        "1:M 02 Sep 2025 10:15:25.789 * Client authenticated as 'default'",
        "1:M 02 Sep 2025 10:15:26.456 > SET user:1000 \"John Doe\" EX 3600",
        "1:M 02 Sep 2025 10:15:27.123 > GET user:1000",
        "1:M 02 Sep 2025 10:15:28.789 > LPUSH notifications:1000 \"New message\"",
        "1:M 02 Sep 2025 10:15:29.456 * Background saving started by pid 12345",
        "1:M 02 Sep 2025 10:15:30.123 * Background saving completed successfully",
        "1:M 02 Sep 2025 10:15:31.789 > PUBLISH channel:updates \"System update completed\"",
        "1:M 02 Sep 2025 10:15:32.456 > INCR visitors:count",
        "1:M 02 Sep 2025 10:15:33.123 # Server load: CPU=10.2% MEM=256MB/1GB",
        "1:M 02 Sep 2025 10:15:34.789 > HMSET user:profile:1000 name \"John\" email \"john@example.com\"",
        "1:M 02 Sep 2025 10:15:35.456 > EXPIRE session:token:12345 1800",
        "1:M 02 Sep 2025 10:15:36.123 > DEL expired:keys"
      ];
    } else {
      messages = [
        "Process started with PID 12345",
        "Configuration loaded from /etc/config.json",
        "Client connected from 192.168.1.100",
        "Operation completed successfully in 45ms",
        "Background task #4 running (10/100 items processed)",
        "Resource acquired: database connection #8",
        "Task #1234 completed with status: SUCCESS",
        "System status: all services operational"
      ];
    }
    
    let message = messages[Math.floor(Math.random() * messages.length)];
    
    // Add more context for ERROR and WARN levels
    if (level === "ERROR") {
      const errorMessages = [
        "1:M 02 Sep 2025 10:16:01.123 # ERROR Connection refused: max number of clients reached",
        "1:M 02 Sep 2025 10:16:02.456 # ERROR Out of memory allocating 16MB buffer",
        "1:M 02 Sep 2025 10:16:03.789 # ERROR Failed to open .rdb file for saving",
        "1:M 02 Sep 2025 10:16:04.123 # ERROR Client closed connection unexpectedly",
        "1:M 02 Sep 2025 10:16:05.456 # ERROR Command rejected due to disk space limits"
      ];
      
      if (containerId === 'redis' || containerId === 'b0553f497026') {
        message = errorMessages[Math.floor(Math.random() * errorMessages.length)];
      } else {
        const errorPrefix = "Connection refused|Operation timeout|Out of memory|File not found|Permission denied".split('|')[Math.floor(Math.random() * 5)];
        message = `ERROR: ${errorPrefix} - ${message}`;
      }
    } else if (level === "WARN") {
      const warnMessages = [
        "1:M 02 Sep 2025 10:16:06.123 # WARNING High memory usage detected: 80% used",
        "1:M 02 Sep 2025 10:16:07.456 # WARNING Slow command executed: KEYS * (15ms)",
        "1:M 02 Sep 2025 10:16:08.789 # WARNING Client using deprecated command: SPOP",
        "1:M 02 Sep 2025 10:16:09.123 # WARNING Approaching maximum number of clients",
        "1:M 02 Sep 2025 10:16:10.456 # WARNING Background save taking longer than usual"
      ];
      
      if (containerId === 'redis' || containerId === 'b0553f497026') {
        message = warnMessages[Math.floor(Math.random() * warnMessages.length)];
      } else {
        const warnPrefix = "High resource usage|Approaching limit|Slow operation detected|Retry attempt|Deprecated feature used".split('|')[Math.floor(Math.random() * 5)];
        message = `WARN: ${warnPrefix} - ${message}`;
      }
    }
    
    return { 
      timestamp, 
      level, 
      service: containerId, 
      message
    };
  }
  
  // Create a simulation interval
  const intervalId = setInterval(() => {
    // Generate a random log entry
    const logEntry = generateSimulatedLog(containerId);
    
    // Send it to the client
    ws.send(JSON.stringify({
      type: 'log',
      data: logEntry
    }));
  }, Math.random() * 1000 + 500); // Random interval between 500-1500ms
  
  // Store interval ID for cleanup
  logProcesses.set(ws, { kill: () => clearInterval(intervalId) });
}
//sever port 3001
// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server is running on port ${PORT}`);
});