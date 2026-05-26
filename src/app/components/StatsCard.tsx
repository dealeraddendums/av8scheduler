import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Clock, Calendar, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './ui/button';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const FLIGHTS_API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-82b8c834`;

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

  // Total Flight Hours card now reports Hobbs hours since the 2/15/26 annual.
  // Fetches /flights/totals once on mount; falls back to 0.0 (NOT booking hours)
  // on failure.
  const [sinceAnnualHobbs, setSinceAnnualHobbs] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${FLIGHTS_API_BASE}/flights/totals`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const val = data?.since_annual_hobbs;
        setSinceAnnualHobbs(typeof val === 'number' ? val : 0);
      })
      .catch(() => {
        if (!cancelled) setSinceAnnualHobbs(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const now = new Date();
  
  // Filter out spouses from statistics
  const pilots = users.filter(user => user.userType !== 'spouse');
  
  const upcomingBookings = bookings.filter(b => new Date(b.startTime) >= now);

  const userStats = pilots.map(user => {
    const userBookings = bookings.filter(b => b.userId === user.id);
    const hours = userBookings.reduce((acc, booking) => {
      const start = new Date(booking.startTime);
      const end = new Date(booking.endTime);
      return acc + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    }, 0);
    
    return {
      user,
      hours: Math.round(hours * 10) / 10,
      bookings: userBookings.length
    };
  }).sort((a, b) => b.hours - a.hours);

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
              <div className="text-2xl font-bold">{(sinceAnnualHobbs ?? 0).toFixed(1)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Hobbs hrs since annual (2/15/26)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Top Pilot
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {userStats[0] ? (
                <>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: userStats[0].user.color }}
                    />
                    {userStats[0].user.name}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {userStats[0].hours} hours ({userStats[0].bookings} flights)
                  </p>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">No bookings yet</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}