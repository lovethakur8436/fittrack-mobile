import React, { useState, useEffect, useRef, useContext } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { AuthContext } from '../context/AuthContext';
import { ApiService } from '../services/api';

export default function TrackingScreen({ navigation }) {
    // 1. Destructure refreshProfile from Context
    const { token, refreshProfile } = useContext(AuthContext);

    const [isTracking, setIsTracking] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [currentLocation, setCurrentLocation] = useState(null);

    // Segmented Route Tracking
    // Instead of one flat array, we store an array of arrays. 
    // Every time the user hits "Resume", we start a new array (segment).
    const [routeSegments, setRouteSegments] = useState([[]]); 
    const [distanceMeters, setDistanceMeters] = useState(0);
    const [durationSeconds, setDurationSeconds] = useState(0);
    const [startTime, setStartTime] = useState(null);

    const locationSubscription = useRef(null);
    const timerInterval = useRef(null);
    
    const lastPointRef = useRef(null); 
    const distanceRef = useRef(0);
    const durationRef = useRef(0);

    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    if (isMounted) Alert.alert('Permission Denied', 'Allow location access to record activities.');
                    return;
                }
                const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                if (isMounted) setCurrentLocation(location.coords);
            } catch (error) {
                if (isMounted) Alert.alert("GPS Error", "Could not acquire starting location.");
            }
        })();

        return () => {
            isMounted = false;
            stopTracking(); 
        };
    }, []);

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3; 
        const toRadians = (deg) => deg * (Math.PI / 180);
        const dLat = toRadians(lat2 - lat1);
        const dLon = toRadians(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const startTracking = async (isResume = false) => {
        if (!isResume) {
            setStartTime(new Date());
            setRouteSegments([[]]);
            setDistanceMeters(0);
            setDurationSeconds(0);
            
            distanceRef.current = 0;
            durationRef.current = 0;
        } else {
            // CRITICAL FIX: Add a new empty segment to the array when resuming.
            // This prevents a straight line being drawn across the paused gap.
            setRouteSegments(prev => [...prev, []]);
        }

        // CRITICAL FIX: Reset last known point so the distance formula doesn't jump
        lastPointRef.current = null;
        setIsTracking(true);

        timerInterval.current = setInterval(() => {
            setDurationSeconds(prev => {
                durationRef.current = prev + 1;
                return prev + 1;
            });
        }, 1000);

        locationSubscription.current = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: 3000,
                distanceInterval: 3,
            },
            (location) => {
                const newPoint = location.coords;
                setCurrentLocation(newPoint);

                const formattedPoint = {
                    lat: newPoint.latitude,
                    lng: newPoint.longitude,
                    time: durationRef.current
                };

                // Add point to the *latest* segment
                setRouteSegments(prev => {
                    const newSegments = [...prev];
                    const lastIndex = newSegments.length - 1;
                    newSegments[lastIndex] = [...newSegments[lastIndex], formattedPoint];
                    return newSegments;
                });

                if (lastPointRef.current) {
                    const addedDistance = calculateDistance(
                        lastPointRef.current.lat, lastPointRef.current.lng,
                        formattedPoint.lat, formattedPoint.lng
                    );
                    
                    distanceRef.current += addedDistance;
                    setDistanceMeters(distanceRef.current);
                }
                lastPointRef.current = formattedPoint;
            }
        );
    };

    const stopTracking = () => {
        setIsTracking(false);
        if (timerInterval.current) clearInterval(timerInterval.current);
        if (locationSubscription.current) {
            locationSubscription.current.remove();
            locationSubscription.current = null;
        }
    };

    const handleFinish = async () => {
        stopTracking();

        // Use the ref for absolute accuracy against batching delays
        if (distanceRef.current < 50) {
            Alert.alert("Activity Too Short", "You must travel at least 50 meters to save an activity.");
            return;
        }

        setIsSaving(true);
        
        // Flatten the segments back into a single array for the backend API
        const flatRouteData = routeSegments.flat();

        const payload = {
            title: "Afternoon Run", 
            activityType: "RUN",
            startTime: startTime.toISOString().split('.')[0], 
            distanceMeters: parseFloat(distanceRef.current.toFixed(2)),
            durationSeconds: durationRef.current,
            routeData: flatRouteData
        };

        try {
            await ApiService.createActivity(token, payload);
            
            // CRITICAL FIX: Force the profile to refresh in the background BEFORE we navigate
            if (refreshProfile) {
                await refreshProfile();
            }

            Alert.alert("Success", "Activity saved!", [
                { 
                    text: "OK", 
                    onPress: () => {
                        // Reset everything to ZERO
                        setDurationSeconds(0);
                        setDistanceMeters(0);
                        setRouteSegments([[]]);
                        setStartTime(null);
                        distanceRef.current = 0;
                        durationRef.current = 0;
                        lastPointRef.current = null;
                        
                        // Navigate to the Dashboard (You) tab to see the updated totals immediately
                        navigation.navigate('You');
                    } 
                }
            ]);
        } catch (error) {
            Alert.alert("Upload Failed", error.message);
        } finally {
            setIsSaving(false);
        }
    };

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
                        {/* Map over each segment and draw an independent polyline to prevent straight lines cutting across paused areas */}
                        {routeSegments.map((segment, index) => (
                            segment.length > 0 && (
                                <Polyline
                                    key={index}
                                    coordinates={segment.map(p => ({ latitude: Number(p.lat), longitude: Number(p.lng) }))}
                                    strokeColor="#fc4c02"
                                    strokeWidth={5}
                                />
                            )
                        ))}
                    </MapView>
                ) : (
                    <View style={styles.loadingMap}>
                        <ActivityIndicator size="large" color="#fc4c02" />
                        <Text style={styles.loadingText}>Acquiring GPS...</Text>
                    </View>
                )}
            </View>

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