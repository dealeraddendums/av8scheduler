import { Calendar, dateFnsLocalizer, SlotInfo } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { forwardRef } from 'react';

const locales = {
  'en-US': enUS
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface Booking {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  startTime: string;
  endTime: string;
  title: string;
  notes?: string;
  isRequest?: boolean;
  acceptedBy?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Booking;
}

interface DayNote {
  id: string;
  date: string;
  note: string;
  blocksScheduling: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

interface AircraftCalendarProps {
  bookings: Booking[];
  dayNotes: DayNote[];
  onSelectSlot: (slotInfo: SlotInfo) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  timeFormat: '12h' | '24h';
}

export function AircraftCalendar({ bookings, dayNotes, onSelectSlot, onSelectEvent, timeFormat }: AircraftCalendarProps) {
  const events: CalendarEvent[] = bookings.map(booking => ({
    id: booking.id,
    title: `${booking.userName} - ${booking.title}`,
    start: new Date(booking.startTime),
    end: new Date(booking.endTime),
    resource: booking
  }));

  // Dynamic formats based on user preference
  const timeFormatString = timeFormat === '24h' ? 'HH:mm' : 'h:mm a';
  
  // Find note for a given date
  const getNoteForDate = (date: Date): DayNote | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return dayNotes.find(note => note.date === dateStr) || null;
  };

  // Create a custom dateHeader component with forwardRef
  const CustomDateHeader = forwardRef<HTMLDivElement, any>(({ date, label }, ref) => {
    const note = getNoteForDate(date);
    return (
      <div className="relative" ref={ref}>
        <span>{label}</span>
        {note && (
          <div 
            className="text-xs mt-1 px-1 py-0.5 rounded truncate"
            style={{
              backgroundColor: note.blocksScheduling ? '#fca5a5' : '#fcd34d',
              color: '#1f2937'
            }}
            title={note.note}
          >
            {note.blocksScheduling ? '🚫 ' : '📝 '}
            {note.note.length > 20 ? note.note.substring(0, 20) + '...' : note.note}
          </div>
        )}
      </div>
    );
  });

  CustomDateHeader.displayName = 'CustomDateHeader';
  
  const formats = {
    timeGutterFormat: (date: Date) => format(date, timeFormatString),
    eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) => 
      `${format(start, timeFormatString)} - ${format(end, timeFormatString)}`,
    agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${format(start, timeFormatString)} - ${format(end, timeFormatString)}`,
    dayHeaderFormat: (date: Date) => format(date, 'EEEE MMM dd'),
    dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${format(start, 'MMM dd')} - ${format(end, 'MMM dd')}`,
  };

  return (
    <div className="h-[600px] bg-white rounded-lg p-4 border">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        onSelectSlot={onSelectSlot}
        onSelectEvent={onSelectEvent}
        selectable
        defaultView="week"
        views={['month', 'week', 'day']}
        step={60}
        showMultiDayTimes
        formats={formats}
        min={new Date(1970, 0, 1, 6, 0, 0)}
        max={new Date(1970, 0, 1, 22, 0, 0)}
        eventPropGetter={(event) => {
          const isUnacceptedRequest = event.resource.isRequest && !event.resource.acceptedBy;
          return {
            style: {
              backgroundColor: event.resource.userColor,
              borderColor: event.resource.userColor,
              color: 'white',
              borderRadius: '4px',
              border: 'none',
              padding: '2px 6px',
            },
            className: isUnacceptedRequest ? 'request-event' : ''
          };
        }}
        dayPropGetter={(date) => {
          const note = getNoteForDate(date);
          const baseProps: any = {};
          
          if (note) {
            baseProps.style = {
              backgroundColor: note.blocksScheduling ? '#fee2e2' : '#fef3c7',
            };
          }
          
          return baseProps;
        }}
        components={{
          month: {
            dateHeader: CustomDateHeader
          }
        }}
      />
    </div>
  );
}