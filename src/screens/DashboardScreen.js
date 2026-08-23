import React, { useContext, useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { AuthContext } from '../context/AuthContext';
import { ApiService } from '../services/api';

export default function DashboardScreen() {
    // 1. Open the vault to get the current user data
    const { profile, token, logout } = useContext(AuthContext);
    const [latestActivity, setLatestActivity] = useState(null);

    // 2. @PostConstruct equivalent - fetch the activities when the screen loads
    useEffect(() => {
        const fetchActivities = async () => {
            try {
                const data = await ApiService.getActivities(token);

                // Notice the change here: we drill into data.content
                if (data && data.content && data.content.length > 0) {
                    setLatestActivity(data.content[0]);
                }
            } catch (error) {
                console.error("Dashboard error:", error);
            }
        };
        fetchActivities();
    }, [token]); // The array tells React: only run this again if the token changes

    // Safety check: if profile hasn't loaded yet from context
    if (!profile) return <View style={styles.container}><Text>Loading profile...</Text></View>;

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Welcome, {profile.firstName}!</Text>

            <View style={styles.card}>
                <Text style={styles.statTitle}>Total Distance</Text>
                <Text style={styles.statValue}>{(profile.totalDistanceMeters / 1000).toFixed(2)} km</Text>
            </View>

            {/* Map Card */}
            {latestActivity && latestActivity.routeData && latestActivity.routeData.length > 0 && (
                <View style={styles.mapCard}>
                    <Text style={styles.statTitle}>Latest Run: {(latestActivity.distanceMeters / 1000).toFixed(2)} km</Text>
                    <MapView
                        style={styles.map}
                        initialRegion={{
                            latitude: latestActivity.routeData[0].lat,
                            longitude: latestActivity.routeData[0].lng,
                            latitudeDelta: 0.015,
                            longitudeDelta: 0.015,
                        }}
                    >
                        <Polyline
                            coordinates={latestActivity.routeData.map(point => ({ latitude: point.lat, longitude: point.lng }))}
                            strokeColor="#fc4c02"
                            strokeWidth={4}
                        />
                    </MapView>
                </View>
            )}

            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                <Text style={styles.buttonText}>Logout</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5', justifyContent: 'center', padding: 20 },
    header: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
    card: { backgroundColor: '#fff', padding: 20, borderRadius: 10, marginBottom: 15, elevation: 3 },
    statTitle: { fontSize: 14, color: '#666', textTransform: 'uppercase' },
    statValue: { fontSize: 24, fontWeight: 'bold', color: '#fc4c02', marginTop: 5 },
    mapCard: { backgroundColor: '#fff', borderRadius: 10, marginBottom: 15, overflow: 'hidden', elevation: 3, padding: 15 },
    map: { width: '100%', height: 200, marginTop: 10 },
    logoutButton: { backgroundColor: '#333', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 30 },
    buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});