import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Video,
  ShieldAlert,
  Activity,
  User,
  Eye,
  Smartphone,
  BookOpen,
  Users,
  Search,
  Filter,
  Play,
  Pause,
  Sparkles
} from 'lucide-react';
import Navbar from '../../components/common/Navbar';
import Sidebar from '../../components/common/Sidebar';
import CameraWidget from '../../components/common/CameraWidget';
import StatusChip from '../../components/common/StatusChip';
import RiskBadge from '../../components/common/RiskBadge';
import { useMonitoring } from '../../contexts/MonitoringContext';

const LiveMonitoringPage = () => {
  const navigate = useNavigate();
  const { students, simulationActive, setSimulationActive, flagStudent } = useMonitoring();

  const safeCount = students.filter(s => s.status === 'Safe').length;
  const warningCount = students.filter(s => s.status === 'Warning').length;
  const criticalCount = students.filter(s => s.status === 'Critical').length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar role="Admin" />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar />

        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Flagship Page Title Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white border border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 mb-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  FLAGSHIP LIVE PROCTORING ENGINE
                </div>
                <h2 className="text-3xl font-black tracking-tight flex items-center gap-2">
                  <Video className="w-8 h-8 text-indigo-400" />
                  Live AI Invigilator Dashboard
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Autonomous YOLOv8 Object & MediaPipe Landmark Detection running on 6 candidate camera streams.
                </p>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSimulationActive(!simulationActive)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                    simulationActive
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                  }`}
                >
                  {simulationActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{simulationActive ? "Pause Stream Simulation" : "Resume Stream"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Realtime KPI Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase">Active Candidates</span>
                <p className="text-2xl font-black text-slate-900">{students.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-700 uppercase">Safe Status</span>
                <p className="text-2xl font-black text-emerald-900">{safeCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Activity className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-700 uppercase">Warning Alerts</span>
                <p className="text-2xl font-black text-amber-900">{warningCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <Eye className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-rose-700 uppercase">Critical Flags</span>
                <p className="text-2xl font-black text-rose-900">{criticalCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Student Grid Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Candidate Live Cards</span>
                <span className="text-xs font-normal text-slate-500">(Click card for deep analysis)</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {students.map((student) => (
                <motion.div
                  key={student.id}
                  whileHover={{ scale: 1.02, y: -2 }}
                  onClick={() => navigate(`/admin/monitoring/${student.id}`)}
                  className={`cursor-pointer rounded-3xl bg-white border-2 shadow-sm hover:shadow-xl transition-all overflow-hidden p-4 space-y-3 ${
                    student.status === "Critical"
                      ? "border-rose-400 ring-2 ring-rose-300/50"
                      : student.status === "Warning"
                      ? "border-amber-300"
                      : "border-slate-200"
                  }`}
                >
                  {/* Camera Widget Overlay */}
                  <CameraWidget
                    studentName={student.name}
                    faceVisible={student.faceVisible}
                    phoneDetected={student.phoneDetected}
                    bookDetected={student.bookDetected}
                    multiplePerson={student.multiplePerson}
                    status={student.status}
                    compact={false}
                  />

                  {/* Candidate Details */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                        {student.name}
                      </h4>
                      <p className="text-[11px] font-mono text-slate-500">PRN: {student.prn}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiskBadge score={student.riskScore} />
                      <StatusChip status={student.status} />
                    </div>
                  </div>

                  {/* Detection Indicators */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-medium bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Face Visible:</span>
                      <span className={`font-bold ${student.faceVisible ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {student.faceVisible ? 'YES' : 'NO'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Phone:</span>
                      <span className={`font-bold ${student.phoneDetected ? 'text-rose-600' : 'text-slate-700'}`}>
                        {student.phoneDetected ? 'DETECTED' : 'None'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Book:</span>
                      <span className={`font-bold ${student.bookDetected ? 'text-amber-600' : 'text-slate-700'}`}>
                        {student.bookDetected ? 'DETECTED' : 'None'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Multi Person:</span>
                      <span className={`font-bold ${student.multiplePerson ? 'text-purple-600' : 'text-slate-700'}`}>
                        {student.multiplePerson ? 'DETECTED' : 'None'}
                      </span>
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-400 text-[10px] truncate max-w-[170px]">
                      {student.lastIncident}
                    </span>
                    <span className="font-bold text-indigo-600 hover:underline">
                      Investigate →
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default LiveMonitoringPage;
