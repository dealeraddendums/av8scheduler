import { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Plus, RefreshCw, AlertCircle } from 'lucide-react';
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

  const pilots = useMemo(
    () =>
      users
        .filter((u) => u.userType !== 'spouse')
        .map((u) => ({ id: u.id, name: u.name, color: u.color })),
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
      <div>
        <h2 className="text-xl text-[#4E5166]">Flight Log</h2>
        <p className="text-sm text-white">
          Track destinations and gauge readings against the 2/15/26 annual.
        </p>
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

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            flightsHook.refresh();
            destinationsHook.refresh();
          }}
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
          Add Flight
        </Button>
      </div>

      <FlightList
        flights={flightsHook.flights}
        destinations={destinationsHook.destinations}
        pilots={pilots}
        loading={flightsHook.loading}
        isAdmin={isAdmin}
        onDelete={flightsHook.deleteFlight}
      />

      <AdminPanel
        isAdmin={isAdmin}
        totals={flightsHook.totals}
        flights={flightsHook.flights}
        destinations={destinationsHook.destinations}
        pilots={pilots.map((p) => ({ id: p.id, name: p.name }))}
        onCreateDestination={destinationsHook.createDestination}
        onDeleteDestination={destinationsHook.deleteDestination}
        onCreateFlight={flightsHook.createFlight}
        onDeleteFlight={flightsHook.deleteFlight}
        onExportCSV={flightsHook.exportCSV}
      />

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
