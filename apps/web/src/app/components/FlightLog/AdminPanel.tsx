import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
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
import {
  Plus,
  Trash2,
  FileDown,
  FileText,
  ChevronDown,
  MapPin,
  Keyboard,
  Save,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import { downloadForeFlightCsv } from './foreflightExport';
import type { Destination, Flight, FlightTotals, NewFlightInput } from '@av8/api';

interface AdminPanelProps {
  isAdmin: boolean;
  totals: FlightTotals | null;
  flights: Flight[];
  destinations: Destination[];
  pilots: { id: string; name: string }[];
  onCreateDestination: (icao: string, name: string) => Promise<Destination | null>;
  onDeleteDestination: (id: string) => Promise<boolean>;
  onCreateFlight: (input: NewFlightInput) => Promise<Flight | null>;
  onDeleteFlight: (id: string) => Promise<boolean>;
  onExportCSV: () => Promise<void>;
}

const BORDER = '1px solid rgba(78, 81, 102, 0.2)';
const RADIUS = '0.625rem';

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shortAnnualDate(iso: string): string {
  const p = iso.split('-').map(Number);
  if (p.length !== 3 || p.some(Number.isNaN)) return iso;
  return `${p[1]}/${p[2]}/${String(p[0]).slice(-2)}`;
}

function oilLabel(remaining: number): string {
  if (remaining < 10) return 'OVERDUE';
  if (remaining < 25) return 'DUE SOON';
  return 'OK';
}

function isValidIcao(s: string): boolean {
  return /^[A-Z0-9]{3,5}$/.test(s);
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
    `Generated ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}`,
    left,
    y
  );
  y += 28;

  doc.setTextColor(60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`Annual Baseline (${shortAnnualDate(totals.annual_date)})`, left, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Hobbs at annual:  ${totals.annual_hobbs.toFixed(1)}`, left, y);
  y += 16;
  doc.text(`Tach at annual:   ${totals.annual_tach.toFixed(1)}`, left, y);
  y += 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Per Pilot — Since Annual', left, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  if (totals.by_pilot.length === 0) {
    doc.setTextColor(140);
    doc.text('No flights since annual.', left, y);
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

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Combined Totals', left, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(
    `Since annual:    H ${totals.since_annual_hobbs.toFixed(1)}  ·  T ${totals.since_annual_tach.toFixed(
      1
    )}`,
    left,
    y
  );
  y += 16;
  doc.text(
    `All time:        H ${totals.total_hobbs.toFixed(1)}  ·  T ${totals.total_tach.toFixed(1)}`,
    left,
    y
  );
  y += 16;
  doc.text(`Total flights:   ${flights.length}`, left, y);
  y += 28;

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

interface SectionShellProps {
  title: string;
  open: boolean;
  onOpenChange: (b: boolean) => void;
  icon: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
}

function SectionShell({ title, open, onOpenChange, icon, subtitle, children }: SectionShellProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="bg-white" style={{ border: BORDER, borderRadius: RADIUS }}>
        <CollapsibleTrigger asChild>
          <button
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#4E5166] hover:bg-[#f8f8f8] transition-colors"
            style={{ borderRadius: RADIUS }}
          >
            {icon}
            <span className="font-medium">{title}</span>
            {subtitle && <span className="text-xs text-[#747274]">{subtitle}</span>}
            <ChevronDown
              className={`w-4 h-4 ml-auto transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1 border-t border-[rgba(78,81,102,0.2)]">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function AdminPanel({
  isAdmin,
  totals,
  flights,
  destinations,
  pilots,
  onCreateDestination,
  onDeleteDestination,
  onCreateFlight,
  onDeleteFlight,
  onExportCSV,
}: AdminPanelProps) {
  // Section open states (all collapsed by default)
  const [openA, setOpenA] = useState(false);
  const [openB, setOpenB] = useState(false);
  const [openC, setOpenC] = useState(false);

  // Section B — ForeFlight export
  const [ffPilotId, setFfPilotId] = useState<string>('');
  const [ffStart, setFfStart] = useState<string>('');
  const [ffEnd, setFfEnd] = useState<string>('');

  // Section A
  const [newIcao, setNewIcao] = useState('');
  const [newName, setNewName] = useState('');
  const [addingDest, setAddingDest] = useState(false);
  const [pendingDeleteDest, setPendingDeleteDest] = useState<Destination | null>(null);

  // Section C — Bulk Entry. All pilots show in the toggle so admin can
  // enter historical flights for any of them (Allan/Chip/Bob).
  const bulkPilots = useMemo(() => pilots, [pilots]);
  const [bulkDate, setBulkDate] = useState<string>(todayIso());
  const [bulkPilotId, setBulkPilotId] = useState<string>(bulkPilots[0]?.id ?? '');
  const [bulkDestQuery, setBulkDestQuery] = useState<string>('');
  const [bulkDestIcao, setBulkDestIcao] = useState<string>('');
  const [bulkHobbs, setBulkHobbs] = useState<string>('');
  const [bulkTach, setBulkTach] = useState<string>('');
  const [bulkNotes, setBulkNotes] = useState<string>('');
  const [savingBulk, setSavingBulk] = useState(false);
  const [entered, setEntered] = useState<Flight[]>([]);

  const destInputRef = useRef<HTMLInputElement>(null);
  const hobbsInputRef = useRef<HTMLInputElement>(null);
  const tachInputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLInputElement>(null);

  // Ensure pilot selection stays valid as pilots prop changes
  useEffect(() => {
    if (!bulkPilots.some((p) => p.id === bulkPilotId)) {
      setBulkPilotId(bulkPilots[0]?.id ?? '');
    }
  }, [bulkPilots, bulkPilotId]);

  // ForeFlight export: default to Allan (user1), else first pilot
  useEffect(() => {
    if (!pilots.some((p) => p.id === ffPilotId)) {
      setFfPilotId(pilots.find((p) => p.id === 'user1')?.id ?? pilots[0]?.id ?? '');
    }
  }, [pilots, ffPilotId]);

  const handleForeFlightExport = () => {
    const pilot = pilots.find((p) => p.id === ffPilotId);
    if (!pilot) {
      toast.error('Select a pilot first');
      return;
    }
    const count = downloadForeFlightCsv(flights, {
      pilotId: pilot.id,
      pilotName: pilot.name,
      startDate: ffStart || undefined,
      endDate: ffEnd || undefined,
    });
    if (count === 0) {
      toast.error('No flights match that pilot and date range');
    } else {
      toast.success(`Exported ${count} flight${count === 1 ? '' : 's'} for ${pilot.name}`);
    }
  };

  const filteredDests = useMemo(() => {
    const q = bulkDestQuery.trim().toLowerCase();
    if (!q) return destinations.slice(0, 6);
    return destinations
      .filter(
        (d) => d.icao.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [destinations, bulkDestQuery]);

  const effectiveDest = bulkDestIcao || (() => {
    const q = bulkDestQuery.trim().toUpperCase();
    if (filteredDests.length > 0) return filteredDests[0].icao;
    if (isValidIcao(q)) return q;
    return '';
  })();

  const sessionHobbs = useMemo(
    () => entered.reduce((sum, f) => sum + Number(f.hobbs_used ?? 0), 0),
    [entered]
  );
  const sessionTach = useMemo(
    () => entered.reduce((sum, f) => sum + Number(f.tach_used ?? 0), 0),
    [entered]
  );

  if (!isAdmin) return null;

  // — Section A handlers —

  const handleAddDest = async () => {
    const icao = newIcao.trim().toUpperCase();
    const name = newName.trim();
    if (icao.length < 3 || !name) return;
    setAddingDest(true);
    const result = await onCreateDestination(icao, name);
    setAddingDest(false);
    if (result) {
      setNewIcao('');
      setNewName('');
    }
  };

  // — Section B handlers —

  const handlePDF = () => {
    if (!totals) return;
    const doc = generatePDF(totals, flights);
    doc.save(`N4368V-flight-log-${todayIso()}.pdf`);
  };

  // — Section C handlers —

  const selectDestFromList = (icao: string) => {
    setBulkDestIcao(icao);
    setBulkDestQuery(icao);
    setTimeout(() => hobbsInputRef.current?.focus(), 0);
  };

  const handleDestKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredDests.length > 0) {
        selectDestFromList(filteredDests[0].icao);
      } else {
        const q = bulkDestQuery.trim().toUpperCase();
        if (isValidIcao(q)) {
          setBulkDestIcao(q);
          setBulkDestQuery(q);
          setTimeout(() => hobbsInputRef.current?.focus(), 0);
        }
      }
    }
  };

  const handleSubmitKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveRow();
    }
  };

  const canSaveBulk =
    bulkDate &&
    bulkPilotId &&
    effectiveDest.length >= 3 &&
    bulkHobbs.trim() !== '' &&
    bulkTach.trim() !== '' &&
    !savingBulk;

  const handleSaveRow = async () => {
    if (!canSaveBulk) return;
    const pilot = bulkPilots.find((p) => p.id === bulkPilotId);
    if (!pilot) return;
    setSavingBulk(true);
    const created = await onCreateFlight({
      pilot_id: pilot.id,
      pilot_name: pilot.name,
      date: bulkDate,
      destination: effectiveDest,
      hobbs_end: Number(bulkHobbs),
      tach_end: Number(bulkTach),
      notes: bulkNotes.trim() || null,
    });
    setSavingBulk(false);
    if (created) {
      setEntered((prev) => [created, ...prev]);
      setBulkDestQuery('');
      setBulkDestIcao('');
      setBulkHobbs('');
      setBulkTach('');
      setBulkNotes('');
      setTimeout(() => destInputRef.current?.focus(), 0);
    }
  };

  const handleDeleteEntered = async (id: string) => {
    const ok = await onDeleteFlight(id);
    if (ok) setEntered((prev) => prev.filter((f) => f.id !== id));
  };

  const annualLabel = totals ? shortAnnualDate(totals.annual_date) : '';

  return (
    <div className="space-y-3">
      {/* Section A — Destinations */}
      <SectionShell
        title="Destinations"
        subtitle={`${destinations.length} configured`}
        icon={<MapPin className="w-4 h-4" />}
        open={openA}
        onOpenChange={setOpenA}
      >
        <div
          className="mt-3 divide-y divide-[rgba(78,81,102,0.2)]"
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
                  onClick={() => setPendingDeleteDest(d)}
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
          <div className="col-span-2 flex gap-2 items-end">
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
              onClick={handleAddDest}
              disabled={addingDest || newIcao.length < 3 || !newName.trim()}
              className="bg-[#4E5166] hover:bg-[#3e4156] text-white gap-1"
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
        </div>
      </SectionShell>

      {/* Section B — Export */}
      <SectionShell
        title="Export"
        subtitle="CSV and PDF summary"
        icon={<FileDown className="w-4 h-4" />}
        open={openB}
        onOpenChange={setOpenB}
      >
        <div className="pt-3 space-y-2">
          <p className="text-xs text-[#747274]">
            CSV is the full log; the PDF summarizes against the annual baseline
            {annualLabel ? ` (${annualLabel})` : ''}.
          </p>
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

          {/* ForeFlight logbook export */}
          <div className="pt-3 mt-3 space-y-2" style={{ borderTop: BORDER }}>
            <p className="text-sm text-[#4E5166]">ForeFlight logbook</p>
            <p className="text-xs text-[#747274] leading-snug">
              One pilot per file — import at plan.foreflight.com. Use the date
              range to export only flights since your last import (re-importing
              the same rows creates duplicates in ForeFlight).
            </p>
            <div className="flex flex-wrap gap-1.5">
              {pilots.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setFfPilotId(p.id)}
                  className={`px-3 h-9 text-sm rounded-md border transition-colors ${
                    ffPilotId === p.id
                      ? 'bg-[#4E5166] text-white border-[#4E5166]'
                      : 'bg-white text-[#4E5166] border-[rgba(78,81,102,0.2)] hover:bg-[#f8f8f8]'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ff-start" className="text-xs">From date (optional)</Label>
                <Input
                  id="ff-start"
                  type="date"
                  value={ffStart}
                  onChange={(e) => setFfStart(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ff-end" className="text-xs">To date (optional)</Label>
                <Input
                  id="ff-end"
                  type="date"
                  value={ffEnd}
                  onChange={(e) => setFfEnd(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2 h-11 border-[rgba(78,81,102,0.2)] text-[#4E5166] hover:bg-[#f8f8f8]"
              onClick={handleForeFlightExport}
              disabled={flights.length === 0 || !ffPilotId}
            >
              <FileDown className="w-4 h-4" />
              Download ForeFlight CSV
            </Button>
          </div>
        </div>
      </SectionShell>

      {/* Section C — Bulk Entry */}
      <SectionShell
        title="Bulk Entry"
        subtitle="Fast entry from paper log"
        icon={<Keyboard className="w-4 h-4" />}
        open={openC}
        onOpenChange={setOpenC}
      >
        <div className="pt-3 space-y-3">
          <p className="text-xs text-[#747274] leading-snug">
            Enter chronologically (oldest first) so Hobbs/Tach deltas chain correctly. Date and pilot are retained between rows.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-3 items-end">
            <div>
              <Label htmlFor="bulk-date" className="text-xs">Date</Label>
              <Input
                id="bulk-date"
                type="date"
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Pilot</Label>
              <div
                className="inline-flex overflow-hidden"
                style={{ border: BORDER, borderRadius: RADIUS }}
              >
                {bulkPilots.map((p) => {
                  const active = p.id === bulkPilotId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setBulkPilotId(p.id)}
                      className={`px-4 py-2 text-sm transition-colors ${
                        active
                          ? 'bg-[#4E5166] text-white'
                          : 'bg-white text-[#4E5166] hover:bg-[#f8f8f8]'
                      }`}
                      aria-pressed={active}
                      title={p.name}
                    >
                      <span className="font-medium">{p.name.charAt(0).toUpperCase()}</span>
                      <span className="ml-1 text-xs opacity-70">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="bulk-dest" className="text-xs">
              Destination {bulkDestIcao && <span className="text-[#4E5166] font-mono ml-1">{bulkDestIcao}</span>}
            </Label>
            <Input
              id="bulk-dest"
              ref={destInputRef}
              value={bulkDestQuery}
              onChange={(e) => {
                setBulkDestQuery(e.target.value);
                setBulkDestIcao('');
              }}
              onKeyDown={handleDestKeyDown}
              placeholder="Type ICAO or name, Enter to select…"
              className="uppercase font-mono"
              autoComplete="off"
            />
            {bulkDestQuery && !bulkDestIcao && (
              <div
                className="mt-1 max-h-44 overflow-y-auto divide-y divide-[rgba(78,81,102,0.2)]"
                style={{ border: BORDER, borderRadius: RADIUS }}
              >
                {filteredDests.map((d, i) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => selectDestFromList(d.icao)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-3 hover:bg-[#f8f8f8] ${
                      i === 0 ? 'bg-[#f8f8f8]' : 'bg-white'
                    }`}
                  >
                    <span className="font-mono text-[#4E5166] w-14">{d.icao}</span>
                    <span className="text-[#4E5166] truncate">{d.name}</span>
                    {i === 0 && (
                      <span className="ml-auto text-[10px] uppercase tracking-wide text-[#747274]">
                        Enter
                      </span>
                    )}
                  </button>
                ))}
                {filteredDests.length === 0 && isValidIcao(bulkDestQuery.toUpperCase()) && (
                  <button
                    type="button"
                    onClick={() => {
                      const q = bulkDestQuery.trim().toUpperCase();
                      setBulkDestIcao(q);
                      setBulkDestQuery(q);
                      setTimeout(() => hobbsInputRef.current?.focus(), 0);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#f8f8f8] bg-[#f8f8f8]"
                  >
                    Use{' '}
                    <span className="font-mono text-[#4E5166]">
                      {bulkDestQuery.trim().toUpperCase()}
                    </span>{' '}
                    (not in list)
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-[#747274]">
                      Enter
                    </span>
                  </button>
                )}
                {filteredDests.length === 0 && !isValidIcao(bulkDestQuery.toUpperCase()) && (
                  <div className="px-3 py-2 text-xs text-[#747274]">No match — type a valid ICAO</div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bulk-hobbs" className="text-xs">Hobbs End</Label>
              <Input
                id="bulk-hobbs"
                ref={hobbsInputRef}
                type="number"
                inputMode="decimal"
                step="0.1"
                value={bulkHobbs}
                onChange={(e) => setBulkHobbs(e.target.value)}
                placeholder="456.3"
              />
            </div>
            <div>
              <Label htmlFor="bulk-tach" className="text-xs">Tach End</Label>
              <Input
                id="bulk-tach"
                ref={tachInputRef}
                type="number"
                inputMode="decimal"
                step="0.1"
                value={bulkTach}
                onChange={(e) => setBulkTach(e.target.value)}
                onKeyDown={handleSubmitKey}
                placeholder="63.1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="bulk-notes" className="text-xs">Notes (optional)</Label>
            <Input
              id="bulk-notes"
              ref={notesInputRef}
              value={bulkNotes}
              onChange={(e) => setBulkNotes(e.target.value)}
              onKeyDown={handleSubmitKey}
              placeholder="optional"
            />
          </div>

          <Button
            type="button"
            onClick={handleSaveRow}
            disabled={!canSaveBulk}
            className="w-full bg-[#4E5166] hover:bg-[#3e4156] text-white gap-2"
          >
            <Save className="w-4 h-4" />
            {savingBulk ? 'Saving…' : 'Save Row'}
          </Button>

          {entered.length > 0 && (
            <>
              <div
                className="mt-3 divide-y divide-[rgba(78,81,102,0.2)]"
                style={{ border: BORDER, borderRadius: RADIUS }}
              >
                <div className="px-3 py-2 text-xs uppercase tracking-wide text-[#747274] bg-[#f8f8f8]">
                  Entered so far
                </div>
                {entered.map((f) => (
                  <div key={f.id} className="px-3 py-2 flex items-center gap-2 text-sm">
                    <span className="font-mono text-[#4E5166] w-16">{f.destination.toUpperCase()}</span>
                    <span className="text-xs text-[#747274] w-20 tabular-nums">{f.date}</span>
                    <span className="text-xs text-[#4E5166] truncate flex-1">{f.pilot_name}</span>
                    <span className="text-xs text-[#747274] tabular-nums">
                      +{Number(f.hobbs_used ?? 0).toFixed(1)}H / +{Number(f.tach_used ?? 0).toFixed(1)}T
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteEntered(f.id)}
                      aria-label="Delete entered row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="text-xs text-[#747274] tabular-nums">
                {entered.length} flights entered · +{sessionHobbs.toFixed(1)} Hobbs · +
                {sessionTach.toFixed(1)} Tach this session
              </div>
            </>
          )}
        </div>
      </SectionShell>

      <AlertDialog
        open={pendingDeleteDest !== null}
        onOpenChange={(o) => !o && setPendingDeleteDest(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this destination?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteDest && (
                <>
                  {pendingDeleteDest.icao} — {pendingDeleteDest.name}
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
                if (!pendingDeleteDest) return;
                const id = pendingDeleteDest.id;
                setPendingDeleteDest(null);
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
