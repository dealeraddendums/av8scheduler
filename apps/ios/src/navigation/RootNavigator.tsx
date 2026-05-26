import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../auth/useAuth';
import { PilotSelectScreen } from '../screens/PilotSelectScreen';
import { MainTabs } from './MainTabs';
import { AddFlightModal } from '../screens/AddFlightModal';
import { LogMaintenanceModal } from '../screens/LogMaintenanceModal';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="PilotSelect" component={PilotSelectScreen} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen
              name="AddFlightModal"
              component={AddFlightModal}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="LogMaintenanceModal"
              component={LogMaintenanceModal}
              options={{ presentation: 'modal' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
