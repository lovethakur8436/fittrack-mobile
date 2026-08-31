import React, { useContext } from 'react';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import FeedScreen from './src/screens/FeedScreen';
import TrackingScreen from './src/screens/TrackingScreen';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

const Tab = createBottomTabNavigator();

const MainTabs = () => {
  return (
    <Tab.Navigator
      detachInactiveScreens={false} // <-- ADD THIS LINE
      screenOptions={{
        tabBarActiveTintColor: '#fc4c02', // Strava Orange
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { backgroundColor: '#1e293b', borderTopColor: '#334155' },
        headerShown: false, // We use custom headers in the screens
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text> }}
      />

      <Tab.Screen
        name="Record"
        component={TrackingScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🔴</Text> }}
      />

      <Tab.Screen
        name="You"
        component={DashboardScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text> }}
      />


    </Tab.Navigator>
  );
};

// The Router: Decides which screen to show based on the vault's state
const AppNavigator = () => {
  const { token } = useContext(AuthContext);

  // If we have a JWT, show Dashboard. Otherwise, force Login.
  return token ? <MainTabs /> : <LoginScreen />;
};

// The Root: Wraps the entire app in the Context Provider (the Vault)
export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}