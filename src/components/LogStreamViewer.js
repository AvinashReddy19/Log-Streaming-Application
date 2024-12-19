'use client';
import { useState, useEffect } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent } from "@/components/ui/select"; // Import the necessary components
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import { SelectItem } from "@/components/ui/select";

const logLevels = ["INFO", "DEBUG", "WARN", "ERROR"];
const services = ["nginx", "api", "database", "cache"];

export default function LogStreamViewer() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [timeFilter, setTimeFilter] = useState("live");
  const [autoScroll, setAutoScroll] = useState(true);

  const generateLog = () => {
    const level = logLevels[Math.floor(Math.random() * logLevels.length)];
    const service = services[Math.floor(Math.random() * services.length)];
    const timestamp = new Date().toISOString();
    const message = `[${service}] Sample log message ${Math.floor(Math.random() * 1000)}`;

    return { timestamp, level, service, message };
  };

  const getLevelColor = (level) => {
    const colors = {
      INFO: "text-blue-400",
      DEBUG: "text-gray-400",
      WARN: "text-yellow-400",
      ERROR: "text-red-400",
    };
    return colors[level] || "text-gray-100";
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const newLog = generateLog();
      setLogs((prevLogs) => {
        const updatedLogs = [...prevLogs, newLog];
        return updatedLogs.slice(-1000);
      });
    }, Math.random() * 1000 + 333);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (autoScroll) {
      const container = document.querySelector(".log-container");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [logs, autoScroll]);

  const handleTimeFilterChange = (value) => {
    setTimeFilter(value);
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

    setLogs((prevLogs) =>
      prevLogs.filter((log) => new Date(log.timestamp) >= cutoff)
    );
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      log.service.toLowerCase().includes(search.toLowerCase());
    const matchesLevel = levelFilter === "ALL" || log.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Log Stream Viewer</h1>
        <p className="text-gray-400">Real-time container logs monitoring</p>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs..."
          />
        </div>

        {/* Updated Select component structure */}
        <Select value={levelFilter} onValueChange={setLevelFilter} placeholder="Select Level">
          <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700">
            <SelectValue placeholder="Select Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Levels</SelectItem>
            {logLevels.map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={timeFilter} onValueChange={handleTimeFilterChange} placeholder="Select Time">
          <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700">
            <SelectValue placeholder="Select Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="1h">Last Hour</SelectItem>
            <SelectItem value="6h">Last 6 Hours</SelectItem>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={autoScroll ? "default" : "secondary"}
          onClick={() => setAutoScroll(!autoScroll)}
        >
          <ArrowUpDown className="mr-2 h-4 w-4" /> Auto-scroll
        </Button>
      </div>

      <div className="log-container h-[600px] overflow-y-auto bg-gray-800 rounded-lg p-4 font-mono text-sm">
        {filteredLogs.map((log, index) => (
          <div key={index} className="log-entry py-1 border-b border-gray-700 animate-fadeIn">
            <span className="text-gray-500">{log.timestamp}</span>
            <span className={`${getLevelColor(log.level)} ml-2`}>[{log.level}]</span>
            <span className="text-gray-300 ml-2">{log.message}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-between text-sm text-gray-400">
        <span>Status: Connected</span>
        <span>Logs: {filteredLogs.length}</span>
      </div>
    </div>
  );
}
