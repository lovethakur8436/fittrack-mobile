// src/context/AuthContext.js
import React, { createContext, useState } from 'react';
import { ApiService } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(null);
    const [profile, setProfile] = useState(null);

    const login = async (email, password) => {
        const data = await ApiService.login(email, password);
        setToken(data.token);

        // Fetch profile immediately after getting the token
        const userProfile = await ApiService.getProfile(data.token);
        setProfile(userProfile);
    };

    const logout = () => {
        setToken(null);
        setProfile(null);
    };

    return (
        <AuthContext.Provider value={{ token, profile, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};