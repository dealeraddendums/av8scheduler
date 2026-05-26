import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Calendar, AlertCircle, StickyNote, Trash2 } from 'lucide-react';
import { format, isPast, isFuture } from 'date-fns';

interface DayNote {
  id: string;
  date: string;
  note: string;
  blocksScheduling: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

interface DayNotesListProps {
  dayNotes: DayNote[];
  onEditNote: (note: DayNote) => void;
  onDeleteNote: (noteId: string) => void;
}

export function DayNotesList({ dayNotes, onEditNote, onDeleteNote }: DayNotesListProps) {
  const sortedNotes = [...dayNotes].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const futureNotes = sortedNotes.filter(note => 
    isFuture(new Date(note.date)) || format(new Date(note.date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  );

  const pastNotes = sortedNotes.filter(note => 
    isPast(new Date(note.date)) && format(new Date(note.date), 'yyyy-MM-dd') !== format(new Date(), 'yyyy-MM-dd')
  );

  const renderNote = (note: DayNote, isPastNote: boolean) => {
    const noteDate = new Date(note.date);
    
    return (
      <div 
        key={note.id}
        className={`p-4 border rounded-lg ${isPastNote ? 'opacity-60' : ''}`}
        style={{ 
          borderLeftWidth: '4px', 
          borderLeftColor: note.blocksScheduling ? '#ef4444' : '#eab308'
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4" />
              <h3 className="font-semibold">
                {format(noteDate, 'EEEE, MMMM d, yyyy')}
              </h3>
            </div>

            <p className="text-sm mb-2">{note.note}</p>

            <div className="flex items-center gap-2 flex-wrap">
              {note.blocksScheduling && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Blocks Scheduling
                </Badge>
              )}
              <Badge variant="secondary" className="gap-1">
                <StickyNote className="w-3 h-3" />
                {note.createdByName}
              </Badge>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEditNote(note)}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDeleteNote(note.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  if (dayNotes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No day notes yet. Right-click on any day in the calendar to add a note.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {futureNotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {futureNotes.map(note => renderNote(note, false))}
          </CardContent>
        </Card>
      )}

      {pastNotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Past Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pastNotes.slice(-10).reverse().map(note => renderNote(note, true))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
