import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  ArrowLeft,
  ShieldAlert,
  FileText,
  Clock,
  Eye,
  Smartphone,
  BookOpen,
  Users,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Zap
} from 'lucide-react';
import Navbar from '../../components/common/Navbar';
import Sidebar from '../../components/common/Sidebar';
import CameraWidget from '../../components/common/CameraWidget';
import StatusChip from '../../components/common/StatusChip';
import RiskBadge from '../../components/common/RiskBadge';
import { monitoringService } from '../../services/monitoringService';
import { useMonitoring } from '../../contexts/MonitoringContext';

const StudentDetailPage = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { flagStudent } = useMonitoring();
  const [student, setStudent] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [flagging, setFlagging] = useState(false);

  useEffect(() => {
    monitoringService.getStudentById(studentId).then(setStudent);
    monitoringService.getStudentIncidents(studentId).then(setIncidents);
    monitoringService.getRiskTimeline().then(setTimelineData);
  }, [studentId]);

  if (!student) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center font-bold text-slate-500">Loading student proctoring file...</div>
      </div>
    );
  }

  const handleFlagStudent = () => {
    const reason = prompt("Enter reason for manual security flag:", "Suspicious head movement and unverified secondary device.");
    if (reason) {
      flagStudent(student.id, reason);
      setStudent({ ...student, status: "Critical", riskScore: 95 });
      alert("Student session successfully flagged!");
    }
  };

  const handleGenerateReport = () => {
    alert(`Generating candidate audit dossier PDF for ${student.name} (${student.prn})... Download ready!`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar role="Admin" />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar />

        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Top Bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/admin/monitoring')}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Live Grid</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleFlagStudent}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-all"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Flag Candidate</span>
              </button>

              <button
                onClick={handleGenerateReport}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
              >
                <FileText className="w-4 h-4" />
                <span>Generate Audit Report</span>
              </button>
            </div>
          </div>

          {/* Candidate Profile Header */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <img
                src={student.avatar}
                alt={student.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-200 shadow-sm"
              />
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{student.name}</h2>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                  <span>PRN: <strong className="text-slate-800 font-mono">{student.prn}</strong></span>
                  <span>•</span>
                  <span>IP: <strong className="text-slate-800 font-mono">{student.ipAddress}</strong></span>
                  <span>•</span>
                  <span>Browser: <strong className="text-slate-800">{student.browser}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[11px] font-bold text-slate-400 block">Warning Count</span>
                <span className="text-2xl font-black text-rose-600">{student.warningCount} Alerts</span>
              </div>
              <RiskBadge score={student.riskScore} size="lg" />
              <StatusChip status={student.status} />
            </div>
          </div>

          {/* Main Grid: Left Large Camera + Right Analytics Timelines */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Large Camera Stream & Object Detection History */}
            <div className="lg:col-span-7 space-y-6">
              {/* Large Camera Feed Placeholder */}
              <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-500" />
                    High-Definition Live Feed & AI Bounding Boxes
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-slate-200">
                    FPS: 30 • 1080p
                  </span>
                </div>

                <CameraWidget
                  studentName={student.name}
                  faceVisible={student.faceVisible}
                  phoneDetected={student.phoneDetected}
                  bookDetected={student.bookDetected}
                  multiplePerson={student.multiplePerson}
                  status={student.status}
                  compact={false}
                  className="h-80"
                />
              </div>

              {/* Object Detection History & Head Pose Timelines */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                  MediaPipe & YOLO Computer Vision Timelines
                </h3>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 block mb-1">Head Pose Vector</span>
                    <span className="font-extrabold text-slate-900 text-sm">{student.headPose}</span>
                    <p className="text-[10px] text-slate-500 mt-1">Yaw: +12° | Pitch: -4° | Roll: 0°</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 block mb-1">Eye Gaze Tracking</span>
                    <span className="font-extrabold text-emerald-600 text-sm">{student.eyeGaze}</span>
                    <p className="text-[10px] text-slate-500 mt-1">Screen quadrant center match: 96%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Risk Graph & Incident Timeline */}
            <div className="lg:col-span-5 space-y-6">
              {/* Risk Graph (Recharts) */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center justify-between">
                  <span>Proctoring Risk Score Graph</span>
                  <span className="text-xs font-mono font-bold text-indigo-600">Peak: {student.riskScore}%</span>
                </h3>

                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} />
                      <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={10} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="risk"
                        stroke="#ef4444"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#ef4444' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Incident Timeline */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                  AI Incident Log & Timelines
                </h3>

                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {incidents.map((inc) => (
                    <div
                      key={inc.id}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 text-xs"
                    >
                      <div className="p-2 rounded-xl bg-rose-100 text-rose-700 shrink-0 mt-0.5">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{inc.type}</span>
                          <span className="text-[10px] font-mono text-slate-400">{inc.timestamp}</span>
                        </div>
                        <p className="text-slate-500 text-[11px] mt-0.5">{inc.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default StudentDetailPage;
