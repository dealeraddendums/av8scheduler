import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Calendar, Clock, Trash2, Save, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

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

interface User {
  id: string;
  name: string;
  color: string;
  userType?: 'pilot' | 'spouse';
  linkedPilotId?: string;
}

interface EventEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  onUpdateBooking: (bookingId: string, updates: Partial<Booking>) => void;
  onDeleteBooking: (bookingId: string) => void;
  onAcceptRequest?: (bookingId: string) => void;
  loggedInUserId: string | null;
  users?: User[];
}

export function EventEditDialog({
  open,
  onOpenChange,
  booking,
  onUpdateBooking,
  onDeleteBooking,
  onAcceptRequest,
  loggedInUserId,
  users = []
}: EventEditDialogProps) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (booking) {
      setTitle(booking.title);
      setNotes(booking.notes || '');
      
      // Format dates for datetime-local input
      const start = new Date(booking.startTime);
      const end = new Date(booking.endTime);
      
      setStartTime(formatDateTimeLocal(start));
      setEndTime(formatDateTimeLocal(end));
    }
  }, [booking]);

  const formatDateTimeLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const formatDateTimeDisplay = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleSave = () => {
    if (!booking) return;

    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end <= start) {
      toast.error('End time must be after start time');
      return;
    }

    onUpdateBooking(booking.id, {
      title: title.trim(),
      notes: notes.trim(),
      startTime: start.toISOString(),
      endTime: end.toISOString()
    });

    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!booking) return;

    const confirmMessage = booking.isRequest && !booking.acceptedBy
      ? 'Are you sure you want to cancel this booking request?'
      : 'Are you sure you want to delete this booking?';

    if (confirm(confirmMessage)) {
      onDeleteBooking(booking.id);
      onOpenChange(false);
    }
  };

  const handleAccept = () => {
    if (!booking || !onAcceptRequest) return;
    onAcceptRequest(booking.id);
    onOpenChange(false);
  };

  if (!booking) return null;

  const loggedInUser = users.find(u => u.id === loggedInUserId);
  
  // Determine permissions
  const isOwnBooking = loggedInUserId === booking.userId;
  // Maintenance and Note blocks have no real owner ('maintenance'/'note') — any logged-in user can manage them
  const isSharedBlock = (booking.userId === 'maintenance' || booking.userId === 'note') && !!loggedInUserId;
  const isSpouseOfPilot = loggedInUser?.userType === 'spouse' && loggedInUser.linkedPilotId === booking.userId;
  const isRequester = loggedInUserId === booking.requestedBy || 
                       (loggedInUser?.userType === 'spouse' && loggedInUser.linkedPilotId === booking.requestedBy);
  
  // Unaccepted requests: requester can edit/delete, others can accept
  // Accepted requests: owner can edit/delete, requester can also delete
  const isUnacceptedRequest = booking.isRequest && !booking.acceptedBy;
  const isAcceptedRequest = booking.isRequest && booking.acceptedBy;
  
  const canEdit = isUnacceptedRequest
    ? isRequester // Only requester can edit an unaccepted request
    : (isOwnBooking || isSpouseOfPilot || isSharedBlock); // After acceptance, owner can edit

  const canDelete = isUnacceptedRequest
    ? isRequester // Only requester can cancel an unaccepted request
    : (isOwnBooking || isSpouseOfPilot || isRequester || isSharedBlock); // After acceptance, both owner and requester can delete
  
  const canAccept = isUnacceptedRequest && !isRequester && loggedInUserId; // Anyone except requester can accept

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {isUnacceptedRequest ? 'Booking Request' : canEdit ? 'Edit Booking' : 'View Booking'}
          </DialogTitle>
          <DialogDescription>
            {isUnacceptedRequest 
              ? 'This is a flight request - does not block the schedule' 
              : canEdit ? 'Modify your booking details' : 'Booking details'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Request Status Banner */}
          {isUnacceptedRequest && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <span className="font-medium text-blue-900">
                ✈️ Requested by: {booking.requestedByName}
              </span>
            </div>
          )}

          {isAcceptedRequest && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="font-medium text-green-900">
                Request accepted by {booking.userName}
              </span>
            </div>
          )}

          {/* Pilot Info */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: booking.userColor }}
            />
            <span className="font-medium">{booking.userName}</span>
            {isUnacceptedRequest && <span className="text-sm text-gray-500">(unassigned)</span>}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Training Flight"
              disabled={!canEdit}
            />
          </div>

          {/* Start Time */}
          <div className="space-y-2">
            <Label htmlFor="edit-start">Start Time</Label>
            {canEdit ? (
              <Input
                id="edit-start"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            ) : (
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md text-sm">
                <Clock className="w-4 h-4 text-gray-500" />
                {formatDateTimeDisplay(booking.startTime)}
              </div>
            )}
          </div>

          {/* End Time */}
          <div className="space-y-2">
            <Label htmlFor="edit-end">End Time</Label>
            {canEdit ? (
              <Input
                id="edit-end"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            ) : (
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md text-sm">
                <Clock className="w-4 h-4 text-gray-500" />
                {formatDateTimeDisplay(booking.endTime)}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes (Optional)</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details..."
              rows={3}
              disabled={!canEdit}
            />
          </div>

          {!canEdit && !canAccept && (
            <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
              You can only edit your own bookings
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {canDelete && (
            <Button
              onClick={handleDelete}
              variant="destructive"
              className="gap-2 mr-auto"
            >
              <Trash2 className="w-4 h-4" />
              {isUnacceptedRequest ? 'Cancel Request' : 'Delete'}
            </Button>
          )}
          
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          
          {canAccept && (
            <Button onClick={handleAccept} className="gap-2 bg-green-600 hover:bg-green-700">
              <CheckCircle className="w-4 h-4" />
              Accept Request
            </Button>
          )}
          
          {canEdit && (
            <Button onClick={handleSave} className="gap-2">
              <Save className="w-4 h-4" />
              Save Changes
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}