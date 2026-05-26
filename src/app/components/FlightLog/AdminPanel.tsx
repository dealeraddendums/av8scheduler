import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Plus, Trash2, FileDown, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { Destination, Flight, FlightTotals } from './types';

interface AdminPanelProps {
  isAdmin: boolean;
  totals: FlightTotals | null;
  flights: Flight[];
  destinations: Destination[];
  onCreateDestination: (icao: string, name: string) => Promise<Destination | null>;
  onDeleteDestination: (id: string) => Promise<boolean>;
  onExportCSV: () => Promise<void>;
}

const BORDER = '1px solid rgba(78, 81, 102, 0.2)';
const RADIUS = '0.625rem';

function oilLabel(remaining: number): string {
  if (remaining < 10) return 'OVERDUE';
  if (remaining < 25) return 'DUE SOON';
  return 'OK';
}

function generatePDF(totals: FlightTotals, flights: Flight[]): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const left = 54;
  let y = 64;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('N4368V Flight Log Summary', left, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(
    `Generated ${new Date().toLocaleString('en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
    })}`,
    left,
    y
  );
  y += 28;

  // Combined totals
  doc.setTextColor(60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Combined Totals', left, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Total Hobbs:   ${totals.total_hobbs.toFixed(1)} hr`, left, y);
  y += 16;
  doc.text(`Total Tach:    ${totals.total_tach.toFixed(1)} hr`, left, y);
  y += 16;
  doc.text(`Flights:       ${flights.length}`, left, y);
  y += 28;

  // Per pilot
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Per Pilot', left, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  if (totals.by_pilot.length === 0) {
    doc.setTextColor(140);
    doc.text('No flights logged yet.', left, y);
    doc.setTextColor(60);
    y += 16;
  } else {
    for (const p of totals.by_pilot) {
      doc.text(
        `${p.pilot_name.padEnd(14, ' ')} H ${p.hobbs.toFixed(1).padStart(6, ' ')}  ·  T ${p.tach
          .toFixed(1)
          .padStart(6, ' ')}  ·  ${p.count} flights`,
        left,
        y
      );
      y += 16;
    }
  }
  y += 12;

  // Oil status
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Oil Status', left, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Current Tach:  ${totals.current_tach.toFixed(1)}`, left, y);
  y += 16;
  doc.text(`Oil Due Tach:  ${totals.oil_due_tach.toFixed(1)}`, left, y);
  y += 16;
  doc.text(
    `Remaining:     ${totals.tach_remaining.toFixed(1)} hr  (${oilLabel(totals.tach_remaining)})`,
    left,
    y
  );

  return doc;
}

export function AdminPanel({
  isAdmin,
  totals,
  flights,
  destinations,
  onCreateDestination,
  onDeleteDestination,
  onExportCSV,
}: AdminPanelProps) {
  const [newIcao, setNewIcao] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Destination | null>(null);

  if (!isAdmin) return null;

  const handleAdd = async () => {
    const icao = newIcao.trim().toUpperCase();
    const name = newName.trim();
    if (icao.length < 3 || !name) return;
    setAdding(true);
    const result = await onCreateDestination(icao, name);
    setAdding(false);
    if (result) {
      setNewIcao('');
      setNewName('');
    }
  };

  const handlePDF = () => {
    if (!totals) return;
    const doc = generatePDF(totals, flights);
    doc.save(`N4368V-flight-log-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section
        className="bg-white p-4"
        style={{ border: BORDER, borderRadius: RADIUS }}
      >
        <h3 className="text-sm font-medium text-[#4E5166] mb-3">Destinations</h3>
        <div
          className="divide-y divide-[rgba(78,81,102,0.2)]"
          style={{ border: BORDER, borderRadius: RADIUS }}
        >
          {destinations.length === 0 ? (
            <div className="p-3 text-xs text-[#747274]">No destinations yet</div>
          ) : (
            destinations.map((d) => (
              <div key={d.id} className="px-3 py-2 flex items-center gap-2 text-sm">
                <span className="font-mono w-14 text-[#4E5166]">{d.icao}</span>
                <span className="flex-1 truncate text-[#4E5166]">{d.name}</span>
                <span className="text-xs text-[#747274] tabular-nums">#{d.sort_order}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setPendingDelete(d)}
                  aria-label={`Delete ${d.icao}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 items-end">
          <div className="col-span-1">
            <Label htmlFor="new-icao" className="text-xs">ICAO</Label>
            <Input
              id="new-icao"
              value={newIcao}
              onChange={(e) => setNewIcao(e.target.value.toUpperCase().slice(0, 4))}
              maxLength={4}
              placeholder="KSEA"
              className="font-mono uppercase"
            />
          </div>
          <div className="col-span-2 flex gap-2">
            <div className="flex-1">
              <Label htmlFor="new-name" className="text-xs">Name</Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Seattle-Tacoma"
              />
            </div>
            <Button
              type="button"
              onClick={handleAdd}
              disabled={adding || newIcao.length < 3 || !newName.trim()}
              className="bg-[#4E5166] hover:bg-[#3e4156] text-white self-end gap-1"
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
        </div>
      </section>

      <section
        className="bg-white p-4"
        style={{ border: BORDER, borderRadius: RADIUS }}
      >
        <h3 className="text-sm font-medium text-[#4E5166] mb-3">Export</h3>
        <p className="text-xs text-[#747274] mb-4">
          Download a complete log or a printable summary for the aircraft binder.
        </p>
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2 h-11 border-[rgba(78,81,102,0.2)] text-[#4E5166] hover:bg-[#f8f8f8]"
            onClick={onExportCSV}
            disabled={flights.length === 0}
          >
            <FileDown className="w-4 h-4" />
            Download CSV (all flights)
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2 h-11 border-[rgba(78,81,102,0.2)] text-[#4E5166] hover:bg-[#f8f8f8]"
            onClick={handlePDF}
            disabled={!totals}
          >
            <FileText className="w-4 h-4" />
            Download PDF summary
          </Button>
        </div>
      </section>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this destination?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (
                <>
                  {pendingDelete.icao} — {pendingDelete.name}
                  <br />
                  Past flights to this airport will keep their record.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!pendingDelete) return;
                const id = pendingDelete.id;
                setPendingDelete(null);
                await onDeleteDestination(id);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
