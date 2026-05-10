"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Thermometer, Droplets, Leaf, Battery, Zap, Activity, 
  ArrowUpRight, ArrowDownRight, CheckCircle2, AlertTriangle, 
  Settings, Play, Square, Download, RefreshCcw, Search, Menu, Clock
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut, Radar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Reading {
  temperature: number;
  humidity: number;
  soilMoisture: number;
  soilStatus: string;
  voltage: number;
  pumpStatus: string;
  npk: { N: number; P: number; K: number };
  ec: number;
  ph: number;
  salinity: number;
  timestamp: string;
}

export default function SoilMonitor() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [pumpState, setPumpState] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  // Fake sensor state refs to maintain values across intervals
  const fakeState = useRef({
    temp: 29, hum: 62, soil: 52, volt: 4.75,
    n: 55, p: 22, k: 105, ec: 1200, ph: 6.5, salinity: 1.2
  });

  const soilDecayRate = 0.08;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const generateData = () => {
    const s = fakeState.current;
    s.temp += (Math.random() - 0.5) * 0.5;
    s.temp = Math.min(32, Math.max(26, s.temp));
    
    s.hum += (Math.random() - 0.5) * 1.2 - (s.temp - 29) * 0.05;
    s.hum = Math.min(75, Math.max(50, s.hum));

    let localPump = pumpState;
    if (autoMode && !manualOverride) {
      if (s.soil < 40) localPump = true;
      if (s.soil > 55) localPump = false;
      setPumpState(localPump);
    }

    if (localPump) {
      s.soil += 0.6 + Math.random() * 0.4;
    } else {
      s.soil -= soilDecayRate + Math.random() * 0.05;
    }
    s.soil = Math.min(65, Math.max(35, s.soil));

    s.volt += (Math.random() - 0.5) * 0.04;
    s.volt = Math.min(4.9, Math.max(4.6, s.volt));

    s.n += (Math.random() - 0.5) * 2;
    s.n = Math.min(100, Math.max(20, s.n));
    s.p += (Math.random() - 0.5) * 1;
    s.p = Math.min(50, Math.max(5, s.p));
    s.k += (Math.random() - 0.5) * 3;
    s.k = Math.min(200, Math.max(40, s.k));

    s.ec = (s.n * 8 + s.p * 12 + s.k * 5) + (Math.random() - 0.5) * 100;
    s.ec = Math.min(3000, Math.max(200, s.ec));
    s.ph += (Math.random() - 0.5) * 0.05;
    s.ph = Math.min(8.5, Math.max(5.5, s.ph));
    s.salinity = s.ec * 0.00064;

    const newReading: Reading = {
      temperature: +s.temp.toFixed(1),
      humidity: +s.hum.toFixed(1),
      soilMoisture: +s.soil.toFixed(1),
      soilStatus: s.soil >= 50 ? "WET" : "DRY",
      voltage: +s.volt.toFixed(2),
      pumpStatus: localPump ? "ON" : "OFF",
      npk: { N: +s.n.toFixed(1), P: +s.p.toFixed(1), K: +s.k.toFixed(1) },
      ec: +s.ec.toFixed(0),
      ph: +s.ph.toFixed(2),
      salinity: +s.salinity.toFixed(3),
      timestamp: new Date().toISOString()
    };

    setReadings(prev => {
      const updated = [...prev, newReading];
      return updated.slice(-100);
    });
  };

  useEffect(() => {
    generateData();
    const interval = setInterval(generateData, 3000);
    return () => clearInterval(interval);
  }, [pumpState, autoMode, manualOverride]);

  const latest = readings[readings.length - 1] || {
    temperature: 0, humidity: 0, soilMoisture: 0, soilStatus: "---",
    voltage: 0, pumpStatus: "---", npk: { N: 0, P: 0, K: 0 },
    ec: 0, ph: 0, salinity: 0
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        padding: 12,
        cornerRadius: 12,
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.4)' } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.4)' } }
    }
  };

  const lineData = {
    labels: readings.map(r => new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })),
    datasets: [
      {
        label: 'Soil Moisture %',
        data: readings.map(r => r.soilMoisture),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
      }
    ]
  };

  const radarData = {
    labels: ['Nitrogen', 'Phosphorus', 'Potassium', 'EC', 'pH', 'Moisture'],
    datasets: [
      {
        label: 'Current',
        data: [latest.npk.N, latest.npk.P, latest.npk.K, latest.ec / 20, latest.ph * 10, latest.soilMoisture],
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        borderColor: '#22c55e',
        borderWidth: 2,
      },
      {
        label: 'Target',
        data: [60, 25, 120, 60, 65, 55],
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        borderDash: [5, 5],
      }
    ]
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-green-500/30">
      <Navbar />

      <main className="container mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 text-green-500 font-bold tracking-widest text-xs uppercase mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Live Telemetry
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">SoilGuard <span className="text-slate-500">Node Alpha</span></h1>
          </div>
          <div className="flex items-center gap-3 bg-slate-900/50 backdrop-blur-md border border-slate-800 p-2 rounded-2xl">
            <div className="px-4 py-2 bg-slate-800 rounded-xl">
              <span className="text-slate-400 text-xs font-bold block leading-none mb-1">SYSTEM CLOCK</span>
              <span className="text-lg font-mono font-bold">{currentTime}</span>
            </div>
            <button className="p-3 hover:bg-slate-800 rounded-xl transition-colors">
              <RefreshCcw className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Top Cards */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Temp Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Thermometer className="w-24 h-24 text-orange-500" />
              </div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/20">
                  <Thermometer className="w-6 h-6 text-orange-500" />
                </div>
                <div className="flex items-center gap-1 text-green-400 text-xs font-bold bg-green-400/10 px-2 py-1 rounded-lg">
                  <ArrowUpRight className="w-3 h-3" /> 0.4%
                </div>
              </div>
              <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Temperature</div>
              <div className="text-4xl font-black">{latest.temperature}<span className="text-xl text-slate-500 font-medium ml-1">°C</span></div>
            </motion.div>

            {/* Moisture Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Droplets className="w-24 h-24 text-blue-500" />
              </div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                  <Droplets className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex items-center gap-1 text-red-400 text-xs font-bold bg-red-400/10 px-2 py-1 rounded-lg">
                  <ArrowDownRight className="w-3 h-3" /> 1.2%
                </div>
              </div>
              <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Soil Moisture</div>
              <div className="text-4xl font-black">{latest.soilMoisture}<span className="text-xl text-slate-500 font-medium ml-1">%</span></div>
            </motion.div>

            {/* NPK Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Leaf className="w-24 h-24 text-green-500" />
              </div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center border border-green-500/20">
                  <Leaf className="w-6 h-6 text-green-500" />
                </div>
                <div className="flex items-center gap-1 text-green-400 text-xs font-bold bg-green-400/10 px-2 py-1 rounded-lg">
                   Balanced
                </div>
              </div>
              <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Nutrient Level (NPK)</div>
              <div className="text-4xl font-black">{latest.npk.N}<span className="text-xl text-slate-500 font-medium mx-1">/</span>{latest.npk.P}<span className="text-xl text-slate-500 font-medium mx-1">/</span>{latest.npk.K}</div>
            </motion.div>

            {/* Analytics Section */}
            <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 h-[400px] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-green-500" /> 
                  Moisture Stability
                </h3>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-slate-800 rounded-full text-[10px] font-bold text-slate-400 uppercase">Last 24h</span>
                </div>
              </div>
              <div className="flex-1 w-full relative">
                <Line data={lineData} options={chartOptions} />
              </div>
            </div>

            {/* AI Insights Card */}
            <div className="bg-gradient-to-br from-green-600 to-emerald-700 p-8 rounded-[2.5rem] text-white flex flex-col justify-between shadow-2xl shadow-green-900/20">
              <div>
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md border border-white/30">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-black mb-2">AI Fertility Grade</h3>
                <p className="text-green-50 text-sm leading-relaxed mb-6 font-medium">
                  Based on NPK levels and soil EC, your farm health is performing at optimal efficiency.
                </p>
              </div>
              <div className="flex items-end justify-between">
                <div className="text-7xl font-black tracking-tighter drop-shadow-lg">A+</div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">Confidence</div>
                  <div className="text-lg font-bold">98.4%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Control Panel */}
          <div className="flex flex-col gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 overflow-hidden relative">
              <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-400" />
                Irrigation Control
              </h3>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-3xl border border-slate-800">
                  <div>
                    <div className="text-sm font-bold">Auto Mode</div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">ML Powered</div>
                  </div>
                  <button 
                    onClick={() => { setAutoMode(!autoMode); if (!autoMode) setManualOverride(false); }}
                    className={`w-14 h-8 rounded-full relative transition-colors duration-300 ${autoMode ? 'bg-green-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 ${autoMode ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-3xl border border-slate-800">
                  <div>
                    <div className="text-sm font-bold">Manual Overide</div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Force Pump</div>
                  </div>
                  <button 
                    onClick={() => { setManualOverride(!manualOverride); if (!manualOverride) { setAutoMode(false); setPumpState(true); } else { setPumpState(false); } }}
                    className={`w-14 h-8 rounded-full relative transition-colors duration-300 ${manualOverride ? 'bg-orange-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 ${manualOverride ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>

                <div className={`p-8 rounded-[2rem] transition-all flex flex-col items-center justify-center border-2 ${latest.pumpStatus === 'ON' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-800/50 border-slate-800'}`}>
                   <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all ${latest.pumpStatus === 'ON' ? 'bg-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.5)] animate-pulse' : 'bg-slate-700'}`}>
                      <Droplets className="w-10 h-10 text-white" />
                   </div>
                   <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 text-slate-500">Pump Status</div>
                   <div className={`text-2xl font-black ${latest.pumpStatus === 'ON' ? 'text-blue-400' : 'text-slate-400'}`}>{latest.pumpStatus}</div>
                </div>
                
                <button 
                  onClick={() => { setPumpState(!pumpState); setManualOverride(true); setAutoMode(false); }}
                  className={`w-full py-4 rounded-3xl font-black text-sm transition-all flex items-center justify-center gap-2 ${latest.pumpStatus === 'ON' ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white' : 'bg-green-500 text-slate-950 hover:scale-[1.02]'}`}
                >
                  {latest.pumpStatus === 'ON' ? <><Square className="w-4 h-4 fill-current" /> STOP PUMP</> : <><Play className="w-4 h-4 fill-current" /> START PUMP</>}
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-slate-400" />
                Nutrient Radar
              </h3>
              <div className="h-[250px] w-full relative">
                <Radar data={radarData} options={{
                  ...chartOptions,
                  scales: {
                    r: {
                      angleLines: { color: 'rgba(255,255,255,0.1)' },
                      grid: { color: 'rgba(255,255,255,0.1)' },
                      pointLabels: { color: 'rgba(255,255,255,0.5)', font: { size: 9 } },
                      ticks: { display: false }
                    }
                  }
                }} />
              </div>
            </div>
          </div>

          {/* Bottom Table Section */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h3 className="text-2xl font-black mb-1">Telemetry Logs</h3>
                <p className="text-slate-500 text-sm">Real-time data archival for enterprise auditing.</p>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-xl border border-slate-700">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-400">Archiving {readings.length} Frames</span>
                </div>
                <button className="flex items-center gap-2 px-6 py-2 bg-green-500 text-slate-950 rounded-xl font-bold text-sm hover:bg-green-400 transition-colors">
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-slate-800">
                    <th className="pb-4 px-4">Timestamp</th>
                    <th className="pb-4 px-4">Temp</th>
                    <th className="pb-4 px-4">Soil %</th>
                    <th className="pb-4 px-4">NPK</th>
                    <th className="pb-4 px-4">EC</th>
                    <th className="pb-4 px-4">pH</th>
                    <th className="pb-4 px-4">Pump</th>
                    <th className="pb-4 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <AnimatePresence>
                    {readings.slice(-10).reverse().map((r, idx) => (
                      <motion.tr 
                        key={r.timestamp}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-sm font-medium hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-4 px-4 text-slate-400 font-mono text-xs">{new Date(r.timestamp).toLocaleTimeString()}</td>
                        <td className="py-4 px-4">{r.temperature}°C</td>
                        <td className="py-4 px-4">{r.soilMoisture}%</td>
                        <td className="py-4 px-4">
                          <span className="text-green-500">{r.npk.N}</span>/
                          <span className="text-orange-500">{r.npk.P}</span>/
                          <span className="text-purple-500">{r.npk.K}</span>
                        </td>
                        <td className="py-4 px-4">{r.ec}</td>
                        <td className="py-4 px-4">{r.ph}</td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${r.pumpStatus === 'ON' ? 'bg-blue-500/10 text-blue-500' : 'bg-slate-800 text-slate-500'}`}>
                            {r.pumpStatus}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span className="text-xs">Healthy</span>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
