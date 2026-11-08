import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { AlertCircle, Download, RefreshCw } from 'lucide-react';
import { exportCSV, fetchUsageReport } from '@av8/api';
import type { UsageReport } from '@av8/api';

const BORDER = '1px solid rgba(78, 81, 102, 0.2)';
const RADIUS = '0.625rem';
const FALLBACK_COLORS = ['#4E5166', '#7C90A0', '#B5AA9D', '#747274', '#B9B7A7'];

interface ReportsUser {
  id: string;
  name: string;
  color: string;
  userType?: 'pilot' | 'spouse';
}

interface ReportsProps {
  users: ReportsUser[];
}

type Preset = 'annual' | 'year' | '12mo' | 'all' | 'custom';

function todayLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function monthsAgoISO(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function formatDateLong(iso: string | null): string {
  if (!iso) return '';
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** All "YYYY-MM" months from first to last inclusive, so gap months still render. */
function monthSpan(first: string, last: string): string[] {
  const out: string[] = [];
  let [y, m] = first.split('-').map(Number);
  const [ly, lm] = last.split('-').map(Number);
  if (!y || !m || !ly || !lm) return [first];
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (out.length > 240) break; // safety: never render more than 20 years of rows
  }
  return out;
}

export function Reports({ users }: ReportsProps) {
  const [preset, setPreset] = useState<Preset>('annual');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [report, setReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const range = useMemo((): { from?: string; to?: string } => {
    switch (preset) {
      case 'annual':
        return { from: 'annual' };
      case 'year':
        return { from: `${new Date().getFullYear()}-01-01` };
      case '12mo':
        return { from: monthsAgoISO(12), to: todayLocalISO() };
      case 'all':
        return {};
      case 'custom':
        return {
          from: customFrom || undefined,
          to: customTo || undefined,
        };
    }
  }, [preset, customFrom, customTo]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUsageReport(range.from, range.to);
      setReport(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load report';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  // Pilot roster: scheduler users (spouses excluded), IDs normalized the same
  // way FlightLog does, each with their assigned color. Pilots with zero
  // flights in the range still get a card.
  const pilots = useMemo(
    () =>
      users
        .filter((u) => u.userType !== 'spouse')
        .map((u, i) => ({
          id: u.id.startsWith('user:') ? u.id.slice(5) : u.id,
          name: u.name,
          color: u.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
        })),
    [users]
  );

  const rows = useMemo(() => {
    const byId = new Map(report?.by_pilot.map((p) => [p.pilot_id, p]) ?? []);
    const known = new Set(pilots.map((p) => p.id));
    const merged = pilots.map((p) => {
      const r = byId.get(p.id);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        flights: r?.flights ?? 0,
        hobbs: r?.hobbs ?? 0,
        tach: r?.tach ?? 0,
      };
    });
    // Flights by pilots no longer in the user list still count.
    for (const r of report?.by_pilot ?? []) {
      if (!known.has(r.pilot_id)) {
        merged.push({
          id: r.pilot_id,
          name: r.pilot_name,
          color: FALLBACK_COLORS[merged.length % FALLBACK_COLORS.length],
          flights: r.flights,
          hobbs: r.hobbs,
          tach: r.tach,
        });
      }
    }
    return merged.sort((a, b) => b.hobbs - a.hobbs);
  }, [pilots, report]);

  const totalHobbs = report?.totals.hobbs ?? 0;

  const months = useMemo(() => {
    const m = report?.by_month ?? [];
    if (m.length === 0) return [];
    const span = monthSpan(m[0].month, m[m.length - 1].month);
    const byMonth = new Map(m.map((x) => [x.month, x.pilots]));
    return span.map((month) => ({ month, pilots: byMonth.get(month) ?? {} }));
  }, [report]);

  const rangeLabel = useMemo(() => {
    if (!report) return '';
    if (!report.from && !report.to) return 'All time';
    const from = report.from ? formatDateLong(report.from) : 'start';
    const to = report.to ? formatDateLong(report.to) : 'today';
    return `${from} – ${to}`;
  }, [report]);

  const handleExport = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const csv = await exportCSV(report.from ?? undefined, report.to ?? undefined);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `n4368v-flights-${report.from ?? 'start'}-to-${
        report.to ?? todayLocalISO()
      }.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const presets: { id: Preset; label: string }[] = [
    {
      id: 'annual',
      label: report?.last_annual_date
        ? `Since annual (${formatDateLong(report.last_annual_date)})`
        : 'Since last annual',
    },
    { id: 'year', label: 'This year' },
    { id: '12mo', label: 'Last 12 months' },
    { id: 'all', label: 'All time' },
    { id: 'custom', label: 'Custom' },
  ];

  const chartData = rows.map((r) => ({ name: r.name, hobbs: r.hobbs, color: r.color }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl text-[#4E5166]">Reports</h2>
        <p className="text-sm text-white">Per-pilot usage for the selected period.</p>
      </div>

      {/* Range selector */}
      <div className="bg-white" style={{ border: BORDER, borderRadius: RADIUS }}>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          {presets.map((p) => {
            const active = preset === p.id;
            return (
              <Button
                key={p.id}
                variant="ghost"
                size="sm"
                onClick={() => setPreset(p.id)}
                className={`h-8 px-3 text-sm border ${
                  active
                    ? 'bg-[#4E5166] text-white border-[#4E5166] hover:bg-[#4E5166] hover:text-white'
                    : 'bg-transparent text-[#4E5166] border-[rgba(78,81,102,0.2)] hover:bg-[#f8f8f8]'
                }`}
              >
                {p.label}
              </Button>
            );
          })}
          <span className="ml-auto text-xs text-[#747274] tabular-nums">{rangeLabel}</span>
        </div>
        {preset === 'custom' && (
          <div
            className="flex flex-wrap items-center gap-3 px-4 py-3"
            style={{ borderTop: BORDER }}
          >
            <label className="flex items-center gap-2 text-sm text-[#4E5166]">
              From
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 w-40 border-[rgba(78,81,102,0.2)]"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-[#4E5166]">
              To
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 w-40 border-[rgba(78,81,102,0.2)]"
              />
            </label>
          </div>
        )}
      </div>

      {error && (
        <div
          className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm"
          style={{ borderRadius: RADIUS }}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div>{error}</div>
            <button onClick={load} className="text-xs underline">
              Try again
            </button>
          </div>
        </div>
      )}

      {loading && !report ? (
        <div
          className="bg-white py-12 text-center text-sm text-[#747274]"
          style={{ border: BORDER, borderRadius: RADIUS }}
        >
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#4E5166]" />
          Loading report…
        </div>
      ) : report ? (
        <>
          {/* Per-pilot summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {rows.map((r) => {
              const share = totalHobbs > 0 ? (r.hobbs / totalHobbs) * 100 : 0;
              return (
                <div
                  key={r.id}
                  className="bg-white"
                  style={{
                    border: BORDER,
                    borderLeft: `4px solid ${r.color}`,
                    borderRadius: RADIUS,
                    padding: 16,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block rounded-full shrink-0"
                      style={{ width: 8, height: 8, backgroundColor: r.color }}
                    />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>
                      {r.name}
                    </span>
                    <span className="ml-auto tabular-nums" style={{ fontSize: 12, color: '#6b7280' }}>
                      {share.toFixed(1)}% of hours
                    </span>
                  </div>
                  <p className="tabular-nums" style={{ fontSize: 24, fontWeight: 600, color: '#1a1a2e', marginTop: 4 }}>
                    {r.hobbs.toFixed(1)} <span style={{ fontSize: 13, fontWeight: 400, color: '#6b7280' }}>Hobbs hrs</span>
                  </p>
                  <p className="tabular-nums" style={{ fontSize: 12, color: '#6b7280' }}>
                    {r.flights} {r.flights === 1 ? 'flight' : 'flights'} · {r.tach.toFixed(1)} tach hrs
                  </p>
                </div>
              );
            })}
          </div>

          {/* Aircraft totals row */}
          <div
            className="bg-white flex flex-wrap items-baseline gap-x-6 gap-y-1"
            style={{ border: BORDER, borderRadius: RADIUS, padding: 16 }}
          >
            <span style={{ fontSize: 12, color: '#6b7280' }}>Aircraft total</span>
            <span className="tabular-nums" style={{ fontSize: 20, fontWeight: 600, color: '#1a1a2e' }}>
              {report.totals.hobbs.toFixed(1)} Hobbs
            </span>
            <span className="tabular-nums" style={{ fontSize: 14, color: '#6b7280' }}>
              {report.totals.tach.toFixed(1)} tach · {report.totals.flights}{' '}
              {report.totals.flights === 1 ? 'flight' : 'flights'}
            </span>
            {report.data_quality.missing_or_zero_hobbs > 0 && (
              <span style={{ fontSize: 12, color: '#B45309' }}>
                {report.data_quality.missing_or_zero_hobbs}{' '}
                {report.data_quality.missing_or_zero_hobbs === 1 ? 'flight has' : 'flights have'}{' '}
                missing or zero Hobbs time
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting || report.totals.flights === 0}
              className="ml-auto gap-2 h-8 border-[rgba(78,81,102,0.2)] text-[#4E5166] hover:bg-[#f8f8f8]"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          </div>

          {/* Hobbs hours by pilot — bar chart */}
          <div className="bg-white" style={{ border: BORDER, borderRadius: RADIUS }}>
            <div className="px-4 py-3" style={{ borderBottom: BORDER }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>
                Hobbs hours by pilot
              </span>
            </div>
            <div className="px-2 py-3">
              <ResponsiveContainer width="100%" height={Math.max(chartData.length * 48, 96)}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 4, right: 56, bottom: 4, left: 8 }}
                >
                  <XAxis type="number" hide domain={[0, 'dataMax']} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={64}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 13, fill: '#1a1a2e' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(78,81,102,0.06)' }}
                    formatter={(value: number) => [`${Number(value).toFixed(1)} hrs`, 'Hobbs']}
                    contentStyle={{
                      border: BORDER,
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="hobbs" barSize={20} radius={[0, 4, 4, 0]}>
                    {chartData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                    <LabelList
                      dataKey="hobbs"
                      position="right"
                      formatter={(v: number) => Number(v).toFixed(1)}
                      style={{ fill: '#1a1a2e', fontSize: 13 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Month-by-month table */}
          <div className="bg-white" style={{ border: BORDER, borderRadius: RADIUS }}>
            <div className="px-4 py-3" style={{ borderBottom: BORDER }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>
                Hobbs hours by month
              </span>
            </div>
            {months.length === 0 ? (
              <div className="py-8 text-center text-sm text-[#747274]">
                No flights in this range
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 420 }}>
                  <thead>
                    <tr style={{ borderBottom: BORDER }}>
                      <th className="text-left px-4 py-2 font-medium text-[#6b7280]" style={{ fontSize: 12 }}>
                        Month
                      </th>
                      {rows.map((r) => (
                        <th
                          key={r.id}
                          className="text-right px-4 py-2 font-medium"
                          style={{ fontSize: 12, color: '#6b7280' }}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="inline-block rounded-full"
                              style={{ width: 8, height: 8, backgroundColor: r.color }}
                            />
                            {r.name}
                          </span>
                        </th>
                      ))}
                      <th className="text-right px-4 py-2 font-medium text-[#6b7280]" style={{ fontSize: 12 }}>
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(78,81,102,0.2)]">
                    {months.map(({ month, pilots: mp }) => {
                      const monthTotal = rows.reduce((s, r) => s + (mp[r.id] ?? 0), 0);
                      return (
                        <tr key={month}>
                          <td className="px-4 py-2 text-[#1a1a2e]">{formatMonth(month)}</td>
                          {rows.map((r) => (
                            <td key={r.id} className="px-4 py-2 text-right tabular-nums text-[#1a1a2e]">
                              {mp[r.id] ? mp[r.id].toFixed(1) : <span className="text-[#B5AA9D]">—</span>}
                            </td>
                          ))}
                          <td className="px-4 py-2 text-right tabular-nums font-medium text-[#4E5166]">
                            {monthTotal > 0 ? monthTotal.toFixed(1) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
