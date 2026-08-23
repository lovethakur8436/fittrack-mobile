// src/services/api.js
const API_BASE_URL = 'http://192.168.0.4:8080'; // <-- Insert your IP here

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
    }
};