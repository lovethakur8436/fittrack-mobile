// src/services/api.js
const API_BASE_URL = 'http://192.168.0.5:8080'; // <-- Insert your IP here

export const ApiService = {
    login: async (email, password) => {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        if (!res.ok) throw new Error('Login failed');
        return res.json();
    },

    getProfile: async (token) => {
        const res = await fetch(`${API_BASE_URL}/api/v1/profiles/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return res.json();
    },

    getActivities: async (token) => {
        const res = await fetch(`${API_BASE_URL}/api/v1/activities`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // Let's add a console.log here to debug why the map failed earlier!
        const data = await res.json();
        console.log("Activities fetched from API:", data);
        return data;
    },

    // Add these below your getActivities method
    updateActivity: async (token, id, data) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/activities/${id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status} - ${errorText}`);
            }
            return await response.json();
        } catch (error) {
            throw new Error(error.message || "Network request failed");
        }
    },

    deleteActivity: async (token, id) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/activities/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                // Edge Case: If the backend says 404, it's already deleted. Treat as success.
                if (response.status === 404) return true;

                const errorText = await response.text();
                throw new Error(`HTTP ${response.status} - ${errorText}`);
            }
            return true;
        } catch (error) {
            throw new Error(error.message || "Network request failed");
        }
    },

    createActivity: async (token, activityData) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/activities`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(activityData),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status} - ${errorText}`);
            }
            return await response.json();
        } catch (error) {
            throw new Error(error.message || "Network request failed");
        }
    },
};