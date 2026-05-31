import { useEffect, useMemo, useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { MdAdd, MdEventNote } from 'react-icons/md';
import MeetingCalendar from '../components/MeetingCalendar';
import MeetingModal from '../components/MeetingModal';
import api from '../utils/api';

const toYmd = (dateObj) => format(dateObj, 'yyyy-MM-dd');

const parseMeetingDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();

  try {
    const iso = parseISO(s);
    if (isValid(iso)) return iso;
  } catch (_) {}

  try {
    const d = new Date(s.includes(' ') ? s.replace(' ', 'T') : s);
    if (!Number.isNaN(d.getTime())) return d;
  } catch (_) {}

  return null;
};

const sortMeetingsByTime = (list = []) => {
  return [...(Array.isArray(list) ? list : [])]
    .map((meeting) => ({ ...meeting, __dt: parseMeetingDate(meeting.meeting_date) }))
    .sort((a, b) => (a.__dt?.getTime() || 0) - (b.__dt?.getTime() || 0))
    .map(({ __dt, ...meeting }) => meeting);
};

export default function Calendar() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDateMeetings, setSelectedDateMeetings] = useState([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [scheduleContextLoading, setScheduleContextLoading] = useState(false);
  const [scheduleDateMeetings, setScheduleDateMeetings] = useState([]);
  const [scheduleFocusMeeting, setScheduleFocusMeeting] = useState(null);

  const selectedDateLabel = useMemo(() => format(selectedDate, 'EEEE, dd MMM yyyy'), [selectedDate]);

  const fetchMeetingsForDate = async (day, options = {}) => {
    const { updateState = true } = options;
    try {
      const response = await api.get('/meetings', {
        params: {
          date: toYmd(day),
          page: 1,
          limit: 500,
        },
      });
      const nextMeetings = response.data?.success && Array.isArray(response.data.data)
        ? sortMeetingsByTime(response.data.data)
        : [];
      if (updateState) setSelectedDateMeetings(nextMeetings);
      return nextMeetings;
    } catch (_) {
      if (updateState) setSelectedDateMeetings([]);
      return [];
    }
  };

  const fetchScheduleContextForDate = async (day, preloadedMeetings = null) => {
    const nextDay = day instanceof Date ? day : new Date(day);
    if (Number.isNaN(nextDay.getTime())) return;

    setScheduleContextLoading(true);
    try {
      const sameDayMeetingsPromise = Array.isArray(preloadedMeetings)
        ? Promise.resolve(sortMeetingsByTime(preloadedMeetings))
        : fetchMeetingsForDate(nextDay, { updateState: false });
      const sameDayMeetings = await sameDayMeetingsPromise;
      setScheduleDateMeetings(sameDayMeetings);
      setSelectedDateMeetings(sameDayMeetings);
    } catch (_) {
      const fallbackMeetings = Array.isArray(preloadedMeetings) ? sortMeetingsByTime(preloadedMeetings) : [];
      setScheduleDateMeetings(fallbackMeetings);
      setSelectedDateMeetings(fallbackMeetings);
    } finally {
      setScheduleContextLoading(false);
    }
  };

  const openScheduleModalForDate = async (day, preloadedMeetings = null, focusMeeting = null) => {
    const nextDay = day instanceof Date ? day : new Date(day);
    if (Number.isNaN(nextDay.getTime())) return;

    setSelectedDate(nextDay);
    setScheduleFocusMeeting(focusMeeting || null);
    setShowScheduleModal(true);
    await fetchScheduleContextForDate(nextDay, preloadedMeetings);
  };

  useEffect(() => {
    fetchMeetingsForDate(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDayClick = (day, dayMeetings = []) => {
    const nextDay = day instanceof Date ? day : new Date(day);
    if (Number.isNaN(nextDay.getTime())) return;

    setSelectedDate(nextDay);
    const sortedDayMeetings = sortMeetingsByTime(Array.isArray(dayMeetings) ? dayMeetings : []);
    setSelectedDateMeetings(sortedDayMeetings);
    openScheduleModalForDate(nextDay, sortedDayMeetings);
  };

  const handleMeetingClick = (meeting) => {
    const meetingDay = parseMeetingDate(meeting?.meeting_date);
    if (!meetingDay) return;
    openScheduleModalForDate(meetingDay, null, meeting);
  };

  const handleMeetingCreated = async () => {
    setShowScheduleModal(false);
    setCalendarRefreshKey((k) => k + 1);
    await fetchMeetingsForDate(selectedDate);
    setScheduleDateMeetings([]);
    setScheduleFocusMeeting(null);
  };

  const handleScheduleButtonClick = () => {
    openScheduleModalForDate(selectedDate, selectedDateMeetings, null);
  };

  const scheduleSeedData = useMemo(
    () => ({
      meeting_date: toYmd(selectedDate),
      meeting_time: '10:00',
      meeting_type: 'client_meeting',
    }),
    [selectedDate]
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-5 relative">
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-2xl shadow-lg p-4 sm:p-5 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '40px 40px',
            }}
          ></div>
        </div>

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-2xl border border-white/20">
                <MdEventNote className="text-white text-xl sm:text-2xl" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight">Meeting Calendar</h1>
                <p className="text-slate-300 text-xs sm:text-sm font-medium">Date-wise meetings + direct scheduling from calendar</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleScheduleButtonClick}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-800 font-bold text-sm hover:bg-slate-100 transition-all"
            >
              <MdAdd className="text-xl" />
              Schedule Meeting
            </button>
          </div>
        </div>
      </div>

      <div>
        <MeetingCalendar
          onMeetingClick={handleMeetingClick}
          onDayClick={handleDayClick}
          selectedDate={selectedDate}
          refreshKey={calendarRefreshKey}
          compact
        />
      </div>

      {showScheduleModal && (
        <MeetingModal
          initialData={scheduleSeedData}
          onClose={() => {
            setShowScheduleModal(false);
            setScheduleFocusMeeting(null);
          }}
          onSuccess={handleMeetingCreated}
          presentation="contained"
          contextDateLabel={selectedDateLabel}
          dateMeetings={scheduleDateMeetings}
          contextLoading={scheduleContextLoading}
          focusMeeting={scheduleFocusMeeting}
        />
      )}
    </div>
  );
}
