import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { createMaintenanceEvent, fetchOilSummary } from '@av8/api';
import type { NewMaintenanceInput, OilSummary } from '@av8/api';
import { useAuth } from '../auth/useAuth';
import { enqueueMaintenance } from '../utils/offlineQueue';
import { colors, font, radius, spacing } from '../theme';

interface Props {
  navigation: { goBack: () => void };
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nextAnnualIso(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  if (!y || !m) return iso;
  const d = new Date(y + 1, m, 0);
  return `${y + 1}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const OIL_INTERVAL = 50;

export function LogMaintenanceModal({ navigation }: Props) {
  const { session } = useAuth();
  const [modeIdx, setModeIdx] = useState(0); // 0 = oil_change, 1 = annual
  const mode: 'oil_change' | 'annual' = modeIdx === 0 ? 'oil_change' : 'annual';

  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [tach, setTach] = useState('');
  const [hobbs, setHobbs] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oil, setOil] = useState<OilSummary | null>(null);

  useEffect(() => {
    fetchOilSummary().then(setOil).catch(() => undefined);
  }, []);

  const tachNum = tach ? Number(tach) : null;
  const hobbsNum = hobbs ? Number(hobbs) : null;
  const canSave = tachNum !== null && (mode === 'oil_change' || hobbsNum !== null) && !submitting && !!session;

  const handleSave = async () => {
    if (!canSave || !session || tachNum === null) return;
    setSubmitting(true);
    const payload: NewMaintenanceInput = {
      type: mode,
      pilot_id: session.id,
      pilot_name: session.name,
      date: toIso(date),
      tach_reading: tachNum,
      hobbs_reading: mode === 'annual' ? hobbsNum : hobbsNum ?? null,
      notes: notes.trim() || null,
    };
    try {
      await createMaintenanceEvent(payload);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (err) {
      await enqueueMaintenance(payload);
      Alert.alert('Saved offline', 'Will sync when network returns.');
      navigation.goBack();
    } finally {
      setSubmitting(false);
    }
  };

  const nextOilDue = tachNum !== null ? (tachNum + OIL_INTERVAL).toFixed(1) : '—';
  const annualPreview = nextAnnualIso(toIso(date));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.headerBar}>
        <Pressable onPress={navigation.goBack}><Text style={styles.cancel}>Cancel</Text></Pressable>
        <Text style={styles.title}>Log Maintenance</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <SegmentedControl
          values={['Oil Change', 'Annual']}
          selectedIndex={modeIdx}
          onChange={(e) => setModeIdx(e.nativeEvent.selectedSegmentIndex)}
        />

        <Text style={styles.label}>Date</Text>
        <Pressable onPress={() => setShowDate(true)} style={styles.btn}>
          <Text style={styles.btnTxt}>
            {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        </Pressable>
        {showDate && (
          <DateTimePicker
            value={date}
            mode="date"
            display="inline"
            onChange={(_, picked) => {
              setShowDate(false);
              if (picked) setDate(picked);
            }}
          />
        )}

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Tach reading</Text>
            <TextInput
              value={tach}
              onChangeText={setTach}
              placeholder="631.1"
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>
              Hobbs reading {mode === 'annual' && <Text style={{ color: colors.red }}>*</Text>}
            </Text>
            <TextInput
              value={hobbs}
              onChangeText={setHobbs}
              placeholder={mode === 'annual' ? 'required' : 'optional'}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
        </View>

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder={mode === 'oil_change' ? 'Aeroshell 15W-50, filter changed' : 'Squawks fixed, new A&P'}
          multiline
          numberOfLines={2}
          style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
        />

        <View style={styles.preview}>
          {mode === 'oil_change' ? (
            <>
              <Text style={styles.previewLine}>Oil due will reset to Tach <Text style={styles.bold}>{nextOilDue}</Text></Text>
              <Text style={styles.muted}>Qts added since last change: {oil?.quarts_added_since_change.toFixed(1) ?? '0.0'}</Text>
              <Text style={styles.muted}>Hobbs since last change: {oil?.hobbs_since_change.toFixed(1) ?? '0.0'}</Text>
            </>
          ) : (
            <>
              <Text style={styles.previewLine}>
                Annual baseline will reset to Hobbs <Text style={styles.bold}>{hobbsNum?.toFixed(1) ?? '—'}</Text> · Tach <Text style={styles.bold}>{tachNum?.toFixed(1) ?? '—'}</Text>
              </Text>
              <Text style={styles.muted}>Next annual: {annualPreview}</Text>
              <Text style={styles.muted}>Oil due also resets to Tach {nextOilDue}</Text>
            </>
          )}
        </View>

        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={[styles.btn, styles.btnPrimary, { opacity: canSave ? 1 : 0.5 }]}
        >
          <Text style={[styles.btnTxt, { color: '#ffffff' }]}>
            {submitting ? 'Saving…' : mode === 'oil_change' ? 'Save Oil Change' : 'Save Annual'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomColor: colors.border, borderBottomWidth: 1,
  },
  cancel: { color: colors.navyAlt, fontSize: font.body },
  title: { color: colors.text, fontSize: font.pageTitle, fontWeight: '600' },
  label: { color: colors.muted, fontSize: font.label, textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.bgAlt, borderRadius: radius.button, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2, fontSize: font.body, color: colors.text,
    borderColor: colors.border, borderWidth: 1, marginTop: spacing.xs,
  },
  btn: {
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg, borderRadius: radius.button,
    borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: colors.navyAlt, borderColor: colors.navyAlt },
  btnTxt: { color: colors.text, fontSize: font.body, fontWeight: '500' },
  preview: { padding: spacing.md, backgroundColor: colors.bgAlt, borderRadius: radius.button, borderColor: colors.border, borderWidth: 1, gap: 2 },
  previewLine: { color: colors.text, fontSize: font.body },
  muted: { color: colors.muted, fontSize: font.label },
  bold: { fontWeight: '600' },
});
