import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MonitorOff } from 'lucide-react';
import { RemoteCameraFeed } from './RemoteCameraFeed';
import { RiskBadge } from '../common/RiskBadge';
import { AIStatusChip } from '../common/AIStatusChip';

export const StudentLiveCard = ({ student }) => {
  const navigate = useNavigate();
  const finished = student.sessionStatus && student.sessionStatus !== 'IN_PROGRESS';

  return (
    <div
      onClick={() => navigate(`/admin/student-detail/${student.sessionId}`)}
      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:shadow-lg transition-all cursor-pointer group hover:border-indigo-300"
    >
      <RemoteCameraFeed sessionId={student.sessionId} size="small" live={!finished} endedText={finished ? 'Session ended' : undefined} />

      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{student.name}</h4>
          <p className="text-[11px] text-slate-500 font-mono truncate">{student.rollNumber}</p>
          <p className="text-[10px] text-slate-400 truncate">{student.examTitle}</p>
        </div>
        <RiskBadge status={student.status} riskScore={student.riskScore} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
        {finished ? (
          <span className="text-[11px] font-semibold text-slate-500">Session {student.sessionStatus.toLowerCase().replace('_', ' ')}</span>
        ) : (
          <>
            <AIStatusChip type="face" active={student.faceVisible} />
            {student.phoneDetected && <AIStatusChip type="phone" active />}
            {student.bookDetected && <AIStatusChip type="book" active />}
            {student.multiplePersons && <AIStatusChip type="persons" active />}
            {student.tabCurrentlyHidden && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs bg-amber-50 text-amber-800 border-amber-200">
                <MonitorOff className="w-3.5 h-3.5" /> Tab hidden
              </span>
            )}
            {!student.cvOnline && <span className="text-[10px] text-slate-400 self-center">AI feed offline</span>}
          </>
        )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-slate-500 font-medium">
        <span>Turns: {student.headTurnsCompleted}</span>
        <span>Tabs: {student.tabSwitchCount}</span>
        <span>Flags: {student.warningCount}</span>
      </div>

      {student.lastIncident && student.lastIncident !== 'None' && (
        <div className="mt-2 text-[10px] font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80 truncate">
          Last: {student.lastIncident}
        </div>
      )}
    </div>
  );
};
