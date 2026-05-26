import { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Trash2, Plane, Filter, X, Plus } from 'lucide-react';
import { Badge } from './ui/badge';

interface Booking {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  startTime: string;
  endTime: string;
  title: string;
  notes?: string;
}

interface BookingsListProps {
  bookings: Booking[];
  onDeleteBooking: (bookingId: string) => void;
  onCreateBooking?: () => void;
}

export function BookingsList({ bookings, onDeleteBooking, onCreateBooking }: BookingsListProps) {
  const [selectedPilot, setSelectedPilot] = useState<string | null>(null);
  
  // Get unique pilots from bookings
  const pilots = Array.from(new Set(bookings.map(b => b.userId)))
    .map(userId => {
      const booking = bookings.find(b => b.userId === userId);
      return {
        id: userId,
        name: booking?.userName || 'Unknown',
        color: booking?.userColor || '#gray'
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  
  // Filter bookings by selected pilot
  const filteredBookings = selectedPilot
    ? bookings.filter(b => b.userId === selectedPilot)
    : bookings;
  
  const sortedBookings = [...filteredBookings].sort((a, b) => 
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const upcomingBookings = sortedBookings.filter(b => 
    new Date(b.startTime) >= new Date()
  );

  const pastBookings = sortedBookings.filter(b => 
    new Date(b.endTime) < new Date()
  );

  const renderBooking = (booking: Booking, isPast: boolean) => {
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10;

    return (
      <div 
        key={booking.id} 
        className={`p-4 border rounded-lg ${isPast ? 'opacity-60' : ''}`}
        style={{ borderLeftWidth: '4px', borderLeftColor: booking.userColor }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Plane className="w-4 h-4" />
              <h3 className="font-semibold">{booking.title}</h3>
            </div>
            
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <span 
                  className="w-3 h-3 rounded-full inline-block" 
                  style={{ backgroundColor: booking.userColor }}
                />
                <span className="font-medium">{booking.userName}</span>
              </div>
              
              <div>
                {format(start, 'MMM d, yyyy h:mm a')} - {format(end, 'h:mm a')}
              </div>
              
              <Badge variant="secondary" className="text-xs">
                {duration} hours
              </Badge>
            </div>

            {booking.notes && (
              <p className="text-sm text-muted-foreground mt-2 italic">
                {booking.notes}
              </p>
            )}
          </div>

          {!isPast && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onDeleteBooking(booking.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Pilot Filter */}
      {pilots.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-white">
            <Filter className="w-4 h-4" />
            <span className="font-medium">Filter by Pilot:</span>
          </div>
          
          <Button
            variant={selectedPilot === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedPilot(null)}
            className="gap-2"
          >
            All Pilots
            {selectedPilot === null && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                {bookings.length}
              </Badge>
            )}
          </Button>
          
          {pilots.map(pilot => (
            <Button
              key={pilot.id}
              variant={selectedPilot === pilot.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPilot(pilot.id)}
              className="gap-2"
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: pilot.color }}
              />
              {pilot.name}
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                {bookings.filter(b => b.userId === pilot.id).length}
              </Badge>
            </Button>
          ))}
          
          {selectedPilot && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedPilot(null)}
              className="gap-1 text-muted-foreground"
            >
              <X className="w-3 h-3" />
              Clear
            </Button>
          )}
        </div>
      )}
      
      {upcomingBookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Bookings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingBookings.map(booking => renderBooking(booking, false))}
          </CardContent>
        </Card>
      )}

      {pastBookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Past Bookings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pastBookings.slice(-5).reverse().map(booking => renderBooking(booking, true))}
          </CardContent>
        </Card>
      )}

      {filteredBookings.length === 0 && bookings.length > 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No bookings found for selected pilot.
          </CardContent>
        </Card>
      )}

      {bookings.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No bookings yet. Click on the calendar to schedule your first flight!
          </CardContent>
        </Card>
      )}

      {onCreateBooking && (
        <Button
          variant="default"
          size="sm"
          onClick={onCreateBooking}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Booking
        </Button>
      )}
    </div>
  );
}