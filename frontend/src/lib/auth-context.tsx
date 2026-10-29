"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface User {
  user_id: number | string;
  email: string;
  name: string;
  role?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (userData: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  isLoading: true,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("preppr_user");
      const storedId = localStorage.getItem("preppr_user_id");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else if (storedId) {
        setUser({
          user_id: storedId,
          email: "candidate@example.com",
          name: "Candidate",
          role: "Software Engineer",
        });
      }
    } catch (e) {
      console.error("Failed to parse stored auth session:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    try {
      localStorage.setItem("preppr_user", JSON.stringify(userData));
      localStorage.setItem("preppr_user_id", String(userData.user_id));
    } catch (e) {
      console.error("Failed to persist user session:", e);
    }
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem("preppr_user");
      localStorage.removeItem("preppr_user_id");
    } catch (e) {
      console.error("Failed to clear auth session:", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

