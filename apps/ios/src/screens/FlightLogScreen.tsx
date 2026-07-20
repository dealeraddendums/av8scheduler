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
  useWindowDimensions,
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

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function oilColor(remaining: number): string {
  if (remaining < 10) return colors.red;
  if (remaining < 25) return colors.amber;
  return colors.green;
}

export function FlightLogScreen() {
  const { session, pilots } = useAuth();
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

  const firstName = (session?.name ?? 'Pilot').split(' ')[0];

  // On wide screens (iPad, landscape) keep content in a readable centered
  // column instead of stretching edge to edge.
  const { width } = useWindowDimensions();
  const padH = width >= 700 ? Math.max(spacing.lg, (width - 640) / 2) : spacing.lg;
  const wide = { paddingHorizontal: padH };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.navyAlt} />
        </View>
      </SafeAreaView>
    );
  }

  const oilRemaining = totals?.oil_summary.tach_remaining ?? null;

  return (
    <View style={styles.root}>
      {/* Hero */}
      <SafeAreaView edges={['top']} style={styles.hero}>
        <View style={[styles.heroInner, wide]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroGreeting}>
              {greeting()}, {firstName}
            </Text>
            <Text style={styles.heroPlane}>N4368V · 1984 Piper Archer II</Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('AddFlightModal')}
            style={styles.heroCta}
          >
            <Text style={styles.heroCtaTxt}>✈️  Log Flight</Text>
          </Pressable>
        </View>

        {/* Floating stat tiles */}
        <View style={[styles.tileRow, wide]}>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>
              {totals ? totals.since_annual_hobbs.toFixed(1) : '—'}
            </Text>
            <Text style={styles.tileLabel}>Hobbs since annual</Text>
          </View>
          <View style={styles.tile}>
            <Text
              style={[
                styles.tileValue,
                oilRemaining !== null && { color: oilColor(oilRemaining) },
              ]}
            >
              {oilRemaining !== null ? oilRemaining.toFixed(1) : '—'}
            </Text>
            <Text style={styles.tileLabel}>Oil hrs left</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{flights.length}</Text>
            <Text style={styles.tileLabel}>Flights logged</Text>
          </View>
        </View>
      </SafeAreaView>

      {queueCount > 0 && (
        <View style={styles.queueBanner}>
          <Text style={styles.queueTxt}>{queueCount} pending sync</Text>
        </View>
      )}

      {/* Activity */}
      <View style={[styles.activityHeader, wide]}>
        <Text style={styles.activityTitle}>Recent Activity</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}
        >
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
      </View>

      <FlatList
        data={visible}
        keyExtractor={(it) => (it.kind === 'flight' ? `f-${it.data.id}` : `m-${it.data.id}`)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[styles.listContent, wide, visible.length === 0 && styles.empty]}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyGlyph}>✈️</Text>
            <Text style={styles.emptyTxt}>No flights yet</Text>
            <Text style={styles.emptySub}>Tap “Log Flight” after your next trip.</Text>
          </View>
        )}
        renderItem={({ item }) => {
          if (item.kind === 'flight') {
            const f = item.data;
            return (
              <Pressable
                style={styles.card}
                onPress={() => navigation.navigate('FlightDetail', { id: f.id })}
              >
                <View style={[styles.pilotStripe, { backgroundColor: pilotColorFor(f.pilot_id, pilots) }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTopLine}>
                    <Text style={styles.icao}>{f.destination.toUpperCase()}</Text>
                    <Text style={styles.rowDate}>{shortDate(f.date)}</Text>
                  </View>
                  <Text style={styles.rowMuted}>
                    {f.pilot_name} · +{Number(f.hobbs_used ?? 0).toFixed(1)} Hobbs · +{Number(f.tach_used ?? 0).toFixed(1)} Tach
                    {Number(f.oil_added_qts ?? 0) > 0 && `  · +${Number(f.oil_added_qts).toFixed(1)} qt oil`}
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
            <View style={styles.card}>
              <View style={[styles.pilotStripe, { backgroundColor: accent }]} />
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
    </View>
  );
}

const TILE_OVERLAP = 34;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgAlt },
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hero: {
    backgroundColor: colors.navy,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingBottom: TILE_OVERLAP + spacing.md,
    marginBottom: -TILE_OVERLAP,
  },
  heroInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  heroGreeting: { color: '#ffffff', fontSize: 24, fontWeight: '700' },
  heroPlane: { color: colors.blueGray, fontSize: font.label, marginTop: 4, letterSpacing: 0.5 },
  heroCta: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  heroCtaTxt: { color: '#ffffff', fontSize: font.body, fontWeight: '600' },

  tileRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    transform: [{ translateY: TILE_OVERLAP }],
  },
  tile: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.card + 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    shadowColor: '#0f2744',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  tileValue: { fontSize: 20, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  tileLabel: { fontSize: 11, color: colors.muted, marginTop: 2, textAlign: 'center' },

  queueBanner: {
    backgroundColor: colors.amber,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: TILE_OVERLAP,
  },
  queueTxt: { color: '#ffffff', fontSize: font.body, fontWeight: '500' },

  activityHeader: {
    marginTop: TILE_OVERLAP + spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  activityTitle: { fontSize: font.pageTitle, fontWeight: '600', color: colors.text },

  filterScroll: { flexGrow: 0 },
  filterRow: { gap: spacing.sm, paddingBottom: spacing.sm, alignItems: 'center' },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  filterChipActive: { backgroundColor: colors.navyAlt, borderColor: colors.navyAlt },
  filterTxt: { color: colors.text, fontSize: 13 },
  filterTxtActive: { color: '#ffffff' },

  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, paddingTop: spacing.xs },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    paddingLeft: 0,
    marginBottom: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.card + 2,
    overflow: 'hidden',
    shadowColor: '#0f2744',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pilotStripe: { alignSelf: 'stretch', width: 4, borderRadius: 2 },
  rowTopLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  icao: { fontSize: font.body, fontWeight: '600', color: colors.navyAlt, fontFamily: 'Menlo' },
  rowDate: { fontSize: font.label, color: colors.muted },
  rowMuted: { fontSize: font.label, color: colors.muted, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowEndVal: { fontSize: font.body, color: colors.navyAlt, fontVariant: ['tabular-nums'] },
  rowEndLabel: { fontSize: 10, color: colors.muted, textTransform: 'uppercase' },
  mIcon: { fontSize: 16, width: 16, marginLeft: spacing.sm },
  mLabel: { fontWeight: '500' },

  empty: { padding: spacing.xl, alignItems: 'center', justifyContent: 'center', flex: 1 },
  emptyGlyph: { fontSize: 40, marginBottom: spacing.sm },
  emptyTxt: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  emptySub: { color: colors.muted, fontSize: font.label, marginTop: 2 },
});
