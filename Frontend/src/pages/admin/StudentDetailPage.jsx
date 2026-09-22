import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ShieldAlert, Flag, FileText, ArrowLeft, Eye, Smartphone, BookOpen, Users, UserCheck } from 'lucide-react';
import { useProctoring } from '../../contexts/ProctoringContext';
import { CameraWidget } from '../../components/exam/CameraWidget';
import { RiskBadge } from '../../components/common/RiskBadge';
import { AIStatusChip } from '../../components/common/AIStatusChip';
import { IncidentTimeline } from '../../components/monitoring/IncidentTimeline';
import { MOCK_INCIDENT_TIMELINE, MOCK_RISK_GRAPH_DATA } from '../../constants/mockData';

export const StudentDetailPage = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { getStudentById, flagStudent } = useProctoring();

  const student = getStudentById(studentId);
  const [flaggedReason, setFlaggedReason] = useState('');
  const [isFlagged, setIsFlagged] = useState(false);

  const handleFlagCandidate = () => {
    flagStudent(student.id, flaggedReason || 'Manual Proctor Security Flag');
    setIsFlagged(true);
    alert(`Candidate ${student.name} has been manually flagged for security review.`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Top Nav Back */}
      <button
        onClick={() => navigate('/admin/live-monitoring')}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Live Grid
      </button>

      {/* Header Profile Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={student.avatar}
            alt={student.name}
            className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500 shadow-md"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900">{student.name}</h1>
              <RiskBadge status={student.status} riskScore={student.riskScore} />
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              PRN: <strong>{student.rollNumber}</strong> • Exam Code: <strong>AI2026CS01</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleFlagCandidate}
            disabled={isFlagged}
            className={`px-5 py-3 rounded-2xl text-xs font-extrabold shadow-md transition-all flex items-center gap-2 ${
              isFlagged ? 'bg-red-800 text-white' : 'bg-red-600 hover:bg-red-700 text-white shadow-red-200'
            }`}
          >
            <Flag className="w-4 h-4" />
            <span>{isFlagged ? 'Candidate Flagged' : 'Flag Candidate'}</span>
          </button>

          <button
            onClick={() => alert(`Detailed Audit PDF Report generated for ${student.name}.`)}
            className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-200 transition-all flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            <span>Generate Report</span>
          </button>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: Camera Feed & Analytics Charts */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Large Camera Feed Container */}
          <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Live Primary HD Camera Stream</span>
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
                Warning Count: {student.warningCount}
              </span>
            </div>

            <CameraWidget
              size="large"
              showOverlays={true}
              studentName={student.name}
              customState={student}
            />

            {/* AI Status Chips */}
            <div className="flex flex-wrap gap-2 pt-2">
              <AIStatusChip type="face" active={student.faceVisible} />
              <AIStatusChip type="phone" active={student.phoneDetected} />
              <AIStatusChip type="book" active={student.bookDetected} />
              <AIStatusChip type="persons" active={student.multiplePersons} />
              <AIStatusChip type="gaze" active={true} label={`Gaze: ${student.gazeDirection}`} />
            </div>
          </div>

          {/* Risk Score Graph (Recharts) */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Real-Time Risk Score & Gaze Deviation Graph</h3>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={MOCK_RISK_GRAPH_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="riskScore" stroke="#EF4444" strokeWidth={3} name="Risk Score %" />
                  <Line type="monotone" dataKey="headYaw" stroke="#4F46E5" strokeWidth={2} name="Head Yaw Angle °" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Head Pose & Eye Gaze Timelines */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Head Pose Vector</h4>
              <div className="text-xs text-slate-600 font-mono space-y-1">
                <div>Pitch (Up/Down): <strong>{student.headPose.pitch}°</strong></div>
                <div>Yaw (Left/Right): <strong>{student.headPose.yaw}°</strong></div>
                <div>Roll (Tilt): <strong>{student.headPose.roll}°</strong></div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Object Detection History</h4>
              <div className="text-xs text-slate-600 space-y-1 font-medium">
                <div>Smartphone Detections: <strong className="text-red-600">1 Event</strong></div>
                <div>Book/Notes Detections: <strong className="text-slate-700">0 Events</strong></div>
                <div>Secondary Persons: <strong className="text-red-600">1 Event</strong></div>
              </div>
            </div>
          </div>

        </div>

        {/* Right 1 Col: AI Incident Timeline */}
        <div className="space-y-6">
          <IncidentTimeline incidents={MOCK_INCIDENT_TIMELINE} />
        </div>

      </div>

    </div>
  );
};
