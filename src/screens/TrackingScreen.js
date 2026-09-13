import React, { useState, useEffect, useRef, useContext } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { AuthContext } from '../context/AuthContext';
import { ApiService } from '../services/api';

export default function TrackingScreen({ navigation }) {
    const { token } = useContext(AuthContext);

    // UI State
    const [isTracking, setIsTracking] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [currentLocation, setCurrentLocation] = useState(null);

    // Tracking Data State
    const [routePoints, setRoutePoints] = useState([]);
    const [distanceMeters, setDistanceMeters] = useState(0);
    const [durationSeconds, setDurationSeconds] = useState(0);
    const [startTime, setStartTime] = useState(null);

    // Refs for intervals and subscriptions
    const locationSubscription = useRef(null);
    const timerInterval = useRef(null);
    const lastPointRef = useRef(null); // Used for accurate distance math
    const durationRef = useRef(0);

    // 1. Initial Setup: Request permissions and get starting location
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'Allow location access to record activities.');
                return;
            }
            const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            setCurrentLocation(location.coords);
        })();

        // Cleanup on unmount
        return () => stopTracking();
    }, []);

    // 2. Haversine Formula (Calculates distance between two GPS coordinates)
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3; // Earth radius in meters
        const toRadians = (deg) => deg * (Math.PI / 180);
        const dLat = toRadians(lat2 - lat1);
        const dLon = toRadians(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // 3. Start Recording
    const startTracking = async (isResume = false) => {
        if (!isResume) {
            setStartTime(new Date());
            setRoutePoints([]);
            setDistanceMeters(0);
            setDurationSeconds(0);
            durationRef.current = 0;
            lastPointRef.current = null;
        }

        setIsTracking(true);

        // Start Stopwatch
        timerInterval.current = setInterval(() => {
            setDurationSeconds(prev => {
                durationRef.current = prev + 1;
                return prev + 1;
            });
        }, 1000);

        // Start GPS Subscription
        locationSubscription.current = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: 3000,
                distanceInterval: 3,
            },
            (location) => {
                const newPoint = location.coords;
                setCurrentLocation(newPoint);

                // Use the ref for the exact relative time, even after pausing
                const formattedPoint = {
                    lat: newPoint.latitude,
                    lng: newPoint.longitude,
                    time: durationRef.current
                };

                setRoutePoints(prev => [...prev, formattedPoint]);

                // Calculate Distance
                if (lastPointRef.current) {
                    const addedDistance = calculateDistance(
                        lastPointRef.current.lat, lastPointRef.current.lng,
                        formattedPoint.lat, formattedPoint.lng
                    );
                    setDistanceMeters(prev => prev + addedDistance);
                }
                lastPointRef.current = formattedPoint;
            }
        );
    };

    // 4. Stop Recording & Save
    const stopTracking = async () => {
        setIsTracking(false);
        if (timerInterval.current) clearInterval(timerInterval.current);
        if (locationSubscription.current) {
            locationSubscription.current.remove();
            locationSubscription.current = null;
        }
    };

    const handleFinish = async () => {
        await stopTracking();

        if (distanceMeters < 50) {
            Alert.alert("Activity Too Short", "You must travel at least 50 meters to save an activity.");
            return;
        }

        setIsSaving(true);

        // Construct exact JSON payload for backend
        const payload = {
            title: "Afternoon Run", // You can prompt the user for this later
            activityType: "RUN",
            startTime: startTime.toISOString().split('.')[0], // Format: YYYY-MM-DDTHH:MM:SS
            distanceMeters: parseFloat(distanceMeters.toFixed(2)),
            durationSeconds: durationSeconds,
            routeData: routePoints
        };

        try {
            await ApiService.createActivity(token, payload);
            Alert.alert("Success", "Activity saved!", [
                { text: "OK", onPress: () => navigation.navigate('Feed') }
            ]);
        } catch (error) {
            Alert.alert("Upload Failed", error.message);
        } finally {
            setIsSaving(false);
        }
    };

    // Formatting Helpers
    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
    };

    const getPace = () => {
        if (distanceMeters === 0) return "0:00";
        const mins = (durationSeconds / 60) / (distanceMeters / 1000);
        const m = Math.floor(mins);
        const s = Math.floor((mins - m) * 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <View style={styles.container}>
            {/* Top Metrics Panel */}
            <View style={styles.metricsPanel}>
                <View style={styles.metricGroup}>
                    <Text style={styles.metricLabel}>TIME</Text>
                    <Text style={styles.metricValue}>{formatTime(durationSeconds)}</Text>
                </View>
                <View style={styles.metricGroup}>
                    <Text style={styles.metricLabel}>DISTANCE (KM)</Text>
                    <Text style={styles.metricValue}>{(distanceMeters / 1000).toFixed(2)}</Text>
                </View>
                <View style={styles.metricGroup}>
                    <Text style={styles.metricLabel}>PACE</Text>
                    <Text style={styles.metricValue}>{getPace()}</Text>
                </View>
            </View>

            {/* Live Map */}
            <View style={styles.mapContainer}>
                {currentLocation ? (
                    <MapView
                        style={styles.map}
                        showsUserLocation={true}
                        followsUserLocation={isTracking}
                        initialRegion={{
                            latitude: currentLocation.latitude,
                            longitude: currentLocation.longitude,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                        }}
                    >
                        {routePoints.length > 0 && (
                            <Polyline
                                coordinates={routePoints.map(p => ({ latitude: Number(p.lat), longitude: Number(p.lng) }))}
                                strokeColor="#fc4c02"
                                strokeWidth={5}
                            />
                        )}
                    </MapView>
                ) : (
                    <View style={styles.loadingMap}>
                        <ActivityIndicator size="large" color="#fc4c02" />
                        <Text style={styles.loadingText}>Acquiring GPS...</Text>
                    </View>
                )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionArea}>
                {!isTracking && durationSeconds === 0 && (
                    <TouchableOpacity style={styles.startButton} onPress={() => startTracking(false)}>
                        <Text style={styles.buttonText}>START</Text>
                    </TouchableOpacity>
                )}

                {isTracking && (
                    <TouchableOpacity style={styles.stopButton} onPress={stopTracking}>
                        <Text style={styles.buttonText}>STOP</Text>
                    </TouchableOpacity>
                )}

                {!isTracking && durationSeconds > 0 && (
                    <View style={styles.saveContainer}>
                        <TouchableOpacity style={styles.resumeButton} onPress={() => startTracking(true)}>
                            <Text style={styles.buttonText}>RESUME</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.saveButton} onPress={handleFinish} disabled={isSaving}>
                            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>FINISH</Text>}
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },

    metricsPanel: { flexDirection: 'row', justifyContent: 'space-between', padding: 25, paddingTop: 60, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
    metricGroup: { alignItems: 'center' },
    metricLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '700', marginBottom: 5, letterSpacing: 1 },
    metricValue: { color: '#f8fafc', fontSize: 28, fontWeight: '900' },

    mapContainer: { flex: 1, alignSelf: 'stretch' },
    map: { flex: 1, alignSelf: 'stretch' },
    loadingMap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
    loadingText: { color: '#94a3b8', marginTop: 10, fontWeight: '600' },

    actionArea: { padding: 30, backgroundColor: '#1e293b', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#334155' },
    startButton: { backgroundColor: '#fc4c02', width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', elevation: 5 },
    stopButton: { backgroundColor: '#ef4444', width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', elevation: 5 },
    saveContainer: { flexDirection: 'row', width: '100%', justifyContent: 'space-around' },
    resumeButton: { backgroundColor: '#334155', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30 },
    saveButton: { backgroundColor: '#fc4c02', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30 },
    buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
});