import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { Calendar as CalendarIcon, AlertTriangle, Check, Droplet, ShieldCheck } from 'lucide-react';
import type { MaintenanceEvent, NewMaintenanceInput, OilSummary } from '@av8/api';

interface LogMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentUser: { id: string; name: string };
  oilSummary: OilSummary | null;
  onCreate: (input: NewMaintenanceInput) => Promise<MaintenanceEvent | null>;
  onSaved?: () => void;
}

const BORDER = '1px solid rgba(78, 81, 102, 0.2)';
const RADIUS = '0.625rem';
const OIL_INTERVAL = 50;

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatLong(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function lastDayOfMonthIso(year: number, month1: number): string {
  const d = new Date(year, month1, 0);
  return `${year}-${String(month1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nextAnnualPreview(iso: string): string | null {
  const [y, m] = iso.split('-').map(Number);
  if (!y || !m) return null;
  return lastDayOfMonthIso(y + 1, m);
}

function formatIsoLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function LogMaintenanceDialog({
  open,
  onOpenChange,
  currentUser,
  oilSummary,
  onCreate,
  onSaved,
}: LogMaintenanceDialogProps) {
  const [mode, setMode] = useState<'oil_change' | 'annual'>('oil_change');
  const [date, setDate] = useState<Date>(() => new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tachReading, setTachReading] = useState<string>('');
  const [hobbsReading, setHobbsReading] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const ready = useRef(false);

  useEffect(() => {
    if (open && !ready.current) {
      ready.current = true;
      setMode('oil_change');
      setDate(new Date());
      setTachReading('');
      setHobbsReading('');
      setNotes('');
      setSubmitError(null);
    }
    if (!open) ready.current = false;
  }, [open]);

  const tachNum = useMemo(() => {
    const n = Number(tachReading);
    return tachReading.trim() !== '' && Number.isFinite(n) ? n : null;
  }, [tachReading]);

  const hobbsNum = useMemo(() => {
    const n = Number(hobbsReading);
    return hobbsReading.trim() !== '' && Number.isFinite(n) ? n : null;
  }, [hobbsReading]);

  const canSave =
    !submitting &&
    tachNum !== null &&
    (mode === 'oil_change' || hobbsNum !== null);

  const handleSave = async () => {
    if (!canSave || tachNum === null) return;
    setSubmitting(true);
    setSubmitError(null);
    const payload: NewMaintenanceInput = {
      type: mode,
      pilot_id: currentUser.id,
      pilot_name: currentUser.name,
      date: toIso(date),
      tach_reading: tachNum,
      hobbs_reading: mode === 'annual' ? hobbsNum : hobbsNum ?? null,
      notes: notes.trim() || null,
    };
    const result = await onCreate(payload);
    setSubmitting(false);
    if (result) {
      onOpenChange(false);
      onSaved?.();
    } else {
      setSubmitError('Save failed. Check your connection and try again.');
    }
  };

  const nextOilDue = tachNum !== null ? (tachNum + OIL_INTERVAL).toFixed(1) : '—';
  const nextAnnualIso = nextAnnualPreview(toIso(date));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Maintenance</DialogTitle>
          <DialogDescription>
            Track oil changes and annual inspections; resets the relevant KV
            thresholds automatically.
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div
          className="inline-flex overflow-hidden w-full"
          style={{ border: BORDER, borderRadius: RADIUS }}
        >
          {(['oil_change', 'annual'] as const).map((m) => {
            const active = mode === m;
            const Icon = m === 'oil_change' ? Droplet : ShieldCheck;
            const label = m === 'oil_change' ? 'Oil Change' : 'Annual';
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 px-3 py-2 text-sm flex items-center justify-center gap-2 transition-colors ${
                  active
                    ? 'bg-[#4E5166] text-white'
                    : 'bg-white text-[#4E5166] hover:bg-[#f8f8f8]'
                }`}
                aria-pressed={active}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <div>
            <Label>Date</Label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left h-10 border-[rgba(78,81,102,0.2)]"
                >
                  <CalendarIcon className="w-4 h-4 mr-2 text-[#747274]" />
                  {formatLong(date)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    if (d) setDate(d);
                    setDatePickerOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="m-tach">Tach reading</Label>
              <Input
                id="m-tach"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={tachReading}
                onChange={(e) => setTachReading(e.target.value)}
                placeholder="e.g. 631.1"
              />
            </div>
            <div>
              <Label htmlFor="m-hobbs">
                Hobbs reading {mode === 'annual' && <span className="text-red-600">*</span>}
                {mode === 'oil_change' && (
                  <span className="text-[#747274]" style={{ fontSize: 11 }}> (optional)</span>
                )}
              </Label>
              <Input
                id="m-hobbs"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={hobbsReading}
                onChange={(e) => setHobbsReading(e.target.value)}
                placeholder={mode === 'annual' ? 'required' : 'e.g. 4587.6'}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="m-notes">Notes (optional)</Label>
            <Textarea
              id="m-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                mode === 'oil_change'
                  ? 'e.g. Aeroshell 15W-50, filter changed'
                  : 'e.g. New A&P, two minor squawks fixed'
              }
            />
          </div>

          {/* Summary preview */}
          <div
            className="bg-[#f8f8f8] p-3 space-y-1 text-xs text-[#1a1a2e]"
            style={{ border: BORDER, borderRadius: RADIUS }}
          >
            {mode === 'oil_change' ? (
              <>
                <div>
                  Oil due will reset to Tach{' '}
                  <span className="tabular-nums font-medium">{nextOilDue}</span>
                </div>
                <div className="text-[#6b7280]">
                  Quarts added since last change:{' '}
                  <span className="tabular-nums">
                    {oilSummary?.quarts_added_since_change.toFixed(1) ?? '0.0'}
                  </span>
                </div>
                <div className="text-[#6b7280]">
                  Hobbs since last change:{' '}
                  <span className="tabular-nums">
                    {oilSummary?.hobbs_since_change.toFixed(1) ?? '0.0'}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div>
                  Annual baseline will reset to Hobbs{' '}
                  <span className="tabular-nums font-medium">
                    {hobbsNum !== null ? hobbsNum.toFixed(1) : '—'}
                  </span>{' '}
                  · Tach{' '}
                  <span className="tabular-nums font-medium">
                    {tachNum !== null ? tachNum.toFixed(1) : '—'}
                  </span>
                </div>
                <div className="text-[#6b7280]">
                  Next annual will be set to{' '}
                  <span className="tabular-nums">
                    {nextAnnualIso ? formatIsoLong(nextAnnualIso) : '—'}
                  </span>
                </div>
                <div className="text-[#6b7280]">
                  Oil due will also reset to Tach{' '}
                  <span className="tabular-nums">{nextOilDue}</span>
                </div>
              </>
            )}
          </div>

          {submitError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="bg-[#4E5166] hover:bg-[#3e4156] text-white gap-2"
          >
            <Check className="w-4 h-4" />
            {submitting ? 'Saving…' : mode === 'oil_change' ? 'Save Oil Change' : 'Save Annual'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
