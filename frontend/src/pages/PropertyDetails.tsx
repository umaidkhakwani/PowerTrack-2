import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/client";
import { ArrowLeft, Plus, Zap, Fuel, Download, Filter, Activity, X } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

interface Consumption {
  id: string;
  date: string;
  type: string;
  amount: number;
}

export const PropertyDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [consumption, setConsumption] = useState<Consumption[]>([]);
  const [showLogModal, setShowLogModal] = useState(false);
  const [newLog, setNewLog] = useState({
    date: new Date().toISOString().split("T")[0],
    type: "electric",
    amount: "",
  });

  // Filters (Main Page)
  const [filterType, setFilterType] = useState<string>("both"); // electric, gas, both, combined
  const [filterTime, setFilterTime] = useState<string>("month"); // day, month, year, custom
  const [customRange, setCustomRange] = useState({ start: "", end: "" });

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [properties, setProperties] = useState<{id: string, name: string}[]>([]);
  const [exportForm, setExportForm] = useState({
      type: 'both',
      time: 'month',
      propertyId: 'all',
      customStart: '',
      customEnd: ''
  });

  // Fetch properties for dropdown
  useEffect(() => {
    api.get('/properties').then(res => setProperties(res.data)).catch(console.error);
  }, []);

  const fetchConsumption = useCallback(async () => {
    try {
      let params = `propertyId=${id}&type=${filterType}`;
      
      const now = new Date();
      let from: Date | undefined;
      let to: Date | undefined;

      if (filterTime === "day") {
        from = new Date(now.setHours(0,0,0,0));
        to = new Date(now.setHours(23,59,59,999));
      } else if (filterTime === "month") {
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = new Date();
      } else if (filterTime === "year") {
        from = new Date(now.getFullYear(), 0, 1);
        to = new Date(now.getFullYear(), 11, 31);
      } else if (filterTime === "custom" && customRange.start && customRange.end) {
        from = new Date(customRange.start);
        to = new Date(customRange.end);
      }

      if (from) params += `&from=${from.toISOString()}`;
      if (to) params += `&to=${to.toISOString()}`;
      
      let resolution = 'raw';
      if (filterTime === 'month') resolution = 'day';
      if (filterTime === 'year') resolution = 'month';
      if (filterTime === 'custom') resolution = 'day'; // Default to day for custom to be safe, or logic based on diff

      params += `&resolution=${resolution}`;

      const res = await api.get(`/consumption?${params}`);
      setConsumption(res.data);
    } catch {
      console.error("Failed to fetch consumption");
    }
  }, [id, filterType, filterTime, customRange]);

  useEffect(() => {
    // Debounce custom range or only fetch if valid
    if (filterTime === 'custom' && (!customRange.start || !customRange.end)) return;
    fetchConsumption();
  }, [fetchConsumption, filterTime, customRange]);

  const handleLogConsumption = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/consumption", {
        propertyId: id,
        date: newLog.date,
        type: newLog.type,
        amount: parseFloat(newLog.amount),
      });
      setShowLogModal(false);
      setNewLog({ ...newLog, amount: "" });
      fetchConsumption();
    } catch {
      alert("Failed to log consumption");
    }
  };

  const handleOpenExport = () => {
    // Pre-fill with current page filters if desired, or reset
    setExportForm({
        type: filterType,
        time: filterTime,
        // Let's default to current property ID since we are on Property Details page
        propertyId: id || 'all',
        customStart: customRange.start,
        customEnd: customRange.end
    });
    setShowExportModal(true);
  };

  // Analytics State
  const [analyticsResult, setAnalyticsResult] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const handleAnalyzeTrend = async () => {
    setLoadingAnalytics(true);
    setAnalyticsResult(null);
    try {
        const body = prepareAnalyticsBody();
        const res = await api.post('/consumption/analytics/trend', body);
        const { slope, direction, r_squared } = res.data;
        const confidence = (r_squared * 100).toFixed(1);
        setAnalyticsResult({
            type: 'success',
            message: `Trend: ${direction.toUpperCase()} (Slope: ${slope.toFixed(4)}, Confidence: ${confidence}%)`
        });
    } catch (err: any) {
        setAnalyticsResult({ 
            type: 'error', 
            message: err.response?.data?.message || 'Failed to analyze trend' 
        });
    } finally {
        setLoadingAnalytics(false);
    }
  };

  const handleAnalyzeSpike = async () => {
    setLoadingAnalytics(true);
    setAnalyticsResult(null);
    try {
        const body = prepareAnalyticsBody();
        const res = await api.post('/consumption/analytics/detect-anomalies', body);
        const { is_spike, value, mean, threshold, overall_mean } = res.data;
        
        if (is_spike) {
            setAnalyticsResult({
                type: 'error', // Red for alert
                message: `ANOMALY DETECTED! Latest value ${value.toFixed(2)} exceeded limit ${(mean + threshold).toFixed(2)}. (Period Avg: ${overall_mean.toFixed(2)})`
            });
        } else {
            setAnalyticsResult({
                type: 'success',
                message: `Latest reading is normal. Value: ${value.toFixed(2)} < Limit: ${(mean + threshold).toFixed(2)} (Period Avg: ${overall_mean.toFixed(2)})`
            });
        }
    } catch (err: any) {
        setAnalyticsResult({ 
            type: 'error', 
            message: err.response?.data?.message || 'Failed to detect anomalies' 
        });
    } finally {
        setLoadingAnalytics(false);
    }
  };

  const prepareAnalyticsBody = () => {
       const body: any = { type: filterType, propertyId: id };
       const now = new Date();
      
       if (filterTime === "day") {
        body.from = new Date(now.setHours(0,0,0,0)).toISOString();
        body.to = new Date(now.setHours(23,59,59,999)).toISOString();
      } else if (filterTime === "month") {
        body.from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        body.to = new Date().toISOString();
      } else if (filterTime === "year") {
        body.from = new Date(now.getFullYear(), 0, 1).toISOString();
        body.to = new Date(now.getFullYear(), 11, 31).toISOString();
      } else if (filterTime === "custom") {
        body.from = customRange.start ? new Date(customRange.start).toISOString() : undefined;
        body.to = customRange.end ? new Date(customRange.end).toISOString() : undefined;
      }
      return body;
  };

  const submitExport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        // Reuse the helper
      const body = prepareAnalyticsBody();

      const res = await api.post("/consumption/export", body);
      // Create BOM for Excel compatibility + CSV Content
      const blob = new Blob(["\ufeff" + res.data.csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `consumption_${exportForm.type}_${exportForm.time}.csv`;
      a.click();
      setShowExportModal(false);
    } catch {
      alert("Export failed");
    }
  };

  // Chart Data Prep
  // If 'both', we need to separate data into { date, electric: val, gas: val } structure for Recharts
  // If 'combined', data is already { date, amount, type: 'combined' }
  // If 'single', data is { date, amount, type }

  const processChartData = () => {
    const rawData = [...consumption].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const grouped: Record<string, any> = {};

    rawData.forEach(c => {
        let d = new Date(c.date).toLocaleDateString();
        if (filterTime === 'year') {
             d = new Date(c.date).toLocaleString('default', { month: 'short', timeZone: 'UTC' });
        }

        if (!grouped[d]) {
            grouped[d] = { date: d };
            if (filterType === 'both') {
                grouped[d].electric = 0;
                grouped[d].gas = 0;
            } else {
                grouped[d].value = 0;
                grouped[d].type = filterType === 'combined' ? 'combined' : c.type;
            }
        }

        if (filterType === 'both') {
             if (c.type === 'electric') grouped[d].electric += Number(c.amount);
             if (c.type === 'gas') grouped[d].gas += Number(c.amount);
        } else {
             // GUARD: Ensure we only sum the requested type (unless combined)
             if (filterType !== 'combined' && c.type !== filterType) return;

             // For Single or Combined, just sum up to 'value'
             grouped[d].value += Number(c.amount);
        }
    });

    return Object.values(grouped);
  };

  const chartData = processChartData();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <Link
          to="/"
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-6"
        >
          <ArrowLeft size={20} /> Back to Dashboard
        </Link>

        {/* Header & Controls */}
        <div className="bg-white p-4 rounded-xl shadow-sm mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <h1 className="text-3xl font-bold text-gray-900">Property Consumption</h1>
                <div className="flex gap-2">
                    <button onClick={handleOpenExport} className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-gray-50">
                        <Download size={16} /> Export CSV
                    </button>
                    <button onClick={() => setShowLogModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700">
                        <Plus size={20} /> Log Data
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-gray-500" />
                    <span className="font-semibold text-gray-700">Filters:</span>
                </div>
                
                <select 
                    className="border rounded px-3 py-1.5 text-sm bg-white"
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                >
                    <option value="both">Both (Splitted)</option>
                    <option value="combined">All (Cumulative)</option>
                    <option value="electric">Electricity Only</option>
                    <option value="gas">Gas Only</option>
                </select>

                <select 
                    className="border rounded px-3 py-1.5 text-sm bg-white"
                    value={filterTime}
                    onChange={e => setFilterTime(e.target.value)}
                >
                    <option value="day">Today</option>
                    <option value="month">This Month</option>
                    <option value="year">This Year</option>
                    <option value="custom">Custom Range</option>
                </select>

                {filterTime === 'custom' && (
                    <div className="flex items-center gap-2">
                        <input type="date" className="border rounded px-2 py-1 text-sm" 
                            onChange={e => setCustomRange({...customRange, start: e.target.value})} />
                        <span className="text-gray-400">-</span>
                        <input type="date" className="border rounded px-2 py-1 text-sm" 
                            onChange={e => setCustomRange({...customRange, end: e.target.value})} />
                    </div>
                )}
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm h-[500px] flex flex-col">
            <h3 className="text-lg font-semibold mb-4">Analytics</h3>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  
                  {filterType === 'both' ? (
                      <>
                        <Line type="monotone" dataKey="electric" name="Electricity" stroke="#EAB308" strokeWidth={2} dot={{r: 4}} />
                        <Line type="monotone" dataKey="gas" name="Gas" stroke="#F97316" strokeWidth={2} dot={{r: 4}} />
                      </>
                  ) : (
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        name={filterType === 'combined' ? 'Total Usage' : filterType === 'electric' ? 'Electricity' : 'Gas'}
                        stroke="#2563eb" 
                        strokeWidth={2}
                        dot={{r: 4}} 
                       />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Analytics Controls */}
            <div className="mt-4 pt-4 border-t flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex gap-2">
                    <button onClick={handleAnalyzeTrend} disabled={loadingAnalytics} className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-4 py-2 rounded-md font-medium text-sm transition-colors">
                        {loadingAnalytics ? 'Analyzing...' : 'Analyze Usage Trend'}
                    </button>
                    <button onClick={handleAnalyzeSpike} disabled={loadingAnalytics} className="bg-rose-100 text-rose-700 hover:bg-rose-200 px-4 py-2 rounded-md font-medium text-sm transition-colors">
                        {loadingAnalytics ? 'Detecting...' : 'Detect Anomalies'}
                    </button>
                </div>
                
                {analyticsResult && (
                    <div className={`px-4 py-2 rounded-md text-sm font-medium ${analyticsResult.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {analyticsResult.message}
                    </div>
                )}
            </div>
          </div>

          {/* Recent History List */}
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold mb-4">History ({consumption.length})</h3>
            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2">
              {consumption.map((c: Consumption, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${c.type === "electric" ? "bg-yellow-100 text-yellow-600" : c.type === "gas" ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"}`}>
                      {c.type === "electric" ? <Zap size={16} /> : c.type === "gas" ? <Fuel size={16} /> : <Activity size={16} />}
                    </div>
                    <div>
                      <p className="font-medium">{new Date(c.date).toLocaleDateString()}</p>
                      <p className="text-xs text-gray-500 capitalize">{c.type}</p>
                    </div>
                  </div>
                  <span className="font-bold text-lg">{Number(c.amount).toFixed(2)}</span>
                </div>
              ))}
              {consumption.length === 0 && (
                <p className="text-gray-500 text-center py-8">No records match filters.</p>
              )}
            </div>
          </div>
        </div>
      </div>

    {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Export Data</h3>
                <button onClick={() => setShowExportModal(false)} className="text-gray-500 hover:text-gray-700">
                    <X size={20} />
                </button>
            </div>
            
            <form onSubmit={submitExport} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select 
                    className="w-full border rounded px-3 py-2"
                    value={exportForm.type}
                    onChange={(e) => setExportForm({...exportForm, type: e.target.value})}
                >
                    <option value="both">Both (Splitted)</option>
                    <option value="combined">All (Cumulative)</option>
                    <option value="electric">Electricity Only</option>
                    <option value="gas">Gas Only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Time Range</label>
                <select 
                    className="w-full border rounded px-3 py-2"
                    value={exportForm.time}
                    onChange={(e) => setExportForm({...exportForm, time: e.target.value})}
                >
                    <option value="day">Today</option>
                    <option value="month">This Month</option>
                    <option value="year">This Year</option>
                    <option value="custom">Custom Range</option>
                </select>
              </div>

              {exportForm.time === 'custom' && (
                <div className="flex gap-2">
                    <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Start</label>
                        <input type="date" className="w-full border rounded px-2 py-1" 
                            value={exportForm.customStart}
                            onChange={e => setExportForm({...exportForm, customStart: e.target.value})} required />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">End</label>
                        <input type="date" className="w-full border rounded px-2 py-1" 
                            value={exportForm.customEnd}
                            onChange={e => setExportForm({...exportForm, customEnd: e.target.value})} required />
                    </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Property</label>
                <select 
                    className="w-full border rounded px-3 py-2"
                    value={exportForm.propertyId}
                    onChange={(e) => setExportForm({...exportForm, propertyId: e.target.value})}
                >
                    <option value="all">All Properties</option>
                    {properties.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowExportModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">
                    <Download size={16} /> Export CSV
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLogModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-bold mb-4">Log Consumption</h3>
            <form onSubmit={handleLogConsumption} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input type="date" className="w-full border rounded px-3 py-2" value={newLog.date} onChange={(e) => setNewLog({ ...newLog, date: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select className="w-full border rounded px-3 py-2" value={newLog.type} onChange={(e) => setNewLog({ ...newLog, type: e.target.value })}>
                  <option value="electric">Electricity</option>
                  <option value="gas">Gas</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input type="number" step="0.01" className="w-full border rounded px-3 py-2" value={newLog.amount} onChange={(e) => setNewLog({ ...newLog, amount: e.target.value })} required placeholder="0.00" />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowLogModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Log</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
