import React, { useState, useEffect, useContext } from 'react';
import { StyleSheet, Text, View, FlatList, Image, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { ApiService } from '../services/api';
import { Alert, TouchableOpacity, TextInput, Modal, Button } from 'react-native';


export default function FeedScreen() {
    const { token } = useContext(AuthContext);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    const [editingActivity, setEditingActivity] = useState(null);
    const [editTitle, setEditTitle] = useState('');

    const [processingId, setProcessingId] = useState(null); // Tracks which specific card is deleting
    const [actionLoading, setActionLoading] = useState(false); // Tracks if the edit modal is saving


    useEffect(() => {
        fetchFeed();
    }, []);

    const handleDelete = (id) => {
        Alert.alert(
            "Delete Activity",
            "Are you sure you want to delete this run? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        setProcessingId(id); // 1. Lock the specific card UI
                        try {
                            await ApiService.deleteActivity(token, id);
                            // Optimistically remove from UI without waiting for network refresh
                            setActivities(prev => prev.filter(a => a.id !== id));
                        } catch (error) {
                            Alert.alert("Deletion Failed", `Reason: ${error.message}\n\nPlease try again later.`);
                        } finally {
                            setProcessingId(null); // 3. Unlock the card UI
                        }
                    }
                }
            ]
        );
    };

    const handleEditSave = async () => {
        if (!editingActivity || !editTitle.trim()) {
            Alert.alert("Validation Error", "Title cannot be empty.");
            return;
        }

        setActionLoading(true); // 1. Show spinner in modal
        try {
            const updated = await ApiService.updateActivity(token, editingActivity.id, { title: editTitle });
            setActivities(prev => prev.map(a => a.id === updated.id ? updated : a));
            setEditingActivity(null);
        } catch (error) {
            Alert.alert("Update Failed", `Reason: ${error.message}`);
        } finally {
            setActionLoading(false); // 2. Hide spinner in modal
        }
    };
    const fetchFeed = async () => {
        try {
            const data = await ApiService.getActivities(token);
            if (data && data.content) {
                setActivities(data.content);
            }
        } catch (error) {
            console.error("Failed to fetch feed:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- THE LOCALHOST FIX ---
    const fixImageUri = (url) => {
        if (!url) return null;
        // Route Android emulator traffic to the host computer
        if (Platform.OS === 'android' && url.includes('localhost')) {
            return url.replace('localhost', '192.168.0.3');
        }
        return url;
    };

    const formatDistance = (meters) => (meters / 1000).toFixed(2) + ' km';
    const formatDuration = (seconds) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

    // --- PREMIUM ACTIVITY CARD ---
    const renderActivityCard = ({ item }) => (
        <View style={styles.card}>

            {/* Header: User Info */}
            <View style={styles.header}>
                <View style={styles.avatarContainer}>
                    <Text style={styles.avatarInitials}>DU</Text>
                </View>
                <View style={styles.headerText}>
                    <Text style={styles.userName}>Demo User</Text>
                    <Text style={styles.dateText}>
                        {new Date(item.startTime).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
                {/* Action Buttons with Loading State */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {processingId === item.id ? (
                        <ActivityIndicator size="small" color="red" style={{ marginRight: 15 }} />
                    ) : (
                        <>
                            <TouchableOpacity onPress={() => { setEditingActivity(item); setEditTitle(item.title); }} style={{ marginRight: 15 }}>
                                <Text style={{ color: '#007AFF' }}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)}>
                                <Text style={{ color: 'red' }}>Delete</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>{item.title || "Morning Run"}</Text>

            {/* Primary Visual: Edge-to-Edge Map */}
            {item.mapImageUrl && (
                <View style={styles.mapContainer}>
                    <Image
                        source={{ uri: fixImageUri(item.mapImageUrl) }}
                        style={styles.mapImage}
                        resizeMode="cover"
                    />
                </View>
            )}

            {/* Secondary Visual: User Photos (if any exist) */}
            {item.photoUrls && item.photoUrls.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoCarousel}>
                    {item.photoUrls.map((url, index) => (
                        <Image key={index} source={{ uri: fixImageUri(url) }} style={styles.userPhoto} />
                    ))}
                </ScrollView>
            )}

            {/* Footer: Stats Row */}
            <View style={styles.statsRow}>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Distance</Text>
                    <Text style={styles.statValue}>{formatDistance(item.distanceMeters)}</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Pace</Text>
                    <Text style={styles.statValue}>{((item.durationSeconds / 60) / (item.distanceMeters / 1000)).toFixed(2)} /km</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Time</Text>
                    <Text style={styles.statValue}>{formatDuration(item.durationSeconds)}</Text>
                </View>
            </View>
        </View>
    );

    if (loading) {
        return <View style={styles.center}><ActivityIndicator size="large" color="#fc4c02" /></View>;
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={activities}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderActivityCard}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
            />

            <Modal visible={!!editingActivity} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Edit Activity</Text>
                        <TextInput
                            style={styles.input}
                            value={editTitle}
                            onChangeText={setEditTitle}
                            placeholder="Activity Title"
                            editable={!actionLoading} // Lock input during save
                        />

                        {actionLoading ? (
                            <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />
                        ) : (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
                                <Button title="Cancel" color="red" onPress={() => setEditingActivity(null)} />
                                <Button title="Save" onPress={handleEditSave} />
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// --- STRAVA-INSPIRED STYLING ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f5f7' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f4f5f7' },
    listContainer: { paddingBottom: 20 },

    card: {
        backgroundColor: '#fff',
        marginBottom: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#e0e0e0',
        paddingVertical: 15,
        // Soft shadow for iOS
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        // Elevation for Android
        elevation: 2,
    },

    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, marginBottom: 8 },
    avatarContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fc4c02', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatarInitials: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    headerText: { flex: 1 },
    userName: { fontSize: 15, fontWeight: '700', color: '#242428' },
    dateText: { fontSize: 13, color: '#6d6d78', marginTop: 2 },

    title: { fontSize: 17, fontWeight: '600', paddingHorizontal: 15, marginBottom: 12, color: '#242428' },

    mapContainer: { width: '100%', height: 220, backgroundColor: '#e9ecef', overflow: 'hidden' },
    mapImage: { width: '100%', height: '100%' },

    photoCarousel: { marginTop: 15, paddingHorizontal: 15 },
    userPhoto: { width: 140, height: 140, borderRadius: 8, marginRight: 12, backgroundColor: '#e9ecef' },

    statsRow: { flexDirection: 'row', paddingHorizontal: 15, marginTop: 15 },
    statBox: { flex: 1 },
    statLabel: { fontSize: 12, color: '#6d6d78', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    statValue: { fontSize: 18, fontWeight: '300', color: '#242428' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '85%', backgroundColor: '#fff', padding: 20, borderRadius: 10 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
    input: { borderBottomWidth: 1, borderColor: '#ccc', fontSize: 16, paddingVertical: 5 },
});