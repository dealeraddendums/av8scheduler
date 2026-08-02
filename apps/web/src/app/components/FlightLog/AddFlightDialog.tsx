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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Calendar as CalendarIcon, AlertTriangle, Check } from 'lucide-react';
import { GaugeCapture } from './GaugeCapture';
import type { Destination, Flight, LastReading, NewFlightInput } from '@av8/api';

interface AddFlightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: { id: string; name: string };
  pilots: { id: string; name: string }[];
  isAdmin: boolean;
  destinations: Destination[];
  fetchLastReading: () => Promise<LastReading>;
  createFlight: (input: NewFlightInput) => Promise<Flight | null>;
  onSaved?: () => void;
}

const BORDER = '1px solid rgba(78, 81, 102, 0.2)';
const RADIUS = '0.625rem';

const OTHER_KEY = '__other__';

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      {Array.from({ length: total }, (_, i) => i + 1).map((i) => (
        <div
          key={i}
          className={`h-2 transition-all ${
            i === step
              ? 'w-6 bg-[#4E5166]'
              : i < step
              ? 'w-2 bg-[#4E5166]'
              : 'w-2 bg-[rgba(78,81,102,0.2)]'
          } rounded-full`}
        />
      ))}
    </div>
  );
}

export function AddFlightDialog({
  open,
  onOpenChange,
  currentUser,
  pilots,
  isAdmin,
  destinations,
  fetchLastReading,
  createFlight,
  onSaved,
}: AddFlightDialogProps) {
  const [step, setStep] = useState(1);
  const [pilotId, setPilotId] = useState(currentUser.id);
  const [date, setDate] = useState<Date>(() => new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [destination, setDestination] = useState<string>('');
  const [otherIcao, setOtherIcao] = useState<string>('');
  const [showOther, setShowOther] = useState(false);
  const [hobbsEnd, setHobbsEnd] = useState<number | null>(null);
  const [tachEnd, setTachEnd] = useState<number | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [oilAdded, setOilAdded] = useState<boolean>(false);
  const [lastReading, setLastReading] = useState<LastReading | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const dialogReady = useRef(false);

  // Reset state when dialog opens fresh
  useEffect(() => {
    if (open && !dialogReady.current) {
      dialogReady.current = true;
      setStep(1);
      setPilotId(currentUser.id);
      setDate(new Date());
      setDestination('');
      setOtherIcao('');
      setShowOther(false);
      setHobbsEnd(null);
      setTachEnd(null);
      setNotes('');
      setOilAdded(false);
      setLastReading(null);
      setSubmitError(null);
      // pre-fetch last reading in the background
      fetchLastReading().then((r) => setLastReading(r)).catch(() => undefined);
    }
    if (!open) dialogReady.current = false;
  }, [open, currentUser.id, fetchLastReading]);

  const pilot = useMemo(
    () => pilots.find((p) => p.id === pilotId) ?? currentUser,
    [pilotId, pilots, currentUser]
  );

  const effectiveDestination = showOther ? otherIcao.trim().toUpperCase() : destination;
  const validDestination = effectiveDestination.length >= 3 && effectiveDestination.length <= 5;

  const hobbsUsed = useMemo(() => {
    if (hobbsEnd === null || !lastReading || lastReading.hobbs_end === 0) return null;
    return Math.round((hobbsEnd - lastReading.hobbs_end) * 10) / 10;
  }, [hobbsEnd, lastReading]);

  const tachUsed = useMemo(() => {
    if (tachEnd === null || !lastReading || lastReading.tach_end === 0) return null;
    return Math.round((tachEnd - lastReading.tach_end) * 10) / 10;
  }, [tachEnd, lastReading]);

  const hobbsNegative = hobbsUsed !== null && hobbsUsed < 0;
  const tachNegative = tachUsed !== null && tachUsed < 0;

  const canAdvanceFromStep3 = hobbsEnd !== null && tachEnd !== null;

  const handleSave = async () => {
    if (!pilot || !validDestination || hobbsEnd === null || tachEnd === null) return;
    setSubmitting(true);
    setSubmitError(null);
    const payload = {
      pilot_id: pilot.id,
      pilot_name: pilot.name,
      date: toIsoDate(date),
      destination: effectiveDestination,
      hobbs_end: hobbsEnd,
      tach_end: tachEnd,
      notes: notes.trim() || null,
      oil_added_qts: oilAdded ? 1 : 0,
    };
    console.log('AddFlightDialog payload:', payload);
    try {
      const result = await createFlight(payload);
      setSubmitting(false);
      if (result) {
        onOpenChange(false);
        onSaved?.();
      } else {
        setSubmitError('Save failed — check the browser console for details.');
      }
    } catch (err) {
      setSubmitting(false);
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
          ? err
          : (() => {
              try {
                return JSON.stringify(err);
              } catch {
                return 'Unknown error';
              }
            })();
      console.error('AddFlightDialog handleSave error:', err);
      setSubmitError(`Failed to create flight: ${msg}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Flight</DialogTitle>
          <DialogDescription>
            {step === 1 && 'Pilot, date, and destination.'}
            {step === 2 && 'Capture or enter the ending Hobbs and Tach.'}
            {step === 3 && 'Review the entry — values are still editable.'}
            {step === 4 && 'Confirm and save.'}
          </DialogDescription>
        </DialogHeader>

        <StepIndicator step={step} total={4} />

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Pilot</Label>
              {isAdmin && pilots.length > 1 ? (
                <Select value={pilotId} onValueChange={setPilotId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pilots.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div
                  className="inline-flex items-center px-3 py-2 bg-[#f8f8f8] text-[#4E5166] text-sm"
                  style={{ border: BORDER, borderRadius: RADIUS }}
                >
                  {pilot.name}
                </div>
              )}
            </div>

            <div>
              <Label>Date</Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left h-10 border-[rgba(78,81,102,0.2)]"
                  >
                    <CalendarIcon className="w-4 h-4 mr-2 text-[#747274]" />
                    {formatLongDate(date)}
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

            <div>
              <Label>Destination</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                {destinations.map((d) => {
                  const active = !showOther && destination === d.icao;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setShowOther(false);
                        setDestination(d.icao);
                      }}
                      className={`text-left px-3 py-2.5 transition-colors ${
                        active
                          ? 'bg-[#4E5166]/10 text-[#4E5166] border-[#4E5166]'
                          : 'bg-white text-[#4E5166] hover:bg-[#f8f8f8] border-[rgba(78,81,102,0.2)]'
                      }`}
                      style={{ border: active ? '1px solid #4E5166' : BORDER, borderRadius: RADIUS }}
                    >
                      <div className="font-mono">{d.icao}</div>
                      <div className="text-xs text-[#747274]">{d.name}</div>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setShowOther(true);
                    setDestination(OTHER_KEY);
                  }}
                  className={`text-left px-3 py-2.5 transition-colors ${
                    showOther
                      ? 'bg-[#4E5166]/10 text-[#4E5166]'
                      : 'bg-white text-[#4E5166] hover:bg-[#f8f8f8]'
                  }`}
                  style={{ border: showOther ? '1px solid #4E5166' : BORDER, borderRadius: RADIUS }}
                >
                  <div className="font-mono">Other</div>
                  <div className="text-xs text-[#747274]">Type ICAO</div>
                </button>
              </div>
              {showOther && (
                <Input
                  className="mt-2 uppercase"
                  placeholder="ICAO (e.g. KSEA)"
                  value={otherIcao}
                  onChange={(e) => setOtherIcao(e.target.value.toUpperCase().slice(0, 5))}
                  maxLength={5}
                  autoFocus
                />
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <GaugeCapture
              lastReading={lastReading}
              onResult={(h, t) => {
                setHobbsEnd(h);
                setTachEnd(t);
                if (h !== null && t !== null) setStep(3);
              }}
            />
            <div className="text-center">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-xs text-[#747274] hover:text-[#4E5166] underline"
              >
                Skip — fill in on next step
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid gap-3" style={{ border: BORDER, borderRadius: RADIUS }}>
              <div className="p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#747274]">Pilot</span>
                  <span className="text-[#4E5166]">{pilot.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#747274]">Date</span>
                  <span className="text-[#4E5166]">{formatLongDate(date)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#747274]">Destination</span>
                  <span className="text-[#4E5166] font-mono">{effectiveDestination || '—'}</span>
                </div>
              </div>
              <div className="px-4 pb-4 grid grid-cols-2 gap-3 border-t border-[rgba(78,81,102,0.2)] pt-4">
                <div>
                  <Label htmlFor="rev-hobbs">Hobbs end</Label>
                  <Input
                    id="rev-hobbs"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={hobbsEnd ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setHobbsEnd(raw === '' ? null : Number(raw));
                    }}
                  />
                  {hobbsUsed !== null && (
                    <div
                      className={`mt-1 text-xs tabular-nums ${
                        hobbsNegative ? 'text-red-600' : 'text-[#747274]'
                      }`}
                    >
                      prev {lastReading?.hobbs_end.toFixed(1) ?? '0.0'} → Δ {hobbsUsed.toFixed(1)} hr
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="rev-tach">Tach end</Label>
                  <Input
                    id="rev-tach"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={tachEnd ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setTachEnd(raw === '' ? null : Number(raw));
                    }}
                  />
                  {tachUsed !== null && (
                    <div
                      className={`mt-1 text-xs tabular-nums ${
                        tachNegative ? 'text-red-600' : 'text-[#747274]'
                      }`}
                    >
                      prev {lastReading?.tach_end.toFixed(1) ?? '0.0'} → Δ {tachUsed.toFixed(1)} hr
                    </div>
                  )}
                </div>
              </div>
              {(hobbsNegative || tachNegative) && (
                <div className="mx-4 mb-4 flex items-start gap-2 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {hobbsNegative && tachNegative
                      ? 'Both Hobbs and Tach end values are below the previous reading'
                      : hobbsNegative
                      ? `Hobbs end is below previous reading (${lastReading?.hobbs_end.toFixed(1)})`
                      : `Tach end is below previous reading (${lastReading?.tach_end.toFixed(1)})`}{' '}
                    — please verify.
                  </span>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="rev-notes">Notes (optional)</Label>
              <Textarea
                id="rev-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything worth remembering about this flight…"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="oil-added"
                checked={oilAdded}
                onCheckedChange={(v) => setOilAdded(v === true)}
              />
              <Label
                htmlFor="oil-added"
                className="font-normal cursor-pointer flex items-center gap-2"
                style={{ fontSize: 13, color: '#6b7280' }}
              >
                Added oil before this flight
                {oilAdded && (
                  <span className="text-[#4E5166]" style={{ fontSize: 13 }}>
                    Quarts added: 1
                  </span>
                )}
              </Label>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div
              className="bg-white p-4 space-y-2 text-sm"
              style={{ border: BORDER, borderRadius: RADIUS }}
            >
              <div className="flex justify-between">
                <span className="text-[#747274]">Pilot</span>
                <span className="text-[#4E5166]">{pilot.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#747274]">Date</span>
                <span className="text-[#4E5166]">{formatLongDate(date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#747274]">Destination</span>
                <span className="text-[#4E5166] font-mono">{effectiveDestination}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#747274]">Hobbs end</span>
                <span className="text-[#4E5166] tabular-nums">
                  {hobbsEnd?.toFixed(1)}{' '}
                  {hobbsUsed !== null && (
                    <span className="text-xs text-[#747274]">(Δ {hobbsUsed.toFixed(1)})</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#747274]">Tach end</span>
                <span className="text-[#4E5166] tabular-nums">
                  {tachEnd?.toFixed(1)}{' '}
                  {tachUsed !== null && (
                    <span className="text-xs text-[#747274]">(Δ {tachUsed.toFixed(1)})</span>
                  )}
                </span>
              </div>
              {notes && (
                <div className="pt-2 border-t border-[rgba(78,81,102,0.2)]">
                  <div className="text-[#747274]">Notes</div>
                  <div className="text-[#4E5166] whitespace-pre-wrap">{notes}</div>
                </div>
              )}
            </div>
            {submitError && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              if (step === 1) onOpenChange(false);
              else setStep(step - 1);
            }}
            disabled={submitting}
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          {step < 4 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={
                (step === 1 && !validDestination) ||
                (step === 3 && !canAdvanceFromStep3)
              }
              className="bg-[#4E5166] hover:bg-[#3e4156] text-white"
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={submitting}
              className="bg-[#4E5166] hover:bg-[#3e4156] text-white gap-2"
            >
              <Check className="w-4 h-4" />
              {submitting ? 'Saving…' : 'Save Flight'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
