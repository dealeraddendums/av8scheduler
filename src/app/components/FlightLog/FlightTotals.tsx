import type { FlightTotals as FlightTotalsType } from './types';

interface FlightTotalsProps {
  totals: FlightTotalsType | null;
  loading: boolean;
  pilotColors: Record<string, string>;
}

type OilLevel = 'ok' | 'warn' | 'danger';

function oilLevel(remaining: number): OilLevel {
  if (remaining < 10) return 'danger';
  if (remaining < 25) return 'warn';
  return 'ok';
}

const oilStyles: Record<OilLevel, { chip: string; dot: string }> = {
  ok: {
    chip: 'bg-[#f8f8f8] text-[#4E5166] border-[rgba(78,81,102,0.2)]',
    dot: 'bg-[#B9B7A7]',
  },
  warn: {
    chip: 'bg-amber-50 text-amber-800 border-amber-300',
    dot: 'bg-amber-500',
  },
  danger: {
    chip: 'bg-red-50 text-red-700 border-red-300',
    dot: 'bg-red-500',
  },
};

const BORDER = '1px solid rgba(78, 81, 102, 0.2)';
const RADIUS = '0.625rem';

export function FlightTotals({ totals, loading, pilotColors }: FlightTotalsProps) {
  if (loading && !totals) {
    return (
      <div
        className="flex items-center text-sm text-muted-foreground px-4 py-3 bg-white"
        style={{ border: BORDER, borderRadius: RADIUS }}
      >
        Loading totals…
      </div>
    );
  }

  if (!totals) return null;

  const oil = oilStyles[oilLevel(totals.tach_remaining)];

  return (
    <div
      className="flex flex-wrap items-stretch bg-white text-sm"
      style={{ border: BORDER, borderRadius: RADIUS }}
    >
      <div className="flex-1 min-w-[160px] px-4 py-3 border-r border-[rgba(78,81,102,0.2)]">
        <div className="text-xs uppercase tracking-wide text-[#747274]">Total Hobbs</div>
        <div className="mt-0.5 text-2xl text-[#4E5166] tabular-nums">{totals.total_hobbs.toFixed(1)}</div>
        <div className="text-xs text-[#747274]">hours</div>
      </div>

      <div className="flex-1 min-w-[160px] px-4 py-3 border-r border-[rgba(78,81,102,0.2)]">
        <div className="text-xs uppercase tracking-wide text-[#747274]">Total Tach</div>
        <div className="mt-0.5 text-2xl text-[#4E5166] tabular-nums">{totals.total_tach.toFixed(1)}</div>
        <div className="text-xs text-[#747274]">hours</div>
      </div>

      <div className="flex-[1.4] min-w-[220px] px-4 py-3 border-r border-[rgba(78,81,102,0.2)] flex flex-col justify-center">
        <div className="text-xs uppercase tracking-wide text-[#747274]">By pilot</div>
        {totals.by_pilot.length === 0 ? (
          <div className="mt-1 text-xs text-[#747274]">No flights yet</div>
        ) : (
          <div className="mt-1 space-y-0.5">
            {totals.by_pilot.map((p) => (
              <div key={p.pilot_id} className="flex items-center gap-2 text-[#4E5166]">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: pilotColors[p.pilot_id] ?? '#747274' }}
                />
                <span className="flex-1 truncate">{p.pilot_name}</span>
                <span className="text-xs text-[#747274] tabular-nums">
                  H {p.hobbs.toFixed(1)} · T {p.tach.toFixed(1)} · {p.count}×
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-[220px] px-4 py-3 flex items-center">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md border w-full ${oil.chip}`}
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${oil.dot}`} />
          <div className="flex-1 leading-tight">
            <div className="text-[11px] uppercase tracking-wide opacity-75">Oil change</div>
            <div className="text-xs tabular-nums">
              Due Tach {totals.oil_due_tach.toFixed(0)} · {totals.tach_remaining.toFixed(1)} hr remaining
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
