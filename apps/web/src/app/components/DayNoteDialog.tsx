import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { AlertCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface DayNote {
  id: string;
  date: string; // YYYY-MM-DD format
  note: string;
  blocksScheduling: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

interface DayNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  existingNote?: DayNote | null;
  currentUserId: string | null;
  currentUserName: string;
  onSave: (noteData: {
    date: string;
    note: string;
    blocksScheduling: boolean;
    createdBy: string;
    createdByName: string;
  }) => Promise<void>;
  onDelete?: (noteId: string) => Promise<void>;
}

export function DayNoteDialog({
  open,
  onOpenChange,
  date,
  existingNote,
  currentUserId,
  currentUserName,
  onSave,
  onDelete
}: DayNoteDialogProps) {
  const [note, setNote] = useState('');
  const [blocksScheduling, setBlocksScheduling] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (existingNote) {
      setNote(existingNote.note);
      setBlocksScheduling(existingNote.blocksScheduling);
    } else {
      setNote('');
      setBlocksScheduling(false);
    }
  }, [existingNote, open]);

  const handleSave = async () => {
    if (!date || !note.trim()) return;

    setLoading(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      await onSave({
        date: dateStr,
        note: note.trim(),
        blocksScheduling,
        createdBy: currentUserId || 'unknown',
        createdByName: currentUserName
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingNote || !onDelete) return;
    
    setLoading(true);
    try {
      await onDelete(existingNote.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting note:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!date) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {existingNote ? 'Edit Day Note' : 'Add Day Note'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              value={format(date, 'EEEE, MMMM d, yyyy')}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              placeholder="e.g., Aircraft in maintenance, Hangar door inoperable, Annual inspection scheduled..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <Label htmlFor="blocks" className="cursor-pointer font-semibold">
                  Block Scheduling
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Prevent pilots from booking flights on this day
              </p>
            </div>
            <Switch
              id="blocks"
              checked={blocksScheduling}
              onCheckedChange={setBlocksScheduling}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          {existingNote && onDelete && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
              className="mr-auto"
            >
              Delete Note
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !note.trim()}
          >
            {loading ? 'Saving...' : 'Save Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
