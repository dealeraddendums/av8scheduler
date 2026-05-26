import { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
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
import { Trash2, Droplet, ShieldCheck } from 'lucide-react';
import type { Destination, Flight, MaintenanceEvent } from './types';

interface FlightListProps {
  flights: Flight[];
  maintenanceEvents: MaintenanceEvent[];
  destinations: Destination[];
  pilots: { id: string; name: string; color: string }[];
  loading: boolean;
  isAdmin: boolean;
  onDelete: (id: string) => Promise<boolean> | void;
}

type Selection =
  | { kind: 'flight'; flight: Flight }
  | { kind: 'maintenance'; event: MaintenanceEvent }
  | null;

type MergedItem =
  | { kind: 'flight'; date: string; createdAt: string; flight: Flight }
  | { kind: 'maintenance'; date: string; createdAt: string; event: MaintenanceEvent };

const ALL = '__all__';
const BORDER = '1px solid rgba(78, 81, 102, 0.2)';
const RADIUS = '0.625rem';
const AMBER = '#F59E0B';
const NAVY = '#4E5166';

function formatShort(iso: string): string {
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatLong(iso: string): string {
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function FlightList({
  flights,
  maintenanceEvents,
  destinations,
  pilots,
  loading,
  isAdmin,
  onDelete,
}: FlightListProps) {
  const [filter, setFilter] = useState<string>(ALL);
  const [selected, setSelected] = useState<Selection>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pilotColor = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of pilots) map[p.id] = p.color;
    return map;
  }, [pilots]);

  const destinationByIcao = useMemo(() => {
    const map: Record<string, Destination> = {};
    for (const d of destinations) map[d.icao.toUpperCase()] = d;
    return map;
  }, [destinations]);

  const merged = useMemo<MergedItem[]>(() => {
    const fItems: MergedItem[] = flights.map((f) => ({
      kind: 'flight',
      date: f.date,
      createdAt: f.created_at,
      flight: f,
    }));
    const mItems: MergedItem[] = maintenanceEvents.map((e) => ({
      kind: 'maintenance',
      date: e.date,
      createdAt: e.created_at,
      event: e,
    }));
    return [...fItems, ...mItems].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
  }, [flights, maintenanceEvents]);

  const visible = useMemo(() => {
    if (filter === ALL) return merged;
    return merged.filter((item) =>
      item.kind === 'flight' ? item.flight.pilot_id === filter : item.event.pilot_id === filter
    );
  }, [merged, filter]);

  const filters = [{ id: ALL, label: 'All' }, ...pilots.map((p) => ({ id: p.id, label: p.name }))];

  const handleDeleteSelected = async () => {
    if (!selected || selected.kind !== 'flight') return;
    const targetId = selected.flight.id;
    setConfirmDelete(false);
    setSelected(null);
    await onDelete(targetId);
  };

  return (
    <div className="bg-white" style={{ border: BORDER, borderRadius: RADIUS }}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: BORDER }}>
        {filters.map((f) => {
          const active = filter === f.id;
          return (
            <Button
              key={f.id}
              variant="ghost"
              size="sm"
              onClick={() => setFilter(f.id)}
              className={`h-8 px-3 text-sm border ${
                active
                  ? 'bg-[#4E5166] text-white border-[#4E5166] hover:bg-[#4E5166] hover:text-white'
                  : 'bg-transparent text-[#4E5166] border-[rgba(78,81,102,0.2)] hover:bg-[#f8f8f8]'
              }`}
            >
              {f.label}
            </Button>
          );
        })}
        <span className="ml-auto text-xs text-[#747274] tabular-nums">
          {visible.length} {visible.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {loading && merged.length === 0 ? (
        <div className="divide-y divide-[rgba(78,81,102,0.2)]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-[#f0f0f0]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-32 bg-[#f0f0f0] rounded" />
                <div className="h-3 w-48 bg-[#f0f0f0] rounded" />
              </div>
              <div className="h-3 w-12 bg-[#f0f0f0] rounded" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#747274]">No entries logged yet</div>
      ) : (
        <div className="divide-y divide-[rgba(78,81,102,0.2)]">
          {visible.map((item) => {
            if (item.kind === 'flight') {
              const f = item.flight;
              const icao = f.destination.toUpperCase();
              const destObj = destinationByIcao[icao];
              return (
                <button
                  key={`f-${f.id}`}
                  type="button"
                  onClick={() => setSelected({ kind: 'flight', flight: f })}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#f8f8f8] transition-colors"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: pilotColor[f.pilot_id] ?? '#747274' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-mono uppercase text-[#4E5166]">{icao}</span>
                      {destObj && (
                        <span className="text-sm text-[#747274] truncate">{destObj.name}</span>
                      )}
                      <span className="text-xs text-[#747274] ml-auto md:ml-0">
                        {formatShort(f.date)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-[#747274] tabular-nums">
                      +{Number(f.hobbs_used ?? 0).toFixed(1)} Hobbs · +
                      {Number(f.tach_used ?? 0).toFixed(1)} Tach
                      {Number(f.oil_added_qts ?? 0) > 0 && (
                        <span className="ml-2 text-amber-700">
                          + {Number(f.oil_added_qts).toFixed(1)} qt
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-[#4E5166] tabular-nums">
                      {Number(f.hobbs_end).toFixed(1)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-[#747274]">Hobbs</div>
                  </div>
                </button>
              );
            }

            // maintenance event row
            const e = item.event;
            const isOil = e.type === 'oil_change';
            const accent = isOil ? AMBER : NAVY;
            const Icon = isOil ? Droplet : ShieldCheck;
            const label = isOil ? 'Oil Change' : 'Annual Inspection';
            return (
              <button
                key={`m-${e.id}`}
                type="button"
                onClick={() => setSelected({ kind: 'maintenance', event: e })}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#f8f8f8] transition-colors"
                style={{ borderLeft: `2px solid ${accent}` }}
              >
                <Icon className="w-4 h-4 shrink-0" style={{ color: accent }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span style={{ color: accent, fontWeight: 500 }}>{label}</span>
                    <span className="text-sm text-[#747274] truncate">{e.pilot_name}</span>
                    <span className="text-xs text-[#747274] ml-auto md:ml-0">
                      {formatShort(e.date)}
                    </span>
                  </div>
                  {e.notes && (
                    <div className="mt-0.5 text-xs text-[#747274] truncate">{e.notes}</div>
                  )}
                </div>
                <div className="text-right shrink-0 text-xs tabular-nums" style={{ color: accent }}>
                  Tach {Number(e.tach_reading).toFixed(1)}
                  {e.hobbs_reading !== null && (
                    <span> · Hobbs {Number(e.hobbs_reading).toFixed(1)}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Sheet
        open={selected !== null}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
      >
        <SheetContent className="sm:max-w-md w-[92vw]">
          {selected?.kind === 'flight' && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: pilotColor[selected.flight.pilot_id] ?? '#747274' }}
                  />
                  <span className="font-mono">{selected.flight.destination.toUpperCase()}</span>
                  {destinationByIcao[selected.flight.destination.toUpperCase()] && (
                    <span className="text-sm text-[#747274] font-normal">
                      {destinationByIcao[selected.flight.destination.toUpperCase()].name}
                    </span>
                  )}
                </SheetTitle>
                <SheetDescription>{formatLong(selected.flight.date)}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4 px-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-[#747274]">Pilot</div>
                  <div className="text-[#4E5166]">{selected.flight.pilot_name}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-[#747274]">Hobbs end</div>
                    <div className="text-[#4E5166] tabular-nums">
                      {Number(selected.flight.hobbs_end).toFixed(1)}
                    </div>
                    {selected.flight.hobbs_used !== null && (
                      <div className="text-xs text-[#747274] tabular-nums">
                        Δ +{Number(selected.flight.hobbs_used).toFixed(1)} hr
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-[#747274]">Tach end</div>
                    <div className="text-[#4E5166] tabular-nums">
                      {Number(selected.flight.tach_end).toFixed(1)}
                    </div>
                    {selected.flight.tach_used !== null && (
                      <div className="text-xs text-[#747274] tabular-nums">
                        Δ +{Number(selected.flight.tach_used).toFixed(1)} hr
                      </div>
                    )}
                  </div>
                </div>

                {Number(selected.flight.oil_added_qts ?? 0) > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-[#747274]">Oil added</div>
                    <div className="text-amber-700 tabular-nums">
                      {Number(selected.flight.oil_added_qts).toFixed(1)} qt
                    </div>
                  </div>
                )}

                {selected.flight.notes && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-[#747274]">Notes</div>
                    <div className="text-sm text-[#4E5166] whitespace-pre-wrap">
                      {selected.flight.notes}
                    </div>
                  </div>
                )}

                <div className="text-xs text-[#747274]">
                  Logged {new Date(selected.flight.created_at).toLocaleString()}
                </div>

                {isAdmin && (
                  <div className="pt-4 border-t border-[rgba(78,81,102,0.2)]">
                    <Button
                      variant="outline"
                      onClick={() => setConfirmDelete(true)}
                      className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete this flight
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {selected?.kind === 'maintenance' && (() => {
            const e = selected.event;
            const isOil = e.type === 'oil_change';
            const accent = isOil ? AMBER : NAVY;
            const Icon = isOil ? Droplet : ShieldCheck;
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Icon className="w-4 h-4" style={{ color: accent }} />
                    <span style={{ color: accent }}>
                      {isOil ? 'Oil Change' : 'Annual Inspection'}
                    </span>
                  </SheetTitle>
                  <SheetDescription>{formatLong(e.date)}</SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-4 px-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-[#747274]">Pilot</div>
                    <div className="text-[#4E5166]">{e.pilot_name}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-[#747274]">Tach</div>
                      <div className="text-[#4E5166] tabular-nums">
                        {Number(e.tach_reading).toFixed(1)}
                      </div>
                    </div>
                    {e.hobbs_reading !== null && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-[#747274]">Hobbs</div>
                        <div className="text-[#4E5166] tabular-nums">
                          {Number(e.hobbs_reading).toFixed(1)}
                        </div>
                      </div>
                    )}
                  </div>

                  {e.notes && (
                    <div>
                      <div className="text-xs uppercase tracking-wide text-[#747274]">Notes</div>
                      <div className="text-sm text-[#4E5166] whitespace-pre-wrap">{e.notes}</div>
                    </div>
                  )}

                  <div className="text-xs text-[#747274]">
                    Logged {new Date(e.created_at).toLocaleString()}
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this flight?</AlertDialogTitle>
            <AlertDialogDescription>
              {selected?.kind === 'flight' && (
                <>
                  {formatLong(selected.flight.date)} · {selected.flight.pilot_name} ·{' '}
                  {selected.flight.destination.toUpperCase()}
                  <br />
                  Subsequent flight deltas will recompute.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
