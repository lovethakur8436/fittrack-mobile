import React, { useState, useEffect, useContext } from 'react';
import { StyleSheet, Text, View, FlatList, Image, ActivityIndicator, Modal, Alert, TextInput, TouchableOpacity, Button, Platform } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { ApiService } from '../services/api';

export default function FeedScreen() {
    const { token } = useContext(AuthContext);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    const [editingActivity, setEditingActivity] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [processingId, setProcessingId] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchFeed();
    }, []);

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
                        setProcessingId(id);
                        try {
                            await ApiService.deleteActivity(token, id);
                            setActivities(prev => prev.filter(a => a.id !== id));
                        } catch (error) {
                            Alert.alert("Deletion Failed", `Reason: ${error.message}`);
                        } finally {
                            setProcessingId(null);
                        }
                    }
                }
            ]
        );
    };

    const handleEditSave = async () => {
        if (!editingActivity) return;
        setActionLoading(true);
        try {
            const updated = await ApiService.updateActivity(token, editingActivity.id, { title: editTitle });
            setActivities(prev => prev.map(a => a.id === updated.id ? updated : a));
            setEditingActivity(null);
        } catch (error) {
            Alert.alert("Error", "Could not update activity");
        } finally {
            setActionLoading(false);
        }
    };

    const fixImageUri = (url) => {
        if (!url) return null;
        if (Platform.OS === 'android' && url.includes('localhost')) {
            return url.replace('localhost', '192.168.0.5');
        }
        return url;
    };

    // --- METRIC CALCULATIONS ---
    const getDistance = (meters) => (meters / 1000).toFixed(1);

    const getDuration = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const getPace = (meters, seconds) => {
        if (!meters || meters === 0) return "0:00";
        const mins = (seconds / 60) / (meters / 1000);
        const m = Math.floor(mins);
        const s = Math.floor((mins - m) * 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const getCalories = (meters) => Math.round((meters / 1000) * 65);

    // --- DYNAMIC AVATAR HELPER ---
    const getInitials = (name) => {
        if (!name) return "U";
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    const renderActivityCard = ({ item }) => {
        const userName = item.userName || "Demo User";
        const profilePicUrl = item.profilePicUrl; // Assuming this might exist in the future

        return (
            <View style={styles.card}>

                {/* Header: User Info & Actions */}
                <View style={styles.header}>
                    {/* Dynamic Avatar */}
                    {profilePicUrl ? (
                        <Image source={{ uri: fixImageUri(profilePicUrl) }} style={styles.avatarImage} />
                    ) : (
                        <View style={styles.avatarFallback}>
                            <Text style={styles.avatarInitials}>{getInitials(userName)}</Text>
                        </View>
                    )}

                    <View style={styles.headerText}>
                        <Text style={styles.userName}>{userName}</Text>
                        <Text style={styles.dateText}>{new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Hyderabad</Text>
                    </View>

                    {/* Admin Actions */}
                    <View style={styles.actionButtons}>
                        {processingId === item.id ? (
                            <ActivityIndicator size="small" color="#fc4c02" />
                        ) : (
                            <>
                                <TouchableOpacity onPress={() => { setEditingActivity(item); setEditTitle(item.title); }} style={{ marginRight: 12 }}>
                                    <Text style={styles.editText}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                                    <Text style={styles.deleteText}>✕</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>

                {/* 4-Column Detailed Metrics */}
                <View style={styles.metricsGrid}>
                    <View style={styles.metricItem}>
                        <Text style={styles.metricIcon}>👟</Text>
                        <Text style={styles.metricLabel}>DISTANCE</Text>
                        <Text style={styles.metricValue}>{getDistance(item.distanceMeters)} <Text style={styles.metricUnit}>km</Text></Text>
                    </View>
                    <View style={styles.metricItem}>
                        <Text style={styles.metricIcon}>⏱️</Text>
                        <Text style={styles.metricLabel}>TIME</Text>
                        <Text style={styles.metricValue}>{getDuration(item.durationSeconds)}</Text>
                    </View>
                    <View style={styles.metricItem}>
                        <Text style={styles.metricIcon}>⚡</Text>
                        <Text style={styles.metricLabel}>PACE</Text>
                        <Text style={styles.metricValue}>{getPace(item.distanceMeters, item.durationSeconds)}<Text style={styles.metricUnit}>/km</Text></Text>
                    </View>
                    <View style={styles.metricItem}>
                        <Text style={styles.metricIcon}>🔥</Text>
                        <Text style={styles.metricLabel}>CALORIES</Text>
                        <Text style={styles.metricValue}>{getCalories(item.distanceMeters)}</Text>
                    </View>
                </View>

                {/* Media Area (Overlapping Map & Photos) */}
                <View style={styles.mediaContainer}>
                    {item.mapImageUrl ? (
                        <Image source={{ uri: fixImageUri(item.mapImageUrl) }} style={styles.mapImage} resizeMode="cover" />
                    ) : (
                        <View style={[styles.mapImage, { backgroundColor: '#1a242f', justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ color: '#4b5563' }}>GPS Data Unavailable</Text>
                        </View>
                    )}

                    {/* Overlaid Photos on the bottom corners */}
                    {item.photoUrls && item.photoUrls.length > 0 && (
                        <Image source={{ uri: fixImageUri(item.photoUrls[0]) }} style={styles.overlayPhotoLeft} />
                    )}
                    {item.photoUrls && item.photoUrls.length > 1 && (
                        <Image source={{ uri: fixImageUri(item.photoUrls[1]) }} style={styles.overlayPhotoRight} />
                    )}
                </View>

                {/* Title (Footer) */}
                <View style={styles.contentFooter}>
                    <Text style={styles.title}>{item.title || "Morning Activity"}</Text>
                </View>
            </View>
        );
    };

    if (loading) {
        return <View style={styles.center}><ActivityIndicator size="large" color="#fc4c02" /></View>;
    }

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <Text style={styles.screenTitle}>ATHLETE FEED</Text>
            </View>

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
                            placeholderTextColor="#888"
                            editable={!actionLoading}
                        />
                        {actionLoading ? (
                            <ActivityIndicator size="large" color="#fc4c02" style={{ marginTop: 20 }} />
                        ) : (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
                                <Button title="Cancel" color="#888" onPress={() => setEditingActivity(null)} />
                                <Button title="Save" color="#fc4c02" onPress={handleEditSave} />
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },

    topBar: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 15, backgroundColor: '#0f172a' },
    screenTitle: { fontSize: 24, fontWeight: '900', color: '#ffffff', letterSpacing: 0.5 },

    listContainer: { paddingHorizontal: 15, paddingBottom: 30 },

    card: {
        backgroundColor: '#1e293b',
        borderRadius: 20,
        marginBottom: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#334155'
    },

    // Header & Dynamic Avatar
    header: { flexDirection: 'row', alignItems: 'center', padding: 15 },
    avatarImage: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: '#fc4c02' },
    avatarFallback: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: '#fc4c02', backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' },
    avatarInitials: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold' },
    headerText: { flex: 1, marginLeft: 12 },
    userName: { fontSize: 16, fontWeight: '700', color: '#f8fafc' },
    dateText: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

    actionButtons: { flexDirection: 'row', alignItems: 'center' },
    editText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
    deleteText: { color: '#ef4444', fontSize: 20, fontWeight: '300', paddingLeft: 5 },

    // Metrics Grid
    metricsGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15 },
    metricItem: { alignItems: 'center' },
    metricIcon: { fontSize: 16, marginBottom: 4 },
    metricLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', letterSpacing: 0.5, marginBottom: 2 },
    metricValue: { fontSize: 18, fontWeight: '800', color: '#f8fafc' },
    metricUnit: { fontSize: 12, fontWeight: '500', color: '#94a3b8' },

    // Media
    mediaContainer: { width: '100%', height: 240, position: 'relative' },
    mapImage: { width: '100%', height: '100%' },
    overlayPhotoLeft: { position: 'absolute', bottom: -15, left: 15, width: 80, height: 80, borderRadius: 12, borderWidth: 3, borderColor: '#1e293b' },
    overlayPhotoRight: { position: 'absolute', bottom: -15, right: 15, width: 80, height: 80, borderRadius: 12, borderWidth: 3, borderColor: '#1e293b' },

    // Footer (Socials Removed)
    contentFooter: { padding: 20, paddingTop: 25 },
    title: { fontSize: 16, color: '#f8fafc', lineHeight: 22 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '85%', backgroundColor: '#1e293b', padding: 25, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#f8fafc', marginBottom: 20 },
    input: { borderBottomWidth: 1, borderColor: '#fc4c02', fontSize: 16, paddingVertical: 10, color: '#f8fafc', marginBottom: 10 },
});