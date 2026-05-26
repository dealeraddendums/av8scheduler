import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../auth/useAuth';
import { colors, font, radius, spacing } from '../theme';

export function PilotSelectScreen() {
  const { pilots, pilotsLoading, refreshPilots, loginWithPin } = useAuth();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  const picked = pilots.find((p) => p.id === pickedId);

  const handleSubmit = async (nextPin: string) => {
    if (!pickedId || nextPin.length !== 4 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await loginWithPin(pickedId, nextPin);
      if (!res.ok) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(res.reason ?? 'Incorrect PIN');
        setPin('');
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
        setTimeout(() => inputRef.current?.focus(), 100);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (pilotsLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color="#ffffff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerWrap}>
        <Text style={styles.brand}>AV8 Scheduler</Text>
        <Text style={styles.subtitle}>N4368V · Piper Archer II</Text>
      </View>

      {picked === undefined ? (
        <ScrollView contentContainerStyle={styles.pilotList}>
          {pilots.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => {
                setPickedId(p.id);
                setPin('');
                setError(null);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              style={({ pressed }) => [styles.pilotCard, pressed && { opacity: 0.75 }]}
            >
              <View style={[styles.pilotDot, { backgroundColor: p.color }]} />
              <Text style={styles.pilotName}>{p.name}</Text>
            </Pressable>
          ))}
          <Pressable onPress={refreshPilots} style={styles.refreshBtn}>
            <Text style={styles.refreshTxt}>Refresh pilot list</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <Animated.View style={[styles.pinWrap, { transform: [{ translateX: shakeAnim }] }]}>
          <Pressable
            onPress={() => {
              setPickedId(null);
              setPin('');
              setError(null);
            }}
            style={styles.backLink}
          >
            <Text style={styles.backTxt}>← Choose another pilot</Text>
          </Pressable>

          <View style={styles.selectedPilot}>
            <View style={[styles.pilotDot, { backgroundColor: picked.color }]} />
            <Text style={styles.pilotName}>{picked.name}</Text>
          </View>

          <Text style={styles.pinLabel}>Enter PIN</Text>
          <View style={styles.pinDotsRow}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[styles.pinDot, pin.length > i && styles.pinDotFilled]}
              />
            ))}
          </View>
          <TextInput
            ref={inputRef}
            value={pin}
            onChangeText={(v) => {
              const cleaned = v.replace(/\D/g, '').slice(0, 4);
              setPin(cleaned);
              setError(null);
              if (cleaned.length === 4) handleSubmit(cleaned);
            }}
            keyboardType="number-pad"
            secureTextEntry
            autoFocus
            maxLength={4}
            style={styles.pinInput}
          />
          {error && <Text style={styles.errorTxt}>{error}</Text>}
          {submitting && <ActivityIndicator color="#ffffff" style={{ marginTop: spacing.md }} />}
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  brand: { color: '#ffffff', fontSize: 28, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: font.body, marginTop: spacing.xs },
  pilotList: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  pilotCard: {
    backgroundColor: '#ffffff',
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pilotDot: { width: 18, height: 18, borderRadius: radius.pilotDot },
  pilotName: { fontSize: 20, fontWeight: '600', color: colors.text },
  refreshBtn: { alignSelf: 'center', marginTop: spacing.md, paddingVertical: spacing.sm },
  refreshTxt: { color: 'rgba(255,255,255,0.7)', fontSize: font.body },

  pinWrap: { paddingHorizontal: spacing.xl, alignItems: 'center', paddingTop: spacing.lg },
  backLink: { alignSelf: 'flex-start', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  backTxt: { color: 'rgba(255,255,255,0.7)', fontSize: font.body },
  selectedPilot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.card,
    marginVertical: spacing.lg,
  },
  pinLabel: { color: 'rgba(255,255,255,0.7)', fontSize: font.label, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.md },
  pinDotsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  pinDot: { width: 18, height: 18, borderRadius: radius.pilotDot, borderWidth: 2, borderColor: '#ffffff' },
  pinDotFilled: { backgroundColor: '#ffffff' },
  pinInput: { position: 'absolute', opacity: 0, height: 0, width: 0 },
  errorTxt: { color: colors.amber, fontSize: font.body, marginTop: spacing.md },
});
