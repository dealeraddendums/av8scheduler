import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Calendar, Clock, User, FileText } from 'lucide-react';

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

interface BookingInfoDialogProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BookingInfoDialog({ booking, open, onOpenChange }: BookingInfoDialogProps) {
  if (!booking) return null;

  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded-full" 
              style={{ backgroundColor: booking.userColor }}
            />
            {booking.title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 mt-0.5 text-muted-foreground" />
            <div>
              <p className="font-semibold">{booking.userName}</p>
              <p className="text-sm text-muted-foreground">Pilot</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 mt-0.5 text-muted-foreground" />
            <div>
              <p className="font-semibold">{format(start, 'EEEE, MMMM d, yyyy')}</p>
              <p className="text-sm text-muted-foreground">Date</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 mt-0.5 text-muted-foreground" />
            <div>
              <p className="font-semibold">
                {format(start, 'h:mm a')} - {format(end, 'h:mm a')}
              </p>
              <p className="text-sm text-muted-foreground">
                Duration: <Badge variant="secondary">{duration} hours</Badge>
              </p>
            </div>
          </div>

          {booking.notes && (
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-semibold mb-1">Notes</p>
                <p className="text-sm text-muted-foreground">{booking.notes}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
