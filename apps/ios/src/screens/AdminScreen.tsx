import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import {
  createDestination,
  deleteDestination,
  exportCSV,
  fetchDestinations,
  fetchOilSummary,
  fetchTotals,
} from '@av8/api';
import type { Destination, FlightTotals, OilSummary } from '@av8/api';
import { useAuth, isAdminSession } from '../auth/useAuth';
import { colors, font, radius, spacing } from '../theme';

export function AdminScreen() {
  const { session, logout } = useAuth();
  const admin = isAdminSession(session);

  const [oil, setOil] = useState<OilSummary | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [totals, setTotals] = useState<FlightTotals | null>(null);
  const [newIcao, setNewIcao] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [o, d, t] = await Promise.all([fetchOilSummary(), fetchDestinations(), fetchTotals()]);
      setOil(o);
      setDestinations(d);
      setTotals(t);
    } catch (err) {
      console.warn('AdminScreen load failed', err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    const icao = newIcao.trim().toUpperCase();
    if (icao.length < 3 || !newName.trim()) return;
    setBusy(true);
    try {
      await createDestination(icao, newName.trim());
      setNewIcao('');
      setNewName('');
      await load();
    } catch (err) {
      Alert.alert('Failed', err instanceof Error ? err.message : 'Could not add destination');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDest = (d: Destination) => {
    Alert.alert(
      `Remove ${d.icao}?`,
      `${d.name}\n\nPast flights to this airport keep their record.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDestination(d.id);
              await load();
            } catch (err) {
              Alert.alert('Failed', err instanceof Error ? err.message : 'Could not remove');
            }
          },
        },
      ]
    );
  };

  const handleExportCSV = async () => {
    try {
      const csv = await exportCSV();
      const path = `${FileSystem.cacheDirectory}n4368v-flights-${new Date().toISOString().slice(0, 10)}.csv`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/csv' });
      } else {
        Alert.alert('Saved', `CSV at ${path}`);
      }
    } catch (err) {
      Alert.alert('Export failed', err instanceof Error ? err.message : String(err));
    }
  };

  const handleExportPDF = async () => {
    if (!totals) return;
    const pilotRows = totals.by_pilot
      .map(
        (p) =>
          `<tr><td>${p.pilot_name}</td><td>${p.hobbs.toFixed(1)}</td><td>${p.tach.toFixed(1)}</td><td>${p.count}</td></tr>`
      )
      .join('');
    const html = `<!doctype html><html><head><meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, sans-serif; padding: 24px; color: #1a1a2e; }
        h1 { color: #0f2744; margin-bottom: 4px; }
        h2 { color: #4E5166; margin-top: 24px; font-size: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        td, th { border-bottom: 1px solid rgba(78,81,102,0.2); padding: 6px 4px; text-align: left; }
        .muted { color: #6b7280; font-size: 12px; }
      </style>
      </head><body>
      <h1>N4368V Flight Log Summary</h1>
      <div class="muted">Generated ${new Date().toLocaleString()}</div>

      <h2>Annual Baseline (${totals.annual_date})</h2>
      <div>Hobbs ${totals.annual_hobbs.toFixed(1)} · Tach ${totals.annual_tach.toFixed(1)}</div>

      <h2>Per Pilot — Since Annual</h2>
      <table><thead><tr><th>Pilot</th><th>Hobbs</th><th>Tach</th><th>Flights</th></tr></thead>
      <tbody>${pilotRows || '<tr><td colspan="4" class="muted">No flights yet</td></tr>'}</tbody></table>

      <h2>Combined</h2>
      <div>Since annual: H ${totals.since_annual_hobbs.toFixed(1)} · T ${totals.since_annual_tach.toFixed(1)}</div>
      <div>All time: H ${totals.total_hobbs.toFixed(1)} · T ${totals.total_tach.toFixed(1)}</div>

      <h2>Oil Status</h2>
      <div>Current Tach ${totals.current_tach.toFixed(1)} · Oil due Tach ${totals.oil_due_tach.toFixed(1)}</div>
      <div>${totals.tach_remaining.toFixed(1)} hr remaining</div>
      </body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
      } else {
        Alert.alert('Saved', `PDF at ${uri}`);
      }
    } catch (err) {
      Alert.alert('PDF failed', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Text style={styles.h1}>Admin</Text>

        <View style={styles.section}>
          <Text style={styles.h2}>Oil Summary</Text>
          {oil ? (
            <>
              <Text style={styles.muted}>Last oil change</Text>
              <Text style={styles.value}>
                {oil.last_oil_change
                  ? `${oil.last_oil_change.date} · Tach ${oil.last_oil_change.tach.toFixed(1)}`
                  : 'No oil change logged yet (using annual as baseline)'}
              </Text>
              <Text style={styles.muted}>Quarts added since change</Text>
              <Text style={styles.value}>{oil.quarts_added_since_change.toFixed(1)} qt</Text>
              <Text style={styles.muted}>Hours since change</Text>
              <Text style={styles.value}>{oil.hobbs_since_change.toFixed(1)} hr</Text>
              <Text style={styles.muted}>Oil due at</Text>
              <Text style={styles.value}>Tach {oil.oil_due_tach.toFixed(1)}  ({oil.tach_remaining.toFixed(1)} hr remaining)</Text>
            </>
          ) : (
            <Text style={styles.muted}>Loading…</Text>
          )}
        </View>

        {admin && (
          <>
            <View style={styles.section}>
              <Text style={styles.h2}>Destinations</Text>
              {destinations.map((d) => (
                <View key={d.id} style={styles.destRow}>
                  <Text style={styles.destIcao}>{d.icao}</Text>
                  <Text style={styles.destName}>{d.name}</Text>
                  <Pressable onPress={() => handleDeleteDest(d)}>
                    <Text style={{ color: colors.red }}>Remove</Text>
                  </Pressable>
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                <TextInput
                  value={newIcao}
                  onChangeText={(v) => setNewIcao(v.toUpperCase().slice(0, 4))}
                  placeholder="KSEA"
                  autoCapitalize="characters"
                  style={[styles.input, { flex: 1 }]}
                />
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Seattle"
                  style={[styles.input, { flex: 2 }]}
                />
                <Pressable
                  onPress={handleAdd}
                  disabled={busy || newIcao.length < 3 || !newName.trim()}
                  style={[styles.btnSm, styles.btnPrimary, {
                    opacity: busy || newIcao.length < 3 || !newName.trim() ? 0.4 : 1,
                  }]}
                >
                  <Text style={[styles.btnTxt, { color: '#ffffff' }]}>Add</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.h2}>Export</Text>
              <Pressable onPress={handleExportCSV} style={styles.btn}>
                <Text style={styles.btnTxt}>Download CSV</Text>
              </Pressable>
              <Pressable onPress={handleExportPDF} style={styles.btn}>
                <Text style={styles.btnTxt}>Download PDF Summary</Text>
              </Pressable>
            </View>
          </>
        )}

        <View style={styles.section}>
          <Text style={styles.h2}>Account</Text>
          <Text style={styles.muted}>Signed in as</Text>
          <Text style={styles.value}>{session?.name ?? '—'}</Text>
          <Pressable onPress={logout} style={[styles.btn, { borderColor: colors.red }]}>
            <Text style={[styles.btnTxt, { color: colors.red }]}>Logout</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '700', color: colors.text },
  h2: { fontSize: font.pageTitle, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  section: {
    padding: spacing.lg, backgroundColor: colors.bg, borderColor: colors.border,
    borderWidth: 1, borderRadius: radius.card, gap: 2,
  },
  muted: { color: colors.muted, fontSize: font.label, marginTop: spacing.sm },
  value: { color: colors.text, fontSize: font.body, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.bgAlt, borderRadius: radius.button,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderColor: colors.border, borderWidth: 1, fontSize: font.body,
  },
  btn: {
    marginTop: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    borderRadius: radius.button, borderColor: colors.border, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  btnSm: {
    paddingHorizontal: spacing.md, justifyContent: 'center',
    borderRadius: radius.button, borderColor: colors.border, borderWidth: 1,
  },
  btnPrimary: { backgroundColor: colors.navyAlt, borderColor: colors.navyAlt },
  btnTxt: { color: colors.text, fontSize: font.body, fontWeight: '500' },
  destRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomColor: colors.border, borderBottomWidth: 1,
  },
  destIcao: { fontFamily: 'Menlo', color: colors.navyAlt, width: 60 },
  destName: { flex: 1, color: colors.text },
});
