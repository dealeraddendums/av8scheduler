import type { Flight } from '@av8/api';

// ForeFlight Logbook CSV export (matches the official ForeFlight import
// template: header marker row, Aircraft Table, Flights Table).
// Docs: plan.foreflight.com → Logbook → Import.

const TAIL = 'N4368V';
const HOME_AIRPORT = 'KORS';

const AIRCRAFT_HEADERS = [
  'AircraftID', 'equipType', 'TypeCode', 'Year', 'Make', 'Model',
  'GearType', 'EngineType', 'Category/Class',
  'complexAircraft', 'highPerformance', 'pressurized', 'taa',
];

const AIRCRAFT_TYPES = [
  'Text', 'Text', 'Text', 'YYYY', 'Text', 'Text',
  'Text', 'Text', 'Text',
  'Boolean', 'Boolean', 'Boolean', 'Boolean',
];

// 1984 Piper Archer II
const AIRCRAFT_ROW = [
  TAIL, 'Aircraft', 'P28A', '1984', 'Piper', 'PA-28-181',
  'FT', 'Piston', 'airplane_single_engine_land',
  'FALSE', '', '', '',
];

const FLIGHT_HEADERS = [
  'Date', 'AircraftID', 'From', 'To', 'Route',
  'TimeOut', 'TimeOff', 'TimeOn', 'TimeIn', 'OnDuty', 'OffDuty',
  'TotalTime', 'PIC', 'SIC', 'Night', 'Solo', 'CrossCountry',
  'PICUS', 'MultiPilot', 'IFR', 'Examiner', 'NVG', 'NVGOps', 'Distance',
  'Takeoff Day', 'Takeoff Night',
  'Landing Full-Stop Day', 'Landing Full-Stop Night',
  'Landing Touch-and-Go Day', 'Landing Touch-and-Go Night',
  'ActualInstrument', 'SimulatedInstrument',
  'GroundTraining', 'GroundTrainingGiven',
  'HobbsStart', 'HobbsEnd', 'TachStart', 'TachEnd', 'Holds',
  'Approach1', 'Approach2', 'Approach3', 'Approach4', 'Approach5', 'Approach6',
  'DualGiven', 'DualReceived', 'SimulatedFlight',
  'InstructorName', 'InstructorComments',
  'Person1', 'Person2', 'Person3', 'Person4', 'Person5', 'Person6',
  'PilotComments',
  'Flight Review', 'IPC', 'Checkride', 'FAA 61.58', 'NVG Proficiency',
  '[Text]CustomFieldName', '[Numeric]CustomFieldName', '[Hours]CustomFieldName',
  '[Counter]CustomFieldName', '[Date]CustomFieldName', '[DateTime]CustomFieldName',
  '[Toggle]CustomFieldName',
];

const FLIGHT_TYPES = [
  'Date', 'Text', 'Text', 'Text', 'Text',
  'HH:MM', 'HH:MM', 'HH:MM', 'HH:MM', 'HH:MM', 'HH:MM',
  'Decimal or HH:MM', 'Decimal or HH:MM', 'Decimal or HH:MM', 'Decimal or HH:MM',
  'Decimal or HH:MM', 'Decimal or HH:MM', 'Decimal or HH:MM', 'Decimal or HH:MM',
  'Decimal or HH:MM', 'Decimal or HH:MM', 'Decimal or HH:MM', 'Number', 'Decimal',
  'Number', 'Number', 'Number', 'Number', 'Number', 'Number',
  'Decimal or HH:MM', 'Decimal or HH:MM', 'Decimal or HH:MM', 'Decimal or HH:MM',
  'Decimal', 'Decimal', 'Decimal', 'Decimal', 'Number',
  'Packed Detail', 'Packed Detail', 'Packed Detail',
  'Packed Detail', 'Packed Detail', 'Packed Detail',
  'Decimal or HH:MM', 'Decimal or HH:MM', 'Decimal or HH:MM',
  'Text', 'Text',
  'Packed Detail', 'Packed Detail', 'Packed Detail',
  'Packed Detail', 'Packed Detail', 'Packed Detail',
  'Text',
  'Boolean', 'Boolean', 'Boolean', 'Boolean', 'Boolean',
  'Text', 'Decimal', 'Decimal or HH:MM', 'Number', 'Date', 'DateTime', 'Boolean',
];

const WIDTH = FLIGHT_HEADERS.length;

function esc(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(cells: string[]): string {
  const padded = [...cells];
  while (padded.length < WIDTH) padded.push('');
  return padded.map(esc).join(',');
}

function num1(v: number): string {
  return (Math.round(v * 10) / 10).toFixed(1);
}

function flightRow(f: Flight): string {
  const hobbsEnd = Number(f.hobbs_end);
  const tachEnd = Number(f.tach_end);
  const hobbsUsed = f.hobbs_used === null ? null : Number(f.hobbs_used);
  const tachUsed = f.tach_used === null ? null : Number(f.tach_used);

  // Round trip: KORS → destination → KORS. Hobbs = flight duration, pilot is PIC,
  // 2 day takeoffs + 2 day full-stop landings per flight.
  const cells = new Array<string>(WIDTH).fill('');
  cells[0] = f.date;                                           // Date
  cells[1] = TAIL;                                             // AircraftID
  cells[2] = HOME_AIRPORT;                                     // From
  cells[3] = HOME_AIRPORT;                                     // To (round trip)
  cells[4] = (f.destination || '').toUpperCase();              // Route (turnaround point)
  cells[11] = hobbsUsed !== null ? num1(hobbsUsed) : '';       // TotalTime (Hobbs)
  cells[12] = hobbsUsed !== null ? num1(hobbsUsed) : '';       // PIC
  cells[24] = '2';                                             // Takeoff Day
  cells[26] = '2';                                             // Landing Full-Stop Day
  cells[34] = hobbsUsed !== null ? num1(hobbsEnd - hobbsUsed) : ''; // HobbsStart
  cells[35] = num1(hobbsEnd);                                  // HobbsEnd
  cells[36] = tachUsed !== null ? num1(tachEnd - tachUsed) : ''; // TachStart
  cells[37] = num1(tachEnd);                                   // TachEnd
  cells[56] = f.notes ?? '';                                   // PilotComments
  return cells.map(esc).join(',');
}

export function buildForeFlightCsv(flights: Flight[]): string {
  const lines: string[] = [];
  lines.push(row([
    'ForeFlight Logbook Import',
    'This row is required for importing into ForeFlight. Do not delete or modify.',
  ]));
  lines.push(row([]));
  lines.push(row(['Aircraft Table']));
  lines.push(row(AIRCRAFT_TYPES));
  lines.push(row(AIRCRAFT_HEADERS));
  lines.push(row(AIRCRAFT_ROW));
  lines.push(row([]));
  lines.push(row(['Flights Table']));
  lines.push(row(FLIGHT_TYPES));
  lines.push(row(FLIGHT_HEADERS));

  const sorted = [...flights].sort((a, b) =>
    a.date === b.date
      ? (a.created_at ?? '').localeCompare(b.created_at ?? '')
      : a.date.localeCompare(b.date)
  );
  for (const f of sorted) lines.push(flightRow(f));

  return lines.join('\n');
}

export interface ForeFlightExportOptions {
  pilotId: string;
  pilotName: string;
  startDate?: string; // YYYY-MM-DD inclusive
  endDate?: string;   // YYYY-MM-DD inclusive
}

/** Filters flights, builds the CSV, and triggers a browser download.
 *  Returns the number of flights exported. */
export function downloadForeFlightCsv(
  allFlights: Flight[],
  opts: ForeFlightExportOptions
): number {
  const filtered = allFlights.filter((f) => {
    if (f.pilot_id !== opts.pilotId) return false;
    if (opts.startDate && f.date < opts.startDate) return false;
    if (opts.endDate && f.date > opts.endDate) return false;
    return true;
  });

  if (filtered.length === 0) return 0;

  const csv = buildForeFlightCsv(filtered);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const pilotSlug = opts.pilotName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  a.download = `foreflight-${TAIL.toLowerCase()}-${pilotSlug}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filtered.length;
}
