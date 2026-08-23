import React, { useContext } from 'react';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';

// The Router: Decides which screen to show based on the vault's state
const AppNavigator = () => {
  const { token } = useContext(AuthContext);

  // If we have a JWT, show Dashboard. Otherwise, force Login.
  return token ? <DashboardScreen /> : <LoginScreen />;
};

// The Root: Wraps the entire app in the Context Provider (the Vault)
export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}