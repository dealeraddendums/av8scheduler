import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { FlightLogScreen } from '../screens/FlightLogScreen';
import { AdminScreen } from '../screens/AdminScreen';
import { colors, font, spacing } from '../theme';

const Tab = createBottomTabNavigator();

// "Add Flight" is a tab in name but routes to a modal — we override the
// tabPress so tapping it pushes a stack screen instead of switching tabs.
function AddFlightPlaceholder() {
  return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
}

export function MainTabs({ navigation }: { navigation: any }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + 24, // include safe area
          paddingBottom: 24,
        },
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: font.label },
      }}
    >
      <Tab.Screen
        name="Log"
        component={FlightLogScreen}
        options={{
          tabBarIcon: ({ color }) => <TabIcon glyph="📓" color={color} />,
        }}
      />
      <Tab.Screen
        name="Add Flight"
        component={AddFlightPlaceholder}
        options={{
          tabBarIcon: ({ color }) => <TabIcon glyph="➕" color={color} />,
          tabBarButton: (props) => (
            <Pressable
              {...(props as any)}
              onPress={() => navigation.navigate('AddFlightModal')}
              style={styles.middleTab}
            >
              <Text style={styles.middleGlyph}>➕</Text>
              <Text style={styles.middleLabel}>Add Flight</Text>
            </Pressable>
          ),
        }}
      />
      <Tab.Screen
        name="Admin"
        component={AdminScreen}
        options={{
          tabBarIcon: ({ color }) => <TabIcon glyph="🛡" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

function TabIcon({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{glyph}</Text>;
}

const styles = StyleSheet.create({
  middleTab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm },
  middleGlyph: { fontSize: 22 },
  middleLabel: { color: colors.muted, fontSize: font.label, marginTop: 2 },
});
