// src/context/AuthContext.js
import React, { createContext, useState, useRef, useCallback } from 'react';
import { ApiService } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(null);
    const [profile, setProfile] = useState(null);
    const tokenRef = useRef(null);

    const login = async (email, password) => {
        const data = await ApiService.login(email, password);
        setToken(data.token);
        tokenRef.current = data.token;

        // Fetch profile immediately after getting the token
        const userProfile = await ApiService.getProfile(data.token);
        setProfile(userProfile);
    };

    const logout = () => {
        setToken(null);
        setProfile(null);
        tokenRef.current = null;
    };

    const refreshProfile = useCallback(async () => {
        const currentToken = tokenRef.current;
        if (!currentToken) return;
        try {
            const updatedProfile = await ApiService.getProfile(currentToken);
            setProfile(updatedProfile);
        } catch (error) {
            console.error("Failed to refresh profile:", error);
        }
    }, []);

    return (
        <AuthContext.Provider value={{ token, profile, login, logout, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};