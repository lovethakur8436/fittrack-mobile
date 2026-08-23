import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';

import MapView, { Polyline } from 'react-native-maps';

// CHANGE THIS based on your simulator:
// iOS: 'http://localhost:8080'
// Android: 'http://10.0.2.2:8080'
const API_BASE_URL = 'http://192.168.0.4:8080';

// A quick 3-point run for testing
const mockRoutePoints = [
  { lat: 17.4401, lng: 78.3489, time: 0 },
  { lat: 17.4415, lng: 78.3505, time: 60 },
  { lat: 17.4432, lng: 78.3521, time: 120 }
];

// Convert our backend format to the map format
const mapCoordinates = mockRoutePoints.map(point => ({
  latitude: point.lat,
  longitude: point.lng
}));

export default function App() {
  const [token, setToken] = useState(null);
  const [email, setEmail] = useState('test@test.com'); // Change to an email in your DB
  const [password, setPassword] = useState('password');
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [latestActivity, setLatestActivity] = useState(null);

  // Add this new function below fetchProfile
  const fetchActivities = async (jwt) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/activities`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json'
        },
      });
      const data = await response.json();

      // If we have activities, grab the most recent one (the first in the array)
      if (data && data.length > 0) {
        setLatestActivity(data[0]);
      }
    } catch (err) {
      console.error('Failed to load activities', err);
    }
  };

  // IMPORTANT: Update your handleLogin success block to call it:
  // setToken(data.token);
  // fetchProfile(data.token);
  // fetchActivities(data.token); <--- ADD THIS LINE

  // --- 1. Login Function (Hits Spring Boot) ---
  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) throw new Error('Login failed. Check credentials.');

      const data = await response.json();
      setToken(data.token); // Save the JWT in state
      fetchProfile(data.token); // Immediately fetch profile
      fetchActivities(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. Fetch Profile Function (Uses JWT) ---
  const fetchProfile = async (jwt) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/profiles/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json'
        },
      });
      const data = await response.json();
      setProfileData(data);
    } catch (err) {
      setError('Failed to load profile');
    }
  };

  // --- UI: RENDER DASHBOARD ---
  if (token && profileData) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Welcome, {profileData.firstName}!</Text>

        <View style={styles.card}>
          <Text style={styles.statTitle}>Total Distance</Text>
          <Text style={styles.statValue}>{(profileData.totalDistanceMeters / 1000).toFixed(2)} km</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.statTitle}>Total Activities</Text>
          <Text style={styles.statValue}>{profileData.totalActivities}</Text>
        </View>

        {/* Map Card */}
        {latestActivity && latestActivity.routeData && latestActivity.routeData.length > 0 && (
          <View style={styles.mapCard}>
            <Text style={styles.statTitle}>Latest Run: {(latestActivity.distanceMeters / 1000).toFixed(2)} km</Text>
            <MapView
              style={styles.map}
              initialRegion={{
                // Center the map on the very first point of the route
                latitude: latestActivity.routeData[0].lat,
                longitude: latestActivity.routeData[0].lng,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
              }}
            >
              <Polyline
                // Map our backend {lat, lng} to React Native Maps {latitude, longitude}
                coordinates={latestActivity.routeData.map(point => ({
                  latitude: point.lat,
                  longitude: point.lng
                }))}
                strokeColor="#fc4c02"
                strokeWidth={4}
              />
            </MapView>
          </View>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={() => { setToken(null); setProfileData(null); }}>
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- UI: RENDER LOGIN SCREEN ---
  return (
    <View style={styles.container}>
      <Text style={styles.title}>FitTrack</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
      </TouchableOpacity>
    </View>
  );
}

// --- CSS for Mobile ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', justifyContent: 'center', padding: 20 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fc4c02', textAlign: 'center', marginBottom: 40 },
  header: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#ddd' },
  button: { backgroundColor: '#fc4c02', padding: 15, borderRadius: 8, alignItems: 'center' },
  logoutButton: { backgroundColor: '#333', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 30 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 10, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
  statTitle: { fontSize: 14, color: '#666', textTransform: 'uppercase' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#fc4c02', marginTop: 5 },
  errorText: { color: 'red', textAlign: 'center', marginBottom: 10 },
  mapCard: { backgroundColor: '#fff', borderRadius: 10, marginBottom: 15, overflow: 'hidden', elevation: 3 },
  map: { width: '100%', height: 200, marginTop: 10 },
});