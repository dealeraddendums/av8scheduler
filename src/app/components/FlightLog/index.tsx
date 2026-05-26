import { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Plus, RefreshCw, ChevronDown, Shield, AlertCircle } from 'lucide-react';
import { useFlights } from './useFlights';
import { useDestinations } from './useDestinations';
import { FlightTotals } from './FlightTotals';
import { FlightList } from './FlightList';
import { AddFlightDialog } from './AddFlightDialog';
import { AdminPanel } from './AdminPanel';

interface FlightLogUser {
  id: string;
  name: string;
  email: string;
  color: string;
  userType?: 'pilot' | 'spouse';
}

interface FlightLogProps {
  users: FlightLogUser[];
  loggedInUser: FlightLogUser | undefined;
  onRequestLogin: () => void;
}

const BORDER = '1px solid rgba(78, 81, 102, 0.2)';
const RADIUS = '0.625rem';

function isAdminUser(user: FlightLogUser | undefined): boolean {
  if (!user) return false;
  return (
    user.id === 'user1' ||
    user.email === 'allan@allantone' ||
    user.email === 'allan@allantone.com'
  );
}

export function FlightLog({ users, loggedInUser, onRequestLogin }: FlightLogProps) {
  const flightsHook = useFlights();
  const destinationsHook = useDestinations();
  const [addOpen, setAddOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const pilots = useMemo(
    () => users.filter((u) => u.userType !== 'spouse').map((u) => ({ id: u.id, name: u.name, color: u.color })),
    [users]
  );

  const pilotColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of pilots) map[p.id] = p.color;
    return map;
  }, [pilots]);

  const isAdmin = isAdminUser(loggedInUser);

  const handleLogClick = () => {
    if (!loggedInUser) {
      onRequestLogin();
      return;
    }
    setAddOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl text-[#4E5166]">Flight Log</h2>
          <p className="text-sm text-white">
            Log destinations and gauge readings after each flight.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => { flightsHook.refresh(); destinationsHook.refresh(); }}
            disabled={flightsHook.loading}
            className="gap-2 h-10 border-[rgba(78,81,102,0.2)] text-[#4E5166] hover:bg-[#f8f8f8]"
          >
            <RefreshCw className={`w-4 h-4 ${flightsHook.loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={handleLogClick}
            className="gap-2 h-10 bg-[#4E5166] hover:bg-[#3e4156] text-white"
          >
            <Plus className="w-4 h-4" />
            Log Flight
          </Button>
        </div>
      </div>

      <FlightTotals
        totals={flightsHook.totals}
        loading={flightsHook.loading}
        pilotColors={pilotColors}
      />

      {flightsHook.error && (
        <div
          className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm"
          style={{ borderRadius: RADIUS }}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div>{flightsHook.error}</div>
            <button onClick={flightsHook.refresh} className="text-xs underline">
              Try again
            </button>
          </div>
        </div>
      )}

      <FlightList
        flights={flightsHook.flights}
        destinations={destinationsHook.destinations}
        pilots={pilots}
        loading={flightsHook.loading}
        isAdmin={isAdmin}
        onDelete={flightsHook.deleteFlight}
      />

      {isAdmin && (
        <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
          <CollapsibleTrigger asChild>
            <button
              className="w-full flex items-center gap-2 px-4 py-3 bg-white text-sm text-[#4E5166] hover:bg-[#f8f8f8] transition-colors"
              style={{ border: BORDER, borderRadius: RADIUS }}
            >
              <Shield className="w-4 h-4" />
              <span className="font-medium">Admin</span>
              <span className="text-xs text-[#747274]">Destinations and export</span>
              <ChevronDown
                className={`w-4 h-4 ml-auto transition-transform ${adminOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <AdminPanel
              isAdmin={isAdmin}
              totals={flightsHook.totals}
              flights={flightsHook.flights}
              destinations={destinationsHook.destinations}
              onCreateDestination={destinationsHook.createDestination}
              onDeleteDestination={destinationsHook.deleteDestination}
              onExportCSV={flightsHook.exportCSV}
            />
          </CollapsibleContent>
        </Collapsible>
      )}

      {loggedInUser && (
        <AddFlightDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          currentUser={{ id: loggedInUser.id, name: loggedInUser.name }}
          pilots={pilots.map((p) => ({ id: p.id, name: p.name }))}
          isAdmin={isAdmin}
          destinations={destinationsHook.destinations}
          fetchLastReading={flightsHook.fetchLastReading}
          createFlight={flightsHook.createFlight}
        />
      )}
    </div>
  );
}
