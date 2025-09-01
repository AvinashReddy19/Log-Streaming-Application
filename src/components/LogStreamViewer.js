'use client';
import { useState, useEffect, useRef } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Download, RefreshCw, Pause, Play, X } from "lucide-react";

// Define constants
const LOG_LEVELS = ["INFO", "DEBUG", "WARN", "ERROR"];
const TIME_FILTERS = [
  { value: "live", label: "Live" },
  { value: "1h", label: "Last Hour" },
  { value: "6h", label: "Last 6 Hours" },
  { value: "24h", label: "Last 24 Hours" },
];

// Container options using the actual Redis container
const CONTAINERS = [
  { id: "b0553f497026", name: "Redis Server" },
  { id: "redis", name: "Redis (Container Name)" },
  { id: "nginx", name: "Nginx Web Server (Simulation)" },
  { id: "mongo", name: "MongoDB Database (Simulation)" },
];

export default function LogStreamViewer() {
  // State management
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [timeFilter, setTimeFilter] = useState("live");
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [containerId, setContainerId] = useState("b0553f497026"); // Default to actual Redis container
  const [connectionError, setConnectionError] = useState("");
  
  // References
  const logContainerRef = useRef(null);
  const socketRef = useRef(null);
  const pausedBufferRef = useRef([]);

  // Connect to WebSocket
  useEffect(() => {
    let isComponentMounted = true;
    
    const connectWebSocket = () => {
      try {
        // In a real app, this URL would point to your WebSocket server
        // Using fallback to simulation if WebSocket connection fails
        const ws = new WebSocket(`ws://localhost:3001`);
        
        ws.onopen = () => {
          if (!isComponentMounted) return;
          
          console.log('WebSocket connection established');
          setIsConnected(true);
          setConnectionError("");
          
          // Subscribe to container logs
          ws.send(JSON.stringify({
            type: 'subscribe',
            containerId
          }));
        };
        
        ws.onmessage = (event) => {
          if (!isComponentMounted) return;
          
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'log') {
              const newLog = data.data;
              
              if (isPaused) {
                // If paused, store logs in buffer
                pausedBufferRef.current.push(newLog);
              } else {
                // Otherwise, update state
                setLogs(prevLogs => {
                  const updatedLogs = [...prevLogs, newLog];
                  return updatedLogs.slice(-1000); // Keep last 1000 logs
                });
              }
            } else if (data.type === 'error') {
              setConnectionError(data.message);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        ws.onclose = () => {
          if (!isComponentMounted) return;
          
          console.log('WebSocket connection closed');
          setIsConnected(false);
          
          // Try to reconnect after a delay
          setTimeout(() => {
            if (isComponentMounted) {
              startSimulation();
            }
          }, 3000);
        };
        
        ws.onerror = (error) => {
          if (!isComponentMounted) return;
          
          console.error('WebSocket error:', error);
          setConnectionError("Failed to connect to log server. Using simulation mode.");
          
          // Fall back to simulation
          startSimulation();
        };
        
        socketRef.current = ws;
      } catch (error) {
        console.error('Error establishing WebSocket connection:', error);
        
        if (isComponentMounted) {
          setConnectionError("Failed to connect to log server. Using simulation mode.");
          startSimulation();
        }
      }
    };
    
    // Fallback to simulation if WebSocket connection fails
    const startSimulation = () => {
      console.log('Starting log simulation');
      setConnectionError("Using simulated logs (WebSocket unavailable)");
      
      // Clear any existing interval
      if (socketRef.current && typeof socketRef.current === 'number') {
        clearInterval(socketRef.current);
      }
      
      // Set simulated connected state
      setIsConnected(true);
      
      // Start simulation interval
      const interval = setInterval(() => {
        if (!isComponentMounted) return;
        
        const newLog = generateSimulatedLog();
        
        if (isPaused) {
          // If paused, store logs in buffer
          pausedBufferRef.current.push(newLog);
        } else {
          // Otherwise, update state
          setLogs(prevLogs => {
            const updatedLogs = [...prevLogs, newLog];
            return updatedLogs.slice(-1000); // Keep last 1000 logs
          });
        }
      }, Math.random() * 500 + 200);
      
      socketRef.current = interval;
    };
    
    // Start connection
    if (!isPaused) {
      connectWebSocket();
    }
    
    // Cleanup function
    return () => {
      isComponentMounted = false;
      
      // Close WebSocket if it exists
      if (socketRef.current) {
        if (typeof socketRef.current === 'object' && socketRef.current.close) {
          // It's a WebSocket
          socketRef.current.close();
        } else if (typeof socketRef.current === 'number') {
          // It's an interval ID
          clearInterval(socketRef.current);
        }
      }
    };
  }, [isPaused, containerId]);

  // Helper function to generate a simulated log (fallback if WebSocket fails)
  const generateSimulatedLog = () => {
    const level = LOG_LEVELS[Math.floor(Math.random() * LOG_LEVELS.length)];
    const timestamp = new Date().toISOString();
    
    // Messages specific to the selected container
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
    } else if (containerId === 'redis') {
      messages = [
        "Redis started, ready to accept connections",
        "Connection from 192.168.1.107:50001",
        "Client auth successful",
        "SET key1 success",
        "GET key1 success",
        "LPUSH list1 success",
        "Saving RDB to disk...",
        "RDB saved successfully"
      ];
    } else {
      messages = [
        "Process started",
        "Configuration loaded",
        "Client connected",
        "Operation successful",
        "Background task running",
        "Resource acquired",
        "Task completed",
        "System status nominal"
      ];
    }
    
    let message = messages[Math.floor(Math.random() * messages.length)];
    
    // Add more context for ERROR and WARN levels
    if (level === "ERROR") {
      const errorMessages = [
        "Connection refused",
        "Operation timeout",
        "Out of memory",
        "File not found",
        "Permission denied"
      ];
      const errorPrefix = errorMessages[Math.floor(Math.random() * errorMessages.length)];
      message = `ERROR: ${errorPrefix} - ${message}`;
    } else if (level === "WARN") {
      const warnMessages = [
        "High resource usage",
        "Approaching limit",
        "Slow operation detected",
        "Retry attempt",
        "Deprecated feature used"
      ];
      const warnPrefix = warnMessages[Math.floor(Math.random() * warnMessages.length)];
      message = `WARN: ${warnPrefix} - ${message}`;
    }
    
    return { 
      timestamp, 
      level, 
      service: containerId, 
      message
    };
  };

  // Auto-scroll functionality
  useEffect(() => {
    if (autoScroll && logContainerRef.current && logs.length > 0) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Helper to get color for log level
  const getLevelColor = (level) => {
    const colors = {
      INFO: "text-blue-400",
      DEBUG: "text-gray-400",
      WARN: "text-yellow-400",
      ERROR: "text-red-400",
    };
    return colors[level] || "text-gray-100";
  };

  // Handle time filter changes
  const handleTimeFilterChange = (value) => {
    setTimeFilter(value);
    
    if (value === "live") {
      return; // No filtering for live mode
    }
    
    const now = new Date();
    let cutoff = new Date();

    switch (value) {
      case "1h":
        cutoff.setHours(now.getHours() - 1);
        break;
      case "6h":
        cutoff.setHours(now.getHours() - 6);
        break;
      case "24h":
        cutoff.setHours(now.getHours() - 24);
        break;
      default:
        return;
    }

    // Filter logs based on time
    setLogs((prevLogs) =>
      prevLogs.filter((log) => new Date(log.timestamp) >= cutoff)
    );
  };

  // Handle container change
  const handleContainerChange = (value) => {
    setContainerId(value);
    setLogs([]); // Clear logs when changing container
  };

  // Handle pause/resume streaming
  const togglePause = () => {
    if (isPaused) {
      // If resuming, add buffered logs to the state
      if (pausedBufferRef.current.length > 0) {
        setLogs(prevLogs => {
          const updatedLogs = [...prevLogs, ...pausedBufferRef.current];
          pausedBufferRef.current = [];
          return updatedLogs.slice(-1000); // Keep last 1000 logs
        });
      }
    }
    
    setIsPaused(!isPaused);
  };

  // Handle clearing logs
  const clearLogs = () => {
    setLogs([]);
    pausedBufferRef.current = [];
  };

  // Handle downloading logs
  const downloadLogs = () => {
    const logText = filteredLogs.map(log => 
      `${log.timestamp} [${log.level}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${containerId}-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filter logs based on search and level filter
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      search === "" || 
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      (log.service && log.service.toLowerCase().includes(search.toLowerCase()));
    const matchesLevel = levelFilter === "ALL" || log.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Log Stream Viewer</h1>
        <p className="text-gray-400">Real-time container logs monitoring</p>
      </div>

      {/* Container selection */}
      <div className="mb-6">
        <Select value={containerId} onValueChange={handleContainerChange}>
          <SelectTrigger className="w-full max-w-xs bg-gray-800 border-gray-700">
            <SelectValue placeholder="Select Container" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            {CONTAINERS.map((container) => (
              <SelectItem key={container.id} value={container.id}>
                {container.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Controls section */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="bg-gray-800 border-gray-700"
          />
        </div>

        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700">
            <SelectValue placeholder="Select Level" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            <SelectItem value="ALL">All Levels</SelectItem>
            {LOG_LEVELS.map((level) => (
              <SelectItem key={level} value={level}>{level}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={timeFilter} onValueChange={handleTimeFilterChange}>
          <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700">
            <SelectValue placeholder="Select Time" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            {TIME_FILTERS.map((filter) => (
              <SelectItem key={filter.value} value={filter.value}>
                {filter.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={autoScroll ? "default" : "secondary"}
          onClick={() => setAutoScroll(!autoScroll)}
          className="bg-gray-700 hover:bg-gray-600"
        >
          <ArrowUpDown className="mr-2 h-4 w-4" /> Auto-scroll
        </Button>
        
        <Button 
          variant={isPaused ? "secondary" : "outline"} 
          onClick={togglePause}
          className="bg-gray-700 hover:bg-gray-600"
        >
          {isPaused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
          {isPaused ? "Resume" : "Pause"}
        </Button>

        <Button 
          variant="outline" 
          onClick={clearLogs}
          className="bg-gray-700 hover:bg-gray-600"
          disabled={logs.length === 0}
        >
          <X className="mr-2 h-4 w-4" /> Clear
        </Button>

        <Button 
          variant="outline" 
          onClick={downloadLogs}
          className="bg-gray-700 hover:bg-gray-600"
          disabled={filteredLogs.length === 0}
        >
          <Download className="mr-2 h-4 w-4" /> Export
        </Button>
      </div>

      {/* Connection status banner */}
      {!isConnected && (
        <div className="mb-4 p-3 bg-yellow-900/50 border border-yellow-700 rounded-lg flex items-center">
          <RefreshCw className="h-5 w-5 mr-2 animate-spin text-yellow-500" />
          <span>Connecting to container logs...</span>
        </div>
      )}
      
      {connectionError && (
        <div className="mb-4 p-3 bg-yellow-900/50 border border-yellow-700 rounded-lg">
          <p className="text-yellow-400">{connectionError}</p>
        </div>
      )}

      {/* Log display area */}
      <div 
        ref={logContainerRef}
        className="log-container h-[600px] overflow-y-auto bg-gray-800 rounded-lg p-4 font-mono text-sm"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            {isConnected ? "No logs matching current filters" : "Waiting for logs..."}
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div 
              key={index} 
              className="log-entry py-1 border-b border-gray-700 hover:bg-gray-700/30 transition-colors"
            >
              <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
              <span className={`${getLevelColor(log.level)} ml-2 inline-block w-16`}>[{log.level}]</span>
              <span className="text-gray-300 ml-2">{log.message}</span>
            </div>
          ))
        )}
      </div>

      {/* Status footer */}
      <div className="mt-4 flex flex-wrap justify-between text-sm text-gray-400">
        <span>Status: {isConnected ? "Connected" : "Connecting..."}</span>
        <span>Container: {containerId}</span>
        <span>Logs: {filteredLogs.length} displayed {isPaused ? `(${pausedBufferRef.current.length} buffered)` : ''}</span>
      </div>
    </div>
  );
}