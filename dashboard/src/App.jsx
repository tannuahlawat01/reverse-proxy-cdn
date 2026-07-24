// dashboard/src/App.jsx
//
// Polls the proxy server's /api/stats endpoint every 2 seconds and
// renders: hit/miss metric cards, a pie chart, a latency comparison,
// and a purge button.

import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Base URL of your PROXY server (not the origin) -- this is the server
// that exposes /api/stats and /api/purge.
const PROXY_URL = "http://localhost:5000";

function App() {
  const [stats, setStats] = useState({ hits: 0, misses: 0, total: 0, hitRatio: "0.00%" });
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);

  // Fetch stats from the proxy server
  const fetchStats = async () => {
    try {
      const res = await fetch(`${PROXY_URL}/api/stats`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setLoading(false);
    }
  };

  // Poll every 2 seconds so the dashboard stays live without manual refresh
  useEffect(() => {
    fetchStats(); // initial fetch on mount
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval); // cleanup on unmount
  }, []);

  // Handle purge button click
  const handlePurge = async () => {
    setPurging(true);
    try {
      await fetch(`${PROXY_URL}/api/purge`, { method: "POST" });
      await fetchStats(); // immediately refresh stats after purge
    } catch (err) {
      console.error("Failed to purge cache:", err);
    } finally {
      setPurging(false);
    }
  };

  // Data shape recharts expects for the pie chart
  const chartData = [
    { name: "Cache Hits", value: stats.hits },
    { name: "Cache Misses", value: stats.misses },
  ];
  const COLORS = ["#22c55e", "#ef4444"]; // green for hits, red for misses

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-1">Reverse Proxy CDN Dashboard</h1>
        <p className="text-slate-400 mb-8">Live cache performance monitoring</p>

        {/* --- Metric cards --- */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <MetricCard label="Cache Hits" value={stats.hits} color="text-green-400" />
          <MetricCard label="Cache Misses" value={stats.misses} color="text-red-400" />
          <MetricCard label="Total Requests" value={stats.total} color="text-blue-400" />
          <MetricCard label="Hit Ratio" value={stats.hitRatio} color="text-yellow-400" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* --- Pie chart --- */}
          <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
            <h2 className="text-lg font-semibold mb-4">Hits vs Misses</h2>
            {stats.total > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-center py-16">
                No requests yet — hit your proxy server to see data here.
              </p>
            )}
          </div>

          {/* --- Latency comparison + purge --- */}
          <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-4">Latency Comparison</h2>
              <LatencyBar label="Cache HIT" value={5} max={200} color="bg-green-500" />
              <LatencyBar label="Cache MISS" value={200} max={200} color="bg-red-500" />
              <p className="text-slate-500 text-sm mt-4">
                Approximate values based on Redis in-memory reads (~5ms) vs.
                the origin server's simulated 200ms delay.
              </p>
            </div>

            <button
              onClick={handlePurge}
              disabled={purging}
              className="mt-6 bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:cursor-not-allowed
                         text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {purging ? "Purging..." : "Purge Cache"}
            </button>
          </div>
        </div>

        {loading && (
          <p className="text-slate-600 text-sm mt-6 text-center">Loading stats...</p>
        )}
      </div>
    </div>
  );
}

// Small reusable metric card component
function MetricCard({ label, value, color }) {
  return (
    <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
      <p className="text-slate-400 text-sm mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

// Simple horizontal bar to visualize latency, scaled against `max`
function LatencyBar({ label, value, max, color }) {
  const widthPercent = (value / max) * 100;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400">{value}ms</span>
      </div>
      <div className="w-full bg-slate-800 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all`}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
    </div>
  );
}

export default App;