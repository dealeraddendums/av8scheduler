import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AircraftCalendar } from '../components/AircraftCalendar';
import { BookingDialog } from '../components/BookingDialog';
import { EventEditDialog } from '../components/EventEditDialog';
import { BookingsList } from '../components/BookingsList';
import { LoginDialog } from '../components/LoginDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Calendar as CalendarIcon, List, RefreshCw, BookOpen } from 'lucide-react';
import { FlightLog } from '../components/FlightLog';
import type { FlightTotals } from '@av8/api';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { SlotInfo } from 'react-big-calendar';
import { getCookie, setCookie, deleteCookie } from '../utils/cookies';

const DESIGN_BORDER = '1px solid rgba(78,81,102,0.15)';

function statusOilColor(remaining: number | undefined): string {
  if (remaining === undefined) return '#1a1a2e';
  if (remaining < 10) return '#EF4444';
  if (remaining < 25) return '#F59E0B';
  return '#1a1a2e';
}

function statusAnnualColor(days: number | undefined): string {
  if (days === undefined) return '#1a1a2e';
  if (days < 30) return '#EF4444';
  if (days < 60) return '#F59E0B';
  return '#1a1a2e';
}

function daysUntilLocal(iso: string): number {
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return 0;
  const [y, m, d] = parts;
  const target = new Date(y, m - 1, d).getTime();
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((target - todayMidnight) / 86400000);
}

function monthYearLocal(iso: string): string {
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

interface User {
  id: string;
  name: string;
  email: string;
  color: string;
  phone?: string;
  secondaryPhones?: string[];
  smsNotifications?: boolean;
  pin?: string;
  timeFormat?: '12h' | '24h';
  userType?: 'pilot' | 'spouse';
  linkedPilotId?: string;
}

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
  requestedBy?: string;
  requestedByName?: string;
  acceptedBy?: string;
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

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-82b8c834`;

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dayNotes, setDayNotes] = useState<DayNote[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);
  const [flightTotals, setFlightTotals] = useState<FlightTotals | null>(null);
  // Visual-only pilot filter row (no downstream filter wired yet — keeps the
  // current behavior of showing everything; toggle state is purely cosmetic
  // pending a later hookup into calendar/bookings filtering).
  const [selectedPilots, setSelectedPilots] = useState<Set<string>>(new Set());

  // Load logged-in user from cookie on mount
  useEffect(() => {
    const savedUserId = getCookie('loggedInUserId');
    if (savedUserId) {
      setLoggedInUserId(savedUserId);
    }
  }, []);

  useEffect(() => {
    initializeApp();
  }, []);

  // Refresh data when page becomes visible (e.g., when returning from Settings)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUsers();
        fetchBookings();
        fetchDayNotes();
        fetchFlightTotals();
      }
    };

    const handleFocus = () => {
      fetchUsers();
      fetchBookings();
      fetchDayNotes();
      fetchFlightTotals();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize users
      const initResponse = await fetch(`${API_BASE}/init-users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!initResponse.ok) {
        throw new Error('Failed to initialize users');
      }

      // Fetch users, bookings, day notes, and flight totals in parallel
      await Promise.all([fetchUsers(), fetchBookings(), fetchDayNotes(), fetchFlightTotals()]);
      setLoading(false);
    } catch (error) {
      console.error('Error initializing app:', error);
      toast.error('Failed to initialize application');
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/users`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await fetch(`${API_BASE}/bookings`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }

      const data = await response.json();
      setBookings(data);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to fetch bookings');
    }
  };

  const fetchDayNotes = async () => {
    try {
      const response = await fetch(`${API_BASE}/day-notes`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch day notes');
      }

      const data = await response.json();
      setDayNotes(data);
    } catch (error) {
      console.error('Error fetching day notes:', error);
      toast.error('Failed to fetch day notes');
    }
  };

  const fetchFlightTotals = async () => {
    try {
      const response = await fetch(`${API_BASE}/flights/totals`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data && typeof data === 'object') setFlightTotals(data as FlightTotals);
    } catch (error) {
      console.error('Error fetching flight totals:', error);
    }
  };

  const handleCreateBooking = async (bookingData: {
    userId: string;
    userName: string;
    userColor: string;
    startTime: string;
    endTime: string;
    title: string;
    notes: string;
    isRequest?: boolean;
    requestedBy?: string;
    requestedByName?: string;
  }) => {
    try {
      const response = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bookingData)
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to create booking');
        return;
      }

      if (bookingData.isRequest) {
        toast.success('Booking request created! Other pilots can now accept this request.');
      } else {
        toast.success('Booking created successfully!');
      }
      await fetchBookings();
      
      // Attempt to sync with Google Calendar (silently fail if not connected)
      try {
        const syncResponse = await fetch(`${API_BASE}/google-calendar/sync-booking`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data.booking)
        });

        if (syncResponse.ok) {
          console.log('Booking synced to Google Calendar');
        }
      } catch (syncError) {
        // Silently fail if Google Calendar is not configured
        console.log('Google Calendar sync skipped:', syncError);
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error('Failed to create booking');
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    try {
      // Find the booking to get its Google Calendar event ID
      const booking = bookings.find(b => b.id === bookingId);
      
      const response = await fetch(`${API_BASE}/bookings/${encodeURIComponent(bookingId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete booking');
      }

      toast.success('Booking deleted successfully');
      await fetchBookings();
      
      // Attempt to delete from Google Calendar if event ID exists
      if (booking && (booking as any).googleCalendarEventId) {
        try {
          await fetch(`${API_BASE}/google-calendar/delete-event`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ eventId: (booking as any).googleCalendarEventId })
          });
          console.log('Event deleted from Google Calendar');
        } catch (syncError) {
          console.log('Google Calendar delete skipped:', syncError);
        }
      }
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast.error('Failed to delete booking');
    }
  };

  const handleSelectSlot = (slotInfo: SlotInfo) => {
    // Check if user is logged in
    if (!loggedInUserId) {
      setSelectedSlot({
        start: slotInfo.start as Date,
        end: slotInfo.end as Date
      });
      setLoginDialogOpen(true);
      return;
    }

    setSelectedSlot({
      start: slotInfo.start as Date,
      end: slotInfo.end as Date
    });
    setDialogOpen(true);
  };

  const handleCreateBookingFromList = () => {
    // Check if user is logged in
    if (!loggedInUserId) {
      setLoginDialogOpen(true);
      return;
    }

    // Clear selected slot so user can pick their own times
    setSelectedSlot(null);
    setDialogOpen(true);
  };

  const handleSelectEvent = (event: any) => {
    const booking = event.resource;
    setSelectedBooking(booking);
    setEditDialogOpen(true);
  };

  const handleUpdateBooking = async (bookingId: string, updates: Partial<Booking>) => {
    try {
      const response = await fetch(`${API_BASE}/bookings/${encodeURIComponent(bookingId)}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to update booking');
        return;
      }

      toast.success('Booking updated successfully');
      await fetchBookings();
    } catch (error) {
      console.error('Error updating booking:', error);
      toast.error('Failed to update booking');
    }
  };

  const handleAcceptRequest = async (bookingId: string) => {
    try {
      if (!loggedInUserId || !loggedInUser) {
        toast.error('You must be logged in to accept requests');
        return;
      }

      const response = await fetch(`${API_BASE}/bookings/${encodeURIComponent(bookingId)}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          acceptedBy: loggedInUserId,
          acceptedByName: loggedInUser.name,
          acceptedByColor: loggedInUser.color
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to accept booking request');
        return;
      }

      toast.success('Booking request accepted!');
      await fetchBookings();
    } catch (error) {
      console.error('Error accepting booking request:', error);
      toast.error('Failed to accept booking request');
    }
  };

  const handleLogin = (userId: string) => {
    setLoggedInUserId(userId);
    setCookie('loggedInUserId', userId);
  };

  const handleLogout = () => {
    setLoggedInUserId(null);
    deleteCookie('loggedInUserId');
    toast.success('Logged out successfully');
  };

  const loggedInUser = users.find(u => u.id === loggedInUserId);

  const pilotsForFilter = useMemo(
    () => users.filter(u => u.userType !== 'spouse'),
    [users]
  );

  // Seed the pilot-filter selection once users land. Defaults to all selected;
  // the row is visual-only for now and does not actually filter calendar or
  // bookings views.
  useEffect(() => {
    if (selectedPilots.size === 0 && pilotsForFilter.length > 0) {
      setSelectedPilots(new Set(pilotsForFilter.map(p => p.id)));
    }
  }, [pilotsForFilter, selectedPilots.size]);

  const now = new Date();
  const upcomingBookings = bookings.filter(b => new Date(b.startTime) >= now);

  const annualShortDate = flightTotals
    ? (() => {
        const p = flightTotals.annual_date.split('-').map(Number);
        if (p.length !== 3 || p.some(Number.isNaN)) return flightTotals.annual_date;
        return `${p[1]}/${p[2]}/${String(p[0]).slice(-2)}`;
      })()
    : '—';

  const annualDays = flightTotals ? daysUntilLocal(flightTotals.next_annual) : undefined;
  const oilTachRemaining = flightTotals?.oil_summary?.tach_remaining ?? flightTotals?.tach_remaining;
  const oilColor = statusOilColor(oilTachRemaining);
  const annualColor = statusAnnualColor(annualDays);
  const annualMonthYear = flightTotals ? monthYearLocal(flightTotals.next_annual) : '—';

  const topPilot = useMemo(() => {
    if (!flightTotals?.by_pilot || flightTotals.by_pilot.length === 0) return undefined;
    return [...flightTotals.by_pilot].sort((a, b) => b.hobbs - a.hobbs)[0];
  }, [flightTotals]);
  const topPilotColor = topPilot ? users.find(u => u.id === topPilot.pilot_id)?.color : undefined;

  if (loading) {
    return (
      <div className="size-full flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mottled-blue-background min-h-screen">
      {/* SECTION 1 — Top nav */}
      <header
        className="bg-white"
        style={{ borderBottom: DESIGN_BORDER, height: 52 }}
      >
        <div className="max-w-7xl mx-auto h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="px-2 py-1 bg-white"
              style={{ border: DESIGN_BORDER, borderRadius: 6 }}
            >
              <span style={{ color: '#4E5166', fontWeight: 700, letterSpacing: '0.1em', fontSize: 14 }}>N4368V</span>
            </div>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#1a1a2e' }}>N4368V</span>
          </div>

          <div className="flex items-center gap-3" style={{ fontSize: 14 }}>
            {loggedInUser ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block rounded-full"
                    style={{ width: 8, height: 8, backgroundColor: loggedInUser.color }}
                  />
                  <span style={{ color: '#1a1a2e' }}>{loggedInUser.name}</span>
                </div>
                <span style={{ color: 'rgba(78,81,102,0.25)' }}>|</span>
                <Link
                  to="/settings"
                  className="hover:text-[#4E5166]"
                  style={{ color: '#1a1a2e' }}
                >
                  Settings
                </Link>
                <span style={{ color: 'rgba(78,81,102,0.25)' }}>|</span>
                <button
                  onClick={handleLogout}
                  className="hover:underline"
                  style={{ color: '#b91c1c', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontSize: 14 }}
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={() => setLoginDialogOpen(true)}
                className="hover:text-[#4E5166]"
                style={{ color: '#1a1a2e', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontSize: 14 }}
              >
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      {/* SECTION 2 — Pilot filter row */}
      <div className="bg-white" style={{ borderBottom: DESIGN_BORDER }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <span style={{ fontSize: 12, color: '#6b7280' }}>Pilot</span>
          {pilotsForFilter.map(u => {
            const selected = selectedPilots.has(u.id);
            return (
              <button
                key={u.id}
                onClick={() => {
                  setSelectedPilots(prev => {
                    const next = new Set(prev);
                    if (next.has(u.id)) next.delete(u.id);
                    else next.add(u.id);
                    return next;
                  });
                }}
                style={{
                  fontSize: 13,
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: `1px solid ${selected ? '#4E5166' : 'rgba(78,81,102,0.15)'}`,
                  background: selected ? 'rgba(78,81,102,0.08)' : 'white',
                  color: '#1a1a2e',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <span
                  className="inline-block rounded-full"
                  style={{ width: 8, height: 8, backgroundColor: u.color }}
                />
                {u.name}
              </button>
            );
          })}
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-4">
        {/* SECTION 3 — Stats bar */}
        <div
          className="bg-white"
          style={{ border: DESIGN_BORDER, borderRadius: 10 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[rgba(78,81,102,0.15)]">
            {/* Stat 1 — Upcoming Flights */}
            <div style={{ padding: 16 }}>
              <p style={{ fontSize: 12, color: '#6b7280' }}>Upcoming Flights</p>
              <p style={{ fontSize: 24, fontWeight: 600, color: '#1a1a2e' }} className="tabular-nums">
                {upcomingBookings.length}
              </p>
              <p style={{ fontSize: 12, color: '#6b7280' }}>scheduled</p>
            </div>

            {/* Stat 2 — Since Annual (Hobbs/Tach, per-pilot breakdown, all-time) */}
            <div style={{ padding: 16 }}>
              <p style={{ fontSize: 12, color: '#6b7280' }}>Since Annual ({annualShortDate})</p>
              <p style={{ fontSize: 24, fontWeight: 600, color: '#1a1a2e' }} className="tabular-nums">
                {(flightTotals?.since_annual_hobbs ?? 0).toFixed(1)} Hobbs · {(flightTotals?.since_annual_tach ?? 0).toFixed(1)} Tach
              </p>
              {flightTotals && flightTotals.by_pilot.length > 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: '#6b7280',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 2,
                  }}
                  className="tabular-nums"
                >
                  {flightTotals.by_pilot.map((p, i) => (
                    <span
                      key={p.pilot_id}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      {i > 0 && (
                        <span style={{ color: 'rgba(78,81,102,0.25)', marginRight: 4 }}>|</span>
                      )}
                      <span
                        className="inline-block rounded-full"
                        style={{
                          width: 8,
                          height: 8,
                          backgroundColor:
                            users.find((u) => u.id === p.pilot_id)?.color ?? '#7C90A0',
                        }}
                      />
                      <span style={{ color: '#1a1a2e' }}>{p.pilot_name}</span>
                      <span>H {p.hobbs.toFixed(1)} · T {p.tach.toFixed(1)}</span>
                    </span>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 12, color: '#6b7280' }} className="tabular-nums">
                All time: {(flightTotals?.total_hobbs ?? 0).toFixed(1)} Hobbs · {(flightTotals?.total_tach ?? 0).toFixed(1)} Tach
              </p>
            </div>

            {/* Stat 3 — Aircraft Status (Oil / Annual) */}
            <div style={{ padding: 16 }}>
              <p style={{ fontSize: 12, color: '#6b7280' }}>Oil / Annual</p>
              <p style={{ fontSize: 24, fontWeight: 600 }} className="tabular-nums">
                <span style={{ color: oilColor }}>
                  {oilTachRemaining !== undefined ? `${oilTachRemaining.toFixed(1)} hrs` : '—'}
                </span>
                <span style={{ color: '#6b7280' }}> · </span>
                <span style={{ color: annualColor }}>
                  {annualDays !== undefined ? `${annualDays} days` : '—'}
                </span>
              </p>
              {flightTotals?.oil_summary && (
                <p style={{ fontSize: 12, color: '#6b7280' }} className="tabular-nums">
                  {flightTotals.oil_summary.quarts_added_since_change.toFixed(1)} qt added ·{' '}
                  {flightTotals.oil_summary.flights_since_change}{' '}
                  {flightTotals.oil_summary.flights_since_change === 1 ? 'flight' : 'flights'} since change
                </p>
              )}
              <p style={{ fontSize: 12, color: '#6b7280' }}>
                {flightTotals
                  ? `Tach ${flightTotals.current_tach.toFixed(1)} · Next annual ${annualMonthYear}`
                  : 'Tach — · Next annual —'}
              </p>
            </div>

            {/* Stat 4 — Top Pilot */}
            <div style={{ padding: 16 }}>
              <p style={{ fontSize: 12, color: '#6b7280' }}>Top Pilot</p>
              <p
                style={{ fontSize: 24, fontWeight: 600, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {topPilot && (
                  <span
                    className="inline-block rounded-full"
                    style={{ width: 8, height: 8, backgroundColor: topPilotColor ?? '#7C90A0' }}
                  />
                )}
                {topPilot?.pilot_name ?? '—'}
              </p>
              <p style={{ fontSize: 12, color: '#6b7280' }} className="tabular-nums">
                {(topPilot?.hobbs ?? 0).toFixed(1)} hrs · {topPilot?.count ?? 0} flights
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="calendar" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="calendar" className="gap-2">
              <CalendarIcon className="w-4 h-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-2">
              <List className="w-4 h-4" />
              Bookings
            </TabsTrigger>
            <TabsTrigger value="log" className="gap-2">
              <BookOpen className="w-4 h-4" />
              Flight Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Schedule View</CardTitle>
                    <CardDescription>
                      Click on any time slot to create a new booking. Select "Maintenance" or "Note" from pilot dropdown for special entries.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <AircraftCalendar
                  key={loggedInUserId || 'logged-out'}
                  bookings={bookings}
                  dayNotes={dayNotes}
                  onSelectSlot={handleSelectSlot}
                  onSelectEvent={handleSelectEvent}
                  timeFormat={users.find(u => u.id === loggedInUserId)?.timeFormat || '12h'}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="list">
            <BookingsList
              bookings={bookings}
              onDeleteBooking={handleDeleteBooking}
              onCreateBooking={handleCreateBookingFromList}
            />
          </TabsContent>

          <TabsContent value="log">
            <FlightLog
              users={users}
              loggedInUser={loggedInUser}
              onRequestLogin={() => setLoginDialogOpen(true)}
            />
          </TabsContent>
        </Tabs>
      </main>

      <BookingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        users={users.filter(u => u.userType !== 'spouse')}
        onCreateBooking={handleCreateBooking}
        selectedSlot={selectedSlot}
        loggedInUser={loggedInUser}
      />

      <EventEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        booking={selectedBooking}
        onUpdateBooking={handleUpdateBooking}
        onDeleteBooking={handleDeleteBooking}
        onAcceptRequest={handleAcceptRequest}
        loggedInUserId={loggedInUserId}
        users={users}
      />

      <LoginDialog
        open={loginDialogOpen}
        onOpenChange={setLoginDialogOpen}
        users={users}
        onLogin={handleLogin}
      />
    </div>
  );
}