import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  fetchFlights,
  fetchMaintenanceEvents,
  fetchTotals,
} from '@av8/api';
import type {
  Flight,
  FlightTotals,
  MaintenanceEvent,
  ScheduleUser,
} from '@av8/api';
import { useAuth } from '../auth/useAuth';
import { useOfflineQueueCount } from '../utils/offlineQueue';
import { colors, font, radius, spacing } from '../theme';

const ALL = '__all__';

type ListItem =
  | { kind: 'flight'; date: string; createdAt: string; data: Flight }
  | { kind: 'maintenance'; date: string; createdAt: string; data: MaintenanceEvent };

function pilotColorFor(id: string, pilots: ScheduleUser[]): string {
  const u = pilots.find((p) => p.id === id);
  return u?.color ?? colors.charcoal;
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function FlightLogScreen() {
  const { pilots } = useAuth();
  const navigation = useNavigation<any>();
  const queueCount = useOfflineQueueCount();

  const [flights, setFlights] = useState<Flight[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceEvent[]>([]);
  const [totals, setTotals] = useState<FlightTotals | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>(ALL);

  const load = useCallback(async () => {
    try {
      const [f, m, t] = await Promise.all([
        fetchFlights(),
        fetchMaintenanceEvents(),
        fetchTotals(),
      ]);
      setFlights(f);
      setMaintenance(m);
      setTotals(t);
    } catch (err) {
      console.warn('FlightLogScreen load failed', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const merged = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [
      ...flights.map<ListItem>((f) => ({ kind: 'flight', date: f.date, createdAt: f.created_at, data: f })),
      ...maintenance.map<ListItem>((e) => ({ kind: 'maintenance', date: e.date, createdAt: e.created_at, data: e })),
    ];
    return items.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
  }, [flights, maintenance]);

  const visible = useMemo(() => {
    if (filter === ALL) return merged;
    return merged.filter((it) => (it.kind === 'flight' ? it.data.pilot_id : it.data.pilot_id) === filter);
  }, [merged, filter]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.navyAlt} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {queueCount > 0 && (
        <View style={styles.queueBanner}>
          <Text style={styles.queueTxt}>{queueCount} pending sync</Text>
        </View>
      )}

      {totals && (
        <View style={styles.statsCard}>
          <Text style={styles.statsLabel}>SINCE ANNUAL</Text>
          <Text style={styles.statsValue}>
            {totals.since_annual_hobbs.toFixed(1)}  Hobbs · {totals.since_annual_tach.toFixed(1)} Tach
          </Text>
          <Text style={styles.statsMuted}>
            Oil {totals.oil_summary.tach_remaining.toFixed(1)} hrs remaining
          </Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {[{ id: ALL, name: 'All' }, ...pilots.map((p) => ({ id: p.id, name: p.name }))].map((p) => {
          const active = filter === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setFilter(p.id)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterTxt, active && styles.filterTxtActive]}>{p.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={visible}
        keyExtractor={(it) => (it.kind === 'flight' ? `f-${it.data.id}` : `m-${it.data.id}`)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={visible.length === 0 ? styles.empty : undefined}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyTxt}>No flights logged yet</Text>
          </View>
        )}
        renderItem={({ item }) => {
          if (item.kind === 'flight') {
            const f = item.data;
            return (
              <Pressable
                style={styles.row}
                onPress={() => navigation.navigate('FlightDetail', { id: f.id })}
              >
                <View style={[styles.pilotDot, { backgroundColor: pilotColorFor(f.pilot_id, pilots) }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTopLine}>
                    <Text style={styles.icao}>{f.destination.toUpperCase()}</Text>
                    <Text style={styles.rowDate}>{shortDate(f.date)}</Text>
                  </View>
                  <Text style={styles.rowMuted}>
                    +{Number(f.hobbs_used ?? 0).toFixed(1)} H · +{Number(f.tach_used ?? 0).toFixed(1)} T
                    {Number(f.oil_added_qts ?? 0) > 0 && `  · +${Number(f.oil_added_qts).toFixed(1)} qt`}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowEndVal}>{Number(f.hobbs_end).toFixed(1)}</Text>
                  <Text style={styles.rowEndLabel}>Hobbs</Text>
                </View>
              </Pressable>
            );
          }
          const e = item.data;
          const isOil = e.type === 'oil_change';
          const accent = isOil ? colors.amber : colors.navyAlt;
          return (
            <View style={[styles.row, { borderLeftWidth: 2, borderLeftColor: accent }]}>
              <Text style={[styles.mIcon, { color: accent }]}>{isOil ? '🛢' : '🛡'}</Text>
              <View style={{ flex: 1 }}>
                <View style={styles.rowTopLine}>
                  <Text style={[styles.mLabel, { color: accent }]}>
                    {isOil ? 'Oil Change' : 'Annual Inspection'}
                  </Text>
                  <Text style={styles.rowDate}>{shortDate(e.date)}</Text>
                </View>
                <Text style={styles.rowMuted}>{e.pilot_name}</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={[styles.rowEndVal, { color: accent }]}>
                  {Number(e.tach_reading).toFixed(1)}
                </Text>
                <Text style={styles.rowEndLabel}>Tach</Text>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  queueBanner: { backgroundColor: colors.amber, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  queueTxt: { color: '#ffffff', fontSize: font.body, fontWeight: '500' },

  statsCard: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
  },
  statsLabel: { color: colors.muted, fontSize: font.label, letterSpacing: 1 },
  statsValue: { color: colors.text, fontSize: 22, fontWeight: '600', marginTop: spacing.xs },
  statsMuted: { color: colors.muted, fontSize: font.label, marginTop: spacing.xs },

  filterRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.navyAlt, borderColor: colors.navyAlt },
  filterTxt: { color: colors.text, fontSize: 13 },
  filterTxtActive: { color: '#ffffff' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    backgroundColor: colors.bg,
  },
  pilotDot: { width: 12, height: 12, borderRadius: radius.pilotDot },
  rowTopLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  icao: { fontSize: font.body, fontWeight: '600', color: colors.navyAlt, fontFamily: 'Menlo' },
  rowDate: { fontSize: font.label, color: colors.muted },
  rowMuted: { fontSize: font.label, color: colors.muted, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowEndVal: { fontSize: font.body, color: colors.navyAlt, fontVariant: ['tabular-nums'] },
  rowEndLabel: { fontSize: 10, color: colors.muted, textTransform: 'uppercase' },
  mIcon: { fontSize: 16, width: 12 },
  mLabel: { fontWeight: '500' },

  empty: { padding: spacing.xl, alignItems: 'center', justifyContent: 'center', flex: 1 },
  emptyTxt: { color: colors.muted, fontSize: font.body },
});
