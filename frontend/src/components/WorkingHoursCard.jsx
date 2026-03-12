import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { getEmployee } from '../utils/auth';

const DAILY_GOAL_SECONDS = 8 * 60 * 60;

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
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [tick, setTick] = useState(Date.now());

  const refreshSummary = useCallback(async () => {
    try {
      setError('');
      const response = await api.get('/checkin/today');
      if (response.data?.success) {
        setSummary({
          ...response.data.data,
          _fetchedAt: Date.now(),
        });
        if (onUpdated) onUpdated(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load working timer');
    } finally {
      setLoading(false);
    }
  }, [onUpdated]);

  useEffect(() => {
    refreshSummary();
    const secondTimer = setInterval(() => setTick(Date.now()), 1000);
    const syncTimer = setInterval(refreshSummary, 60000);
    return () => {
      clearInterval(secondTimer);
      clearInterval(syncTimer);
    };
  }, [refreshSummary, refreshKey]);

  const liveAttendance = useMemo(() => {
    const attendance = summary?.attendance;
    if (!attendance) {
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
      };
    }

    const fetchedAt = Number(summary?._fetchedAt) || Date.now();
    const elapsed = Math.max(0, Math.floor((tick - fetchedAt) / 1000));
    let workedSeconds = Number(attendance.worked_seconds) || 0;
    let breakSeconds = Number(attendance.break_seconds) || 0;
    const targetSeconds = Number(attendance.target_seconds) || DAILY_GOAL_SECONDS;

    if (attendance.status === 'checked_in') {
      workedSeconds += elapsed;
    } else if (attendance.status === 'on_break') {
      breakSeconds += elapsed;
    }

    const overtimeSeconds = Math.max(0, workedSeconds - targetSeconds);
    const remainingSeconds = Math.max(0, targetSeconds - workedSeconds);
    const progressPercent = targetSeconds > 0 ? Math.min(100, Math.round((workedSeconds / targetSeconds) * 100)) : 0;

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
      setActionLoading(action);
      setError('');
      const payload = await captureLocation();
      const endpointMap = {
        clockIn: '/checkin/clock-in',
        startBreak: '/checkin/start-break',
        endBreak: '/checkin/end-break',
        clockOut: '/checkin/clock-out',
      };
      await api.post(endpointMap[action], payload);
      await refreshSummary();
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
            <span>Check In: <strong className="text-slate-900">{liveAttendance.check_in_time || '--:--:--'}</strong></span>
            <span>Check Out: <strong className="text-slate-900">{liveAttendance.check_out_time || '--:--:--'}</strong></span>
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
              {actionLoading === 'clockIn' ? 'Clocking In...' : 'Clock In'}
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
              {actionLoading === 'clockOut' ? 'Clocking Out...' : 'Clock Out'}
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
