import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Clock, Calendar, TrendingUp, ChevronDown, ChevronUp, Plane } from 'lucide-react';
import { Button } from './ui/button';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import type { FlightTotals } from '@av8/api';

const FLIGHTS_API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-82b8c834`;

function formatHobbs(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatLongDate(iso: string): string {
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysUntil(iso: string): number {
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return 0;
  const [y, m, d] = parts;
  const target = new Date(y, m - 1, d).getTime();
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((target - todayMidnight) / 86400000);
}

function oilDotColor(remaining: number): string {
  if (remaining < 10) return '#EF4444';
  if (remaining < 25) return '#F59E0B';
  return '#4E5166';
}

function annualDotColor(days: number): string {
  if (days < 30) return '#EF4444';
  if (days < 60) return '#F59E0B';
  return '#4E5166';
}

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

interface User {
  id: string;
  name: string;
  email: string;
  color: string;
  userType?: 'pilot' | 'spouse';
}

interface StatsCardProps {
  bookings: Booking[];
  users: User[];
}

export function StatsCard({ bookings, users }: StatsCardProps) {
  // Detect if mobile on initial load (collapsed by default on mobile, expanded on desktop)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768; // Collapsed on mobile (< 768px)
    }
    return false;
  });

  // Update collapsed state when window resizes
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && !isCollapsed) {
        // Don't auto-collapse if user manually expanded on mobile
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isCollapsed]);

  // /flights/totals drives both the Total Flight Hours card (Hobbs since
  // annual) and the Aircraft card (current Hobbs/Tach, oil, next annual).
  // One fetch on mount; falls back to a zero-state object on failure so the
  // cards render rather than showing booking-derived numbers.
  const [flightTotals, setFlightTotals] = useState<FlightTotals | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${FLIGHTS_API_BASE}/flights/totals`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data && typeof data === 'object') setFlightTotals(data as FlightTotals);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const now = new Date();
  const upcomingBookings = bookings.filter(b => new Date(b.startTime) >= now);
  // `users` is unused after the Top Pilot card was replaced with the Aircraft
  // card, but kept in the prop signature for compatibility with Home.tsx.
  void users;

  return (
    <div className="space-y-3">
      {/* Header with collapse/expand button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#4E5166]" />
          Flight Statistics
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="gap-2"
        >
          {isCollapsed ? (
            <>
              <ChevronDown className="w-4 h-4" />
              Show Stats
            </>
          ) : (
            <>
              <ChevronUp className="w-4 h-4" />
              Hide Stats
            </>
          )}
        </Button>
      </div>

      {/* Stats cards - collapsible */}
      {!isCollapsed && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Upcoming Flights
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{upcomingBookings.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Scheduled bookings
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Flight Hours
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(flightTotals?.since_annual_hobbs ?? 0).toFixed(1)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Hobbs hrs since annual (2/15/26)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Plane className="h-4 w-4 text-muted-foreground" />
                Aircraft
              </CardTitle>
              <span className="text-xs text-muted-foreground font-mono">N4368V</span>
            </CardHeader>
            <CardContent>
              {flightTotals ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Current Hobbs</p>
                    <p className="text-lg font-bold tabular-nums">
                      {formatHobbs(flightTotals.current_hobbs)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current Tach</p>
                    <p className="text-lg font-bold tabular-nums">
                      {flightTotals.current_tach.toFixed(1)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Next Oil Change</p>
                    <p className="text-lg font-bold flex items-center gap-1.5">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: oilDotColor(flightTotals.tach_remaining) }}
                      />
                      <span className="tabular-nums">
                        {flightTotals.tach_remaining.toFixed(1)} hrs remaining
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Next Annual</p>
                    <p className="text-lg font-bold flex items-center gap-1.5">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: annualDotColor(daysUntil(flightTotals.next_annual)) }}
                      />
                      <span className="tabular-nums">
                        {formatLongDate(flightTotals.next_annual)} ·{' '}
                        {daysUntil(flightTotals.next_annual)} days
                      </span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Loading aircraft data…</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}