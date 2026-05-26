import { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Plus, RefreshCw, AlertCircle, Wrench } from 'lucide-react';
import { useFlights } from './useFlights';
import { useDestinations } from './useDestinations';
import { useMaintenanceEvents } from './useMaintenanceEvents';
import { FlightList } from './FlightList';
import { AddFlightDialog } from './AddFlightDialog';
import { LogMaintenanceDialog } from './LogMaintenanceDialog';
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
  const maintenanceHook = useMaintenanceEvents();
  const [addOpen, setAddOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);

  // Normalize pilot IDs. The /users endpoint may return IDs with a "user:"
  // KV-key prefix (from PUT rewrites), while the flights table stores the
  // raw "user1"/"user2"/"user3". Strip the prefix so filter buttons and
  // color lookups in FlightList match flight rows.
  const pilots = useMemo(
    () =>
      users
        .filter((u) => u.userType !== 'spouse')
        .map((u) => ({
          id: u.id.startsWith('user:') ? u.id.slice(5) : u.id,
          name: u.name,
          color: u.color,
        })),
    [users]
  );

  const isAdmin = isAdminUser(loggedInUser);

  const handleLogClick = () => {
    if (!loggedInUser) {
      onRequestLogin();
      return;
    }
    setAddOpen(true);
  };

  const handleMaintClick = () => {
    if (!loggedInUser) {
      onRequestLogin();
      return;
    }
    setMaintOpen(true);
  };

  const handleMaintenanceSaved = () => {
    // After a maintenance event lands, refresh both flights (totals + delta
    // chain may shift) and maintenance events.
    flightsHook.refresh();
    maintenanceHook.refresh();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl text-[#4E5166]">Flight Log</h2>
        <p className="text-sm text-white">
          Track destinations and gauge readings against the 2/15/26 annual.
        </p>
      </div>

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
            maintenanceHook.refresh();
          }}
          disabled={flightsHook.loading}
          className="gap-2 h-10 border-[rgba(78,81,102,0.2)] text-[#4E5166] hover:bg-[#f8f8f8]"
        >
          <RefreshCw className={`w-4 h-4 ${flightsHook.loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button
          variant="outline"
          onClick={handleMaintClick}
          className="gap-2 h-10 border-[rgba(78,81,102,0.2)] text-[#4E5166] hover:bg-[#f8f8f8]"
        >
          <Wrench className="w-4 h-4" />
          Log Maintenance
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
        maintenanceEvents={maintenanceHook.events}
        destinations={destinationsHook.destinations}
        pilots={pilots}
        loading={flightsHook.loading || maintenanceHook.loading}
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
        <>
          <AddFlightDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            currentUser={{
              id: loggedInUser.id.startsWith('user:') ? loggedInUser.id.slice(5) : loggedInUser.id,
              name: loggedInUser.name,
            }}
            pilots={pilots.map((p) => ({ id: p.id, name: p.name }))}
            isAdmin={isAdmin}
            destinations={destinationsHook.destinations}
            fetchLastReading={flightsHook.fetchLastReading}
            createFlight={flightsHook.createFlight}
          />
          <LogMaintenanceDialog
            open={maintOpen}
            onOpenChange={setMaintOpen}
            currentUser={{
              id: loggedInUser.id.startsWith('user:') ? loggedInUser.id.slice(5) : loggedInUser.id,
              name: loggedInUser.name,
            }}
            oilSummary={flightsHook.totals?.oil_summary ?? null}
            onCreate={maintenanceHook.createEvent}
            onSaved={handleMaintenanceSaved}
          />
        </>
      )}
    </div>
  );
}
