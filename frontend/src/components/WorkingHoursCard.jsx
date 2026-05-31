import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../utils/api';
import { getEmployee } from '../utils/auth';

const DAILY_GOAL_SECONDS = 8 * 60 * 60;
const STORAGE_KEY = 'attendance.working_hours.summary.v1';

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatSeconds(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function getGreetingLabel() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

async function captureLocation() {
  if (!navigator.geolocation) return { location: 'Office' };

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position.coords.latitude || 0).toFixed(5);
        const longitude = Number(position.coords.longitude || 0).toFixed(5);
        resolve({
          location: `Lat ${latitude}, Lng ${longitude}`,
          latitude,
          longitude,
        });
      },
      () => resolve({ location: 'Office' }),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  });
}

export default function WorkingHoursCard({ className = '', onUpdated, showActions = true, refreshKey }) {
  const employee = getEmployee();
  const storageKey = `${STORAGE_KEY}.${employee?.id || employee?.email || 'anonymous'}`;
  const [summary, setSummary] = useState(() => {
    try {
      const cached = localStorage.getItem(storageKey);
      return cached ? JSON.parse(cached) : null;
    } catch (_) {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [tick, setTick] = useState(Date.now());
  const runtimeRef = useRef({
    sessionKey: '',
    baseWorked: 0,
    baseBreak: 0,
    baseAtMs: Date.now(),
  });
  const liveRef = useRef({
    sessionKey: '',
    worked: 0,
    breakTime: 0,
    total: 0,
  });
  const pendingCounterResetRef = useRef(false);

  const refreshSummary = useCallback(async ({ allowCounterReset = false } = {}) => {
    try {
      setError('');
      const response = await api.get('/checkin/today');
      if (response.data?.success) {
        const acceptCounterReset = allowCounterReset || pendingCounterResetRef.current;
        const next = {
          ...response.data.data,
          _fetchedAt: Date.now(),
          _serverTimeMs: Number(response.data.data?.server_time_ms) || Date.now(),
        };
        setSummary((prev) => {
          const nextAttendance = next?.attendance;
          const nextSessionKey = nextAttendance
            ? `${nextAttendance.id || 'na'}|${nextAttendance.check_in_time || ''}`
            : '';
          const live = liveRef.current;
          if (acceptCounterReset && nextAttendance) {
            const resetWorked = Number(nextAttendance.worked_seconds) || 0;
            const resetBreak = Number(nextAttendance.break_seconds) || 0;
            runtimeRef.current = {
              sessionKey: nextSessionKey,
              baseWorked: resetWorked,
              baseBreak: resetBreak,
              baseAtMs: Number(next._serverTimeMs) || Date.now(),
            };
            liveRef.current = {
              sessionKey: nextSessionKey,
              worked: resetWorked,
              breakTime: resetBreak,
              total: resetWorked + resetBreak,
            };
          }
          if (!acceptCounterReset && nextAttendance && live.sessionKey && live.sessionKey === nextSessionKey) {
            const nextWorked = Number(nextAttendance.worked_seconds) || 0;
            const nextBreak = Number(nextAttendance.break_seconds) || 0;
            const nextTotal = nextWorked + nextBreak;
            if (live.total > nextTotal) {
              next.attendance = {
                ...nextAttendance,
                worked_seconds: Math.max(nextWorked, live.worked),
                break_seconds: Math.max(nextBreak, live.breakTime),
              };
            }
          }
          const activeStatuses = new Set(['checked_in', 'on_break']);
          if (!acceptCounterReset && prev?.attendance && next?.attendance) {
            const prevStatus = prev.attendance.status;
            const nextStatus = next.attendance.status;
            if (activeStatuses.has(prevStatus) && activeStatuses.has(nextStatus)) {
              const prevWorked = Number(prev.attendance.worked_seconds) || 0;
              const nextWorked = Number(next.attendance.worked_seconds) || 0;
              const prevBreak = Number(prev.attendance.break_seconds) || 0;
              const nextBreak = Number(next.attendance.break_seconds) || 0;
              // Guard against server responses that reset counters (e.g., stale rows)
              if (nextWorked + nextBreak < prevWorked + prevBreak) {
                next.attendance = {
                  ...next.attendance,
                  worked_seconds: Math.max(nextWorked, prevWorked),
                  break_seconds: Math.max(nextBreak, prevBreak),
                };
              }
            }
          }
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch (_) {}
          if (onUpdated) onUpdated(next);
          return next;
        });
        if (acceptCounterReset) pendingCounterResetRef.current = false;
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load working timer');
    } finally {
      setLoading(false);
    }
  }, [onUpdated, storageKey]);

  useEffect(() => {
    refreshSummary();
    const secondTimer = setInterval(() => setTick(Date.now()), 1000);
    const syncTimer = setInterval(refreshSummary, 60000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshSummary();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(secondTimer);
      clearInterval(syncTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshSummary, refreshKey]);

  useEffect(() => {
    const attendance = summary?.attendance;
    if (!attendance) {
      runtimeRef.current = {
        sessionKey: '',
        baseWorked: 0,
        baseBreak: 0,
        baseAtMs: Date.now(),
      };
      return;
    }

    const sessionKey = `${attendance.id || 'na'}|${attendance.check_in_time || ''}`;
    const serverAtMs = Number(summary?._serverTimeMs) || Date.now();
    const nextWorked = Number(attendance.worked_seconds) || 0;
    const nextBreak = Number(attendance.break_seconds) || 0;

    const prev = runtimeRef.current;
    const prevTotal = (prev.baseWorked || 0) + (prev.baseBreak || 0);
    const nextTotal = nextWorked + nextBreak;

    if (prev.sessionKey !== sessionKey) {
      runtimeRef.current = {
        sessionKey,
        baseWorked: nextWorked,
        baseBreak: nextBreak,
        baseAtMs: serverAtMs,
      };
      return;
    }

    if (nextTotal >= prevTotal) {
      runtimeRef.current = {
        ...prev,
        baseWorked: nextWorked,
        baseBreak: nextBreak,
        baseAtMs: serverAtMs,
      };
    }
  }, [summary]);

  const liveAttendance = useMemo(() => {
    const attendance = summary?.attendance;
    if (!attendance) {
      liveRef.current = { sessionKey: '', worked: 0, breakTime: 0, total: 0 };
      return {
        status: 'pending',
        worked_seconds: 0,
        break_seconds: 0,
        overtime_seconds: 0,
        remaining_seconds: DAILY_GOAL_SECONDS,
        progress_percent: 0,
        can_clock_in: true,
        can_start_break: false,
        can_resume: false,
        can_clock_out: false,
        can_reset_timer: false,
      };
    }

    const fetchedAt = Number(summary?._fetchedAt) || Date.now();
    const serverTimeAtFetch = Number(summary?._serverTimeMs) || fetchedAt;
    const serverOffsetMs = serverTimeAtFetch - fetchedAt;
    const serverNowMs = tick + serverOffsetMs;

    const runtime = runtimeRef.current;
    const elapsed = Math.max(0, Math.floor((serverNowMs - (runtime.baseAtMs || serverTimeAtFetch)) / 1000));
    let workedSeconds = Number(runtime.baseWorked) || 0;
    let breakSeconds = Number(runtime.baseBreak) || 0;
    const targetSeconds = Number(attendance.target_seconds) || DAILY_GOAL_SECONDS;

    if (attendance.status === 'checked_in') {
      workedSeconds += elapsed;
    } else if (attendance.status === 'on_break') {
      breakSeconds += elapsed;
    } else if (attendance.status === 'completed' || attendance.status === 'checked_out') {
      // After punch-out, use the exact server values — do NOT add elapsed time
      workedSeconds = Number(attendance.worked_seconds) || 0;
      breakSeconds = Number(attendance.break_seconds) || 0;
    }

    const overtimeSeconds = Math.max(0, workedSeconds - targetSeconds);
    const remainingSeconds = Math.max(0, targetSeconds - workedSeconds);
    const progressPercent = targetSeconds > 0 ? Math.min(100, Math.round((workedSeconds / targetSeconds) * 100)) : 0;

    const sessionKey = `${attendance.id || 'na'}|${attendance.check_in_time || ''}`;
    liveRef.current = {
      sessionKey,
      worked: workedSeconds,
      breakTime: breakSeconds,
      total: workedSeconds + breakSeconds,
    };

    return {
      ...attendance,
      worked_seconds: workedSeconds,
      break_seconds: breakSeconds,
      overtime_seconds: overtimeSeconds,
      remaining_seconds: remainingSeconds,
      progress_percent: progressPercent,
      can_clock_in: attendance.can_clock_in,
      can_start_break: attendance.can_start_break,
      can_resume: attendance.can_resume,
      can_clock_out: attendance.can_clock_out,
      can_reset_timer: attendance.can_reset_timer,
    };
  }, [summary, tick]);

  const statusTone = {
    pending: 'bg-slate-100 text-slate-700',
    checked_in: 'bg-emerald-100 text-emerald-700',
    on_break: 'bg-amber-100 text-amber-700',
    completed: 'bg-blue-100 text-blue-700',
    checked_out: 'bg-blue-100 text-blue-700',
  };

  const handleAction = async (action) => {
    try {
      if (action === 'resetTimer') {
        const ok = window.confirm('Reset timer now? Worked and break time for current session will restart from 00:00:00.');
        if (!ok) return;
      }
      setActionLoading(action);
      setError('');
      const payload = await captureLocation();
      const endpointMap = {
        clockIn: '/checkin/clock-in',
        startBreak: '/checkin/start-break',
        endBreak: '/checkin/end-break',
        clockOut: '/checkin/clock-out',
        resetTimer: '/checkin/reset-timer',
      };
      await api.post(endpointMap[action], payload);
      const needsCounterReset = action === 'resetTimer' || action === 'clockOut' || action === 'clockIn';
      if (needsCounterReset) pendingCounterResetRef.current = true;
      await refreshSummary({ allowCounterReset: needsCounterReset });
    } catch (err) {
      setError(err.response?.data?.message || 'Attendance action failed');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className={`bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden ${className}`}>
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-slate-300 text-sm font-medium">{getGreetingLabel()}, {employee?.name || 'User'}</p>
            <h2 className="text-2xl font-bold text-white">Daily Working Hours</h2>
          </div>
          <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusTone[liveAttendance.status] || statusTone.pending}`}>
            {liveAttendance.status === 'checked_in' && 'Working'}
            {liveAttendance.status === 'on_break' && 'On Break'}
            {(liveAttendance.status === 'completed' || liveAttendance.status === 'checked_out') && 'Completed'}
            {liveAttendance.status === 'pending' && 'Not Started'}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Daily Goal</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{formatSeconds(summary?.goal_seconds || DAILY_GOAL_SECONDS)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-100">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">Worked</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{formatSeconds(liveAttendance.worked_seconds)}</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-4 border border-amber-100">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-600">Remaining</p>
            <p className="mt-2 text-2xl font-bold text-amber-700">{formatSeconds(liveAttendance.remaining_seconds)}</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-4 border border-blue-100">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Overtime</p>
            <p className="mt-2 text-2xl font-bold text-blue-700">{formatSeconds(liveAttendance.overtime_seconds)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Progress</p>
            <p className="text-sm font-bold text-slate-900">
              {formatSeconds(liveAttendance.worked_seconds)} / {formatSeconds(summary?.goal_seconds || DAILY_GOAL_SECONDS)}
            </p>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-600 transition-all duration-500"
              style={{ width: `${liveAttendance.progress_percent}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-6 text-sm text-slate-600">
            <span>Break: <strong className="text-slate-900">{formatSeconds(liveAttendance.break_seconds)}</strong></span>
            <span>Punch In: <strong className="text-slate-900">{liveAttendance.check_in_time || '--:--:--'}</strong></span>
            <span>Punch Out: <strong className="text-slate-900">{liveAttendance.check_out_time || '--:--:--'}</strong></span>
          </div>
        </div>

        {showActions && (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleAction('clockIn')}
              disabled={loading || actionLoading || !liveAttendance.can_clock_in}
              className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionLoading === 'clockIn' ? 'Punching In...' : 'Punch In'}
            </button>
            <button
              type="button"
              onClick={() => handleAction('startBreak')}
              disabled={loading || actionLoading || !liveAttendance.can_start_break}
              className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionLoading === 'startBreak' ? 'Starting Break...' : 'Break'}
            </button>
            <button
              type="button"
              onClick={() => handleAction('endBreak')}
              disabled={loading || actionLoading || !liveAttendance.can_resume}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionLoading === 'endBreak' ? 'Resuming...' : 'Resume'}
            </button>
            <button
              type="button"
              onClick={() => handleAction('clockOut')}
              disabled={loading || actionLoading || !liveAttendance.can_clock_out}
              className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionLoading === 'clockOut' ? 'Punching Out...' : 'Punch Out'}
            </button>
            <button
              type="button"
              onClick={() => handleAction('resetTimer')}
              disabled={loading || actionLoading || !liveAttendance.can_reset_timer}
              className="rounded-xl bg-slate-700 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionLoading === 'resetTimer' ? 'Resetting...' : 'Reset Timer'}
            </button>
          </div>
        )}

        {loading && (
          <p className="text-sm text-slate-500">Loading working session...</p>
        )}
      </div>
    </div>
  );
}
