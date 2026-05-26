import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  createFlight,
  fetchDestinations,
  fetchLastReading,
  readGauges,
} from '@av8/api';
import type { Destination, GaugeReading, LastReading, NewFlightInput } from '@av8/api';
import { useAuth, isAdminSession } from '../auth/useAuth';
import { enqueueFlight } from '../utils/offlineQueue';
import { colors, font, radius, spacing } from '../theme';

interface Props {
  navigation: { goBack: () => void; navigate: (name: string) => void };
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function AddFlightModal({ navigation }: Props) {
  const { session, pilots } = useAuth();
  const admin = isAdminSession(session);

  const [step, setStep] = useState(1);
  const [pilotId, setPilotId] = useState(session?.id ?? '');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [destination, setDestination] = useState('');
  const [otherIcao, setOtherIcao] = useState('');
  const [showOther, setShowOther] = useState(false);
  const [hobbsEnd, setHobbsEnd] = useState('');
  const [tachEnd, setTachEnd] = useState('');
  const [aiConfidence, setAiConfidence] = useState<'high' | 'low' | null>(null);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [notes, setNotes] = useState('');
  const [oilAdded, setOilAdded] = useState(false);
  const [lastReading, setLastReading] = useState<LastReading | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDestinations().then(setDestinations).catch(() => undefined);
    fetchLastReading().then(setLastReading).catch(() => undefined);
  }, []);

  const pilot = useMemo(
    () => pilots.find((p) => p.id === pilotId) ?? (session ? { id: session.id, name: session.name } : null),
    [pilotId, pilots, session]
  );

  const effectiveDestination = (showOther ? otherIcao.trim().toUpperCase() : destination).toUpperCase();
  const validDestination = /^[A-Z0-9]{3,5}$/.test(effectiveDestination);
  const hobbsNum = hobbsEnd ? Number(hobbsEnd) : null;
  const tachNum = tachEnd ? Number(tachEnd) : null;
  const canSubmit = pilot && validDestination && hobbsNum !== null && tachNum !== null && !submitting;

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access', 'Allow camera in Settings to use AI gauge reading.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    setReadingPhoto(true);
    setAiConfidence(null);
    try {
      const reading: GaugeReading = await readGauges(result.assets[0].base64, 'image/jpeg');
      if (reading.hobbs !== null) setHobbsEnd(String(reading.hobbs));
      if (reading.tach !== null) setTachEnd(String(reading.tach));
      setAiConfidence(reading.confidence);
    } catch (err) {
      Alert.alert('AI read failed', err instanceof Error ? err.message : 'Try entering values manually.');
    } finally {
      setReadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!canSubmit || !pilot || hobbsNum === null || tachNum === null) return;
    setSubmitting(true);
    const payload: NewFlightInput = {
      pilot_id: pilot.id,
      pilot_name: pilot.name,
      date: toIso(date),
      destination: effectiveDestination,
      hobbs_end: hobbsNum,
      tach_end: tachNum,
      notes: notes.trim() || null,
      oil_added_qts: oilAdded ? 1 : 0,
    };
    try {
      await createFlight(payload);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (err) {
      await enqueueFlight(payload);
      Alert.alert('Saved offline', 'Will sync when the network returns.');
      navigation.goBack();
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <>
      <Text style={styles.label}>Pilot</Text>
      {admin && pilots.length > 1 ? (
        <View style={styles.pilotChips}>
          {pilots.map((p) => {
            const active = p.id === pilotId;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPilotId(p.id)}
                style={[styles.pilotChip, active && styles.pilotChipActive]}
              >
                <View style={[styles.pilotChipDot, { backgroundColor: p.color }]} />
                <Text style={[styles.pilotChipTxt, active && styles.pilotChipTxtActive]}>{p.name}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.readonlyChip}>
          <Text style={styles.readonlyTxt}>{pilot?.name ?? '—'}</Text>
        </View>
      )}

      <Text style={[styles.label, { marginTop: spacing.lg }]}>Date</Text>
      <Pressable onPress={() => setShowDatePicker(true)} style={styles.btn}>
        <Text style={styles.btnTxt}>
          {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </Text>
      </Pressable>
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="inline"
          onChange={(_, picked) => {
            setShowDatePicker(false);
            if (picked) setDate(picked);
          }}
        />
      )}

      <Text style={[styles.label, { marginTop: spacing.lg }]}>Destination</Text>
      <View style={styles.destGrid}>
        {destinations.map((d) => {
          const active = !showOther && destination === d.icao;
          return (
            <Pressable
              key={d.id}
              onPress={() => {
                setShowOther(false);
                setDestination(d.icao);
              }}
              style={[styles.destCell, active && styles.destCellActive]}
            >
              <Text style={styles.destIcao}>{d.icao}</Text>
              <Text style={styles.destName}>{d.name}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            setShowOther(true);
            setDestination('');
          }}
          style={[styles.destCell, showOther && styles.destCellActive]}
        >
          <Text style={styles.destIcao}>Other</Text>
          <Text style={styles.destName}>Type ICAO</Text>
        </Pressable>
      </View>
      {showOther && (
        <TextInput
          value={otherIcao}
          onChangeText={(v) => setOtherIcao(v.toUpperCase().slice(0, 5))}
          placeholder="ICAO (e.g. KSEA)"
          autoCapitalize="characters"
          style={styles.input}
        />
      )}
    </>
  );

  const renderStep2 = () => (
    <>
      <Text style={styles.label}>Capture gauge photo</Text>
      <Pressable onPress={handleTakePhoto} disabled={readingPhoto} style={[styles.btn, styles.btnPrimary]}>
        {readingPhoto ? <ActivityIndicator color="#ffffff" /> : (
          <Text style={[styles.btnTxt, { color: '#ffffff' }]}>📷  Take photo</Text>
        )}
      </Pressable>
      {aiConfidence && (
        <Text style={[styles.muted, { marginTop: spacing.sm, color: aiConfidence === 'high' ? colors.green : colors.amber }]}>
          AI confidence: {aiConfidence}
        </Text>
      )}

      <Text style={[styles.label, { marginTop: spacing.lg }]}>or enter manually</Text>
      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <Text style={styles.subLabel}>Hobbs end</Text>
          <TextInput
            value={hobbsEnd}
            onChangeText={setHobbsEnd}
            placeholder="456.3"
            keyboardType="decimal-pad"
            style={styles.input}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.subLabel}>Tach end</Text>
          <TextInput
            value={tachEnd}
            onChangeText={setTachEnd}
            placeholder="63.1"
            keyboardType="decimal-pad"
            style={styles.input}
          />
        </View>
      </View>
    </>
  );

  const renderStep3 = () => {
    const hu = hobbsNum !== null && lastReading ? hobbsNum - lastReading.hobbs_end : null;
    const tu = tachNum !== null && lastReading ? tachNum - lastReading.tach_end : null;
    const negative = (hu !== null && hu < 0) || (tu !== null && tu < 0);
    return (
      <>
        <View style={styles.summary}>
          <Text style={styles.muted}>Pilot</Text>
          <Text style={styles.summaryVal}>{pilot?.name ?? '—'}</Text>
          <Text style={styles.muted}>Date</Text>
          <Text style={styles.summaryVal}>{date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</Text>
          <Text style={styles.muted}>Destination</Text>
          <Text style={styles.summaryVal}>{effectiveDestination || '—'}</Text>
          <Text style={styles.muted}>Hobbs end</Text>
          <Text style={styles.summaryVal}>
            {hobbsNum !== null ? hobbsNum.toFixed(1) : '—'}
            {hu !== null && (
              <Text style={[styles.muted, negative && { color: colors.red }]}>  Δ {hu.toFixed(1)} hr</Text>
            )}
          </Text>
          <Text style={styles.muted}>Tach end</Text>
          <Text style={styles.summaryVal}>
            {tachNum !== null ? tachNum.toFixed(1) : '—'}
            {tu !== null && (
              <Text style={[styles.muted, negative && { color: colors.red }]}>  Δ {tu.toFixed(1)} hr</Text>
            )}
          </Text>
        </View>

        {negative && (
          <Text style={[styles.muted, { color: colors.red }]}>
            ⚠ Hobbs/Tach end is below previous reading — please verify.
          </Text>
        )}

        <Text style={[styles.label, { marginTop: spacing.lg }]}>Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything worth remembering"
          multiline
          numberOfLines={3}
          style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
        />

        <View style={styles.oilRow}>
          <Switch value={oilAdded} onValueChange={setOilAdded} />
          <Text style={styles.muted}>
            Added oil before this flight {oilAdded ? '· 1 qt' : ''}
          </Text>
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.headerBar}>
        <Pressable onPress={navigation.goBack}><Text style={styles.cancel}>Cancel</Text></Pressable>
        <Text style={styles.title}>Log Flight</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.stepDots}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.stepDot,
              i === step && styles.stepDotActive,
              i < step && styles.stepDotDone,
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => (step === 1 ? navigation.goBack() : setStep(step - 1))}
          style={[styles.btn, { flex: 1 }]}
        >
          <Text style={styles.btnTxt}>{step === 1 ? 'Cancel' : 'Back'}</Text>
        </Pressable>
        {step < 3 ? (
          <Pressable
            onPress={() => setStep(step + 1)}
            disabled={step === 1 && !validDestination}
            style={[styles.btn, styles.btnPrimary, { flex: 1, opacity: (step === 1 && !validDestination) ? 0.5 : 1 }]}
          >
            <Text style={[styles.btnTxt, { color: '#ffffff' }]}>Next</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSave}
            disabled={!canSubmit}
            style={[styles.btn, styles.btnPrimary, { flex: 1, opacity: canSubmit ? 1 : 0.5 }]}
          >
            <Text style={[styles.btnTxt, { color: '#ffffff' }]}>
              {submitting ? 'Saving…' : 'Save Flight'}
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  cancel: { color: colors.navyAlt, fontSize: font.body },
  title: { color: colors.text, fontSize: font.pageTitle, fontWeight: '600' },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  stepDotActive: { width: 24, backgroundColor: colors.navyAlt },
  stepDotDone: { backgroundColor: colors.navyAlt },
  body: { padding: spacing.lg, gap: spacing.sm },

  label: { color: colors.muted, fontSize: font.label, textTransform: 'uppercase', letterSpacing: 1 },
  subLabel: { color: colors.muted, fontSize: font.label, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.bgAlt,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: font.body,
    color: colors.text,
    borderColor: colors.border,
    borderWidth: 1,
  },
  twoCol: { flexDirection: 'row', gap: spacing.md },
  muted: { color: colors.muted, fontSize: font.label },

  readonlyChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgAlt,
    borderRadius: radius.button,
    borderColor: colors.border,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  readonlyTxt: { color: colors.text, fontSize: font.body },

  pilotChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  pilotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
    borderColor: colors.border,
    borderWidth: 1,
  },
  pilotChipActive: { backgroundColor: colors.navyAlt, borderColor: colors.navyAlt },
  pilotChipDot: { width: 10, height: 10, borderRadius: radius.pilotDot },
  pilotChipTxt: { color: colors.text, fontSize: font.body },
  pilotChipTxtActive: { color: '#ffffff' },

  btn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg,
    borderRadius: radius.button,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: colors.navyAlt, borderColor: colors.navyAlt },
  btnTxt: { color: colors.text, fontSize: font.body, fontWeight: '500' },

  destGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  destCell: {
    width: '47%',
    padding: spacing.md,
    borderRadius: radius.button,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.bg,
  },
  destCellActive: { borderColor: colors.navyAlt, backgroundColor: 'rgba(78,81,102,0.08)' },
  destIcao: { fontFamily: 'Menlo', fontSize: 15, color: colors.navyAlt },
  destName: { fontSize: font.label, color: colors.muted, marginTop: 2 },

  summary: {
    padding: spacing.lg,
    backgroundColor: colors.bgAlt,
    borderRadius: radius.card,
    borderColor: colors.border,
    borderWidth: 1,
    gap: 2,
  },
  summaryVal: { color: colors.text, fontSize: font.body, marginBottom: spacing.sm },

  oilRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },

  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
});
