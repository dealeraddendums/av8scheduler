import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AircraftCalendar } from '../components/AircraftCalendar';
import { BookingDialog } from '../components/BookingDialog';
import { EventEditDialog } from '../components/EventEditDialog';
import { BookingsList } from '../components/BookingsList';
import { StatsCard } from '../components/StatsCard';
import { LoginDialog } from '../components/LoginDialog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Plane, Calendar as CalendarIcon, List, RefreshCw, Settings, LogOut, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { SlotInfo } from 'react-big-calendar';
import { getCookie, setCookie, deleteCookie } from '../utils/cookies';

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
      }
    };

    const handleFocus = () => {
      fetchUsers();
      fetchBookings();
      fetchDayNotes();
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

      // Fetch users, bookings, and day notes
      await Promise.all([fetchUsers(), fetchBookings(), fetchDayNotes()]);
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
    <div className="mottled-blue-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <span style={{ color: '#4E5166', fontWeight: 500, letterSpacing: '0.1em' }}>N4368V</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">N4368V Scheduler</h1>
                <p className="text-white">Shared aircraft scheduling for pilots</p>
              </div>
            </div>
            
            <div className="flex gap-2 items-center">
              {loggedInUser && (
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border-2 border-blue-200">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: loggedInUser.color }}
                  />
                  <UserIcon className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium">{loggedInUser.name}</span>
                </div>
              )}
              {!loggedInUser && (
                <Button 
                  onClick={() => setLoginDialogOpen(true)} 
                  variant="default" 
                  className="gap-2"
                >
                  <UserIcon className="w-4 h-4" />
                  Login
                </Button>
              )}
              {loggedInUser && (
                <>
                  <Link to="/settings">
                    <Button variant="outline" className="gap-2 h-10">
                      <Settings className="w-4 h-4" />
                      Settings
                    </Button>
                  </Link>
                  <Button 
                    onClick={handleLogout} 
                    variant="outline" 
                    className="gap-2 h-10 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-4 mt-4">
            {users.filter(user => user.userType !== 'spouse').map(user => (
              <div key={user.id} className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: user.color }}
                />
                <span className="text-sm font-medium">{user.name}</span>
              </div>
            ))}
          </div>
        </div>

        {loggedInUser && <StatsCard bookings={bookings} users={users} />}

        <Tabs defaultValue="calendar" className="space-y-4 mt-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="calendar" className="gap-2">
              <CalendarIcon className="w-4 h-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-2">
              <List className="w-4 h-4" />
              Bookings
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
        </Tabs>
      </div>

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