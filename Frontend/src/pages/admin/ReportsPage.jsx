import React, { useState, useEffect } from 'react';
import { Download, FileText, BarChart2, Eye, ShieldAlert, Award, Users } from 'lucide-react';
import { reportApi } from '../../api/reportApi';
import { errorMessage } from '../../api/client';
import { SessionReportModal } from '../../components/monitoring/SessionReportModal';

export const ReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeModalReport, setActiveModalReport] = useState(null);
  const [roster, setRoster] = useState(null);
  const [sessionReport, setSessionReport] = useState(null);

  const openExam = async (rep) => {
    setActiveModalReport(rep);
    setRoster(null);
    try {
      const full = await reportApi.getReport(rep.id);
      setRoster(full.roster);
    } catch (err) {
      setRoster([]);
      setError(errorMessage(err));
    }
  };

  useEffect(() => {
    reportApi
      .getReports()
      .then((data) => setReports(Array.isArray(data) ? data : []))
      .catch((err) => setError(errorMessage(err, 'Could not load reports')))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (id, name) => {
    try {
      const blob = await reportApi.downloadReportCSV(id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name.replace(/[^A-Za-z0-9]+/g, '_')}_report.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err, 'Download failed'));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Examination Reports & Analytics</h1>
          <p className="text-xs text-slate-500 font-medium">Review candidate performance and AI proctoring integrity metrics</p>
        </div>

        <button
          onClick={() => handleDownload('all', 'All Examinations')}
          className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-200 transition-all flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          <span>Export All Reports</span>
        </button>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">{error}</div>}
      {!loading && reports.length === 0 && !error && (
        <div className="p-6 rounded-2xl bg-white border border-dashed border-slate-300 text-sm text-slate-500 text-center">No exams yet -- reports appear once you create an exam.</div>
      )}

      {/* Reports Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <th className="py-4 px-6">Exam Name</th>
              <th className="py-4 px-6">Code</th>
              <th className="py-4 px-6 text-center">Students</th>
              <th className="py-4 px-6 text-center">Average Score</th>
              <th className="py-4 px-6 text-center">Avg Suspicion (S)</th>
              <th className="py-4 px-6 text-center">Suspicious</th>
              <th className="py-4 px-6 text-center">Completion Rate</th>
              <th className="py-4 px-6 text-right">Download</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-semibold">
            {reports.map((rep) => (
              <tr
                key={rep.id}
                onClick={() => openExam(rep)}
                className="hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <td className="py-4 px-6 text-slate-900 font-bold">{rep.examName}</td>
                <td className="py-4 px-6 font-mono text-indigo-600 font-bold">{rep.code}</td>
                <td className="py-4 px-6 text-center text-slate-700">{rep.students}</td>
                <td className="py-4 px-6 text-center text-emerald-700 font-bold">{rep.avgScore}</td>
                <td className="py-4 px-6 text-center text-amber-700 font-bold">{rep.avgRiskScore}</td>
                <td className="py-4 px-6 text-center text-red-700 font-bold">{rep.suspiciousCandidates}</td>
                <td className="py-4 px-6 text-center text-slate-700">{rep.completionRate}</td>
                <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleDownload(rep.id, rep.examName)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 text-indigo-700 font-bold text-xs border border-slate-200 transition-colors flex items-center gap-1.5 ml-auto"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Analytics Modal View */}
      {activeModalReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-8 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">

            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700">
                  {activeModalReport.code}
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-1">{activeModalReport.examName}</h3>
              </div>
              <button
                onClick={() => setActiveModalReport(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            {/* Metrics Breakdown Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-center">
                <Users className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                <div className="text-xs text-slate-500 font-medium">Examinees</div>
                <div className="text-xl font-extrabold text-indigo-950 mt-0.5">{activeModalReport.students}</div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
                <Award className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <div className="text-xs text-slate-500 font-medium">Average Score</div>
                <div className="text-xl font-extrabold text-emerald-950 mt-0.5">{activeModalReport.avgScore}</div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-center">
                <ShieldAlert className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <div className="text-xs text-slate-500 font-medium">Avg Suspicion (S)</div>
                <div className="text-xl font-extrabold text-amber-950 mt-0.5">{activeModalReport.avgRiskScore}</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <BarChart2 className="w-5 h-5 text-slate-600 mx-auto mb-1" />
                <div className="text-xs text-slate-500 font-medium">Completion</div>
                <div className="text-xl font-extrabold text-slate-900 mt-0.5">{activeModalReport.completionRate}</div>
              </div>
            </div>

            {/* Candidate roster */}
            <div className="space-y-2">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Candidates ({activeModalReport.incidentsFlagged} high-severity events • {activeModalReport.suspiciousCandidates} suspicious)
              </div>
              {!roster ? (
                <p className="text-xs text-slate-500">Loading roster...</p>
              ) : roster.length === 0 ? (
                <p className="text-xs text-slate-500">No attempts yet.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b">
                      <th className="py-1">Candidate</th>
                      <th>Status</th>
                      <th>Score</th>
                      <th>S</th>
                      <th>Official</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((r) => (
                      <tr key={r.sessionId} className="border-b border-slate-100">
                        <td className="py-1.5 font-semibold">
                          {r.name} <span className="text-slate-400 font-mono">{r.rollNumber}</span>
                        </td>
                        <td>{r.status}</td>
                        <td>{r.percentage != null ? `${r.percentage}%` : '—'}</td>
                        <td className={r.isSuspicious ? 'text-red-700 font-bold' : ''}>{r.suspicionScore}</td>
                        <td>{r.officialStatus}</td>
                        <td>
                          <button onClick={() => setSessionReport(r.sessionId)} className="text-indigo-600 font-bold hover:underline">
                            Report
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => handleDownload(activeModalReport.id, activeModalReport.examName)}
                className="px-6 py-3 rounded-2xl bg-indigo-600 text-white font-extrabold text-xs shadow-md shadow-indigo-200 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download CSV</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {sessionReport && <SessionReportModal sessionId={sessionReport} onClose={() => setSessionReport(null)} />}
    </div>
  );
};
