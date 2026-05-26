import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from './ui/select';
import { Wrench, StickyNote, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface User {
  id: string;
  name: string;
  email: string;
  color: string;
  userType?: 'pilot' | 'spouse';
  linkedPilotId?: string;
}

interface BookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  onCreateBooking: (booking: {
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
  }) => void;
  selectedSlot?: { start: Date; end: Date } | null;
  loggedInUser?: User | null;
}

export function BookingDialog({ 
  open, 
  onOpenChange, 
  users, 
  onCreateBooking,
  selectedSlot,
  loggedInUser
}: BookingDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Get the pilot ID - either logged in user if they're a pilot, or their linked pilot if spouse
  const effectivePilotId = loggedInUser?.userType === 'spouse' ? loggedInUser.linkedPilotId : loggedInUser?.id;

  // Auto-select the appropriate pilot when dialog opens
  useEffect(() => {
    if (open && effectivePilotId) {
      setSelectedUserId(effectivePilotId);
    }
  }, [open, effectivePilotId]);

  // Update times when slot is selected
  useEffect(() => {
    if (selectedSlot) {
      setStartTime(formatDateTimeLocal(selectedSlot.start));
      setEndTime(formatDateTimeLocal(selectedSlot.end));
    }
  }, [selectedSlot]);

  const formatDateTimeLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that end time is after start time
    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      if (end <= start) {
        toast.error('End time must be after start time');
        return;
      }
    }
    
    let userName = '';
    let userColor = '';
    let isRequest = false;
    
    // Handle special cases
    if (selectedUserId === 'maintenance') {
      userName = 'Maintenance';
      userColor = '#ef4444'; // red-500
    } else if (selectedUserId === 'note') {
      userName = 'Note';
      userColor = '#eab308'; // yellow-500
    } else if (selectedUserId === 'request') {
      // For pilot request, use the logged-in user's info as the requester
      const requesterUser = users.find(u => u.id === effectivePilotId);
      if (!requesterUser || !startTime || !endTime) return;
      userName = requesterUser.name;
      userColor = requesterUser.color;
      isRequest = true;
    } else {
      const selectedUser = users.find(u => u.id === selectedUserId);
      if (!selectedUser || !startTime || !endTime) return;
      userName = selectedUser.name;
      userColor = selectedUser.color;
    }
    
    if (!startTime || !endTime) return;

    const bookingData: any = {
      userId: isRequest ? effectivePilotId : selectedUserId,
      userName: userName,
      userColor: userColor,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      title: title || (selectedUserId === 'maintenance' ? 'Aircraft Maintenance' : selectedUserId === 'note' ? 'Reminder' : selectedUserId === 'request' ? 'Flight Request' : 'Aircraft Reservation'),
      notes
    };

    // Add request fields if this is a request
    if (isRequest) {
      bookingData.isRequest = true;
      bookingData.requestedBy = loggedInUser?.id;
      bookingData.requestedByName = loggedInUser?.name;
    }

    onCreateBooking(bookingData);

    // Reset form
    setSelectedUserId('');
    setTitle('');
    setNotes('');
    setStartTime('');
    setEndTime('');
    onOpenChange(false);
  };

  // Get the pilot that the logged-in user can book for (themselves or their linked pilot)
  // The users array passed in is already filtered to exclude spouses, so just find by ID
  const availablePilot = users.find(u => u.id === effectivePilotId);

  console.log('BookingDialog - loggedInUser:', loggedInUser);
  console.log('BookingDialog - effectivePilotId:', effectivePilotId);
  console.log('BookingDialog - availablePilot:', availablePilot);
  console.log('BookingDialog - users array:', users);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Schedule Aircraft</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="pilot">Pilot</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId} required>
                <SelectTrigger id="pilot">
                  <SelectValue placeholder="Select pilot" />
                </SelectTrigger>
                <SelectContent>
                  {availablePilot && (
                    <SelectItem value={availablePilot.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: availablePilot.color }}
                        />
                        {availablePilot.name}
                      </div>
                    </SelectItem>
                  )}
                  <SelectSeparator />
                  <SelectItem value="maintenance">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-red-600" />
                      <span className="font-semibold text-red-600">Maintenance</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="note">
                    <div className="flex items-center gap-2">
                      <StickyNote className="w-4 h-4 text-yellow-600" />
                      <span className="font-semibold text-yellow-600">Note / Reminder</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="request">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-blue-600">Pilot Request</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="title">Title (Optional)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Training Flight, Cross Country"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="start">Start Time</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="end">End Time</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional details..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {selectedUserId === 'request' ? 'Create Request' : 'Create Booking'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}