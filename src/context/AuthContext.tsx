import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, TenantMembership, Tenant, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  memberships: TenantMembership[];
  activeTenant: Tenant | null;
  activeTenantId: string | null;
  activeRole: UserRole | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchTenant: (tenantId: string) => Promise<boolean>;
  refreshTenantData: () => Promise<void>;
  hasRole: (allowedRoles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('7t_token'));
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(localStorage.getItem('7t_tenant_id'));
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshTenantData = async () => {
    const currentToken = token || localStorage.getItem('7t_token');
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const tenantHeader = activeTenantId || localStorage.getItem('7t_tenant_id');
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${currentToken}`,
          'X-Tenant-Id': tenantHeader || ''
        }
      });

      if (!res.ok) {
        throw new Error('Sessão expirada');
      }

      const data = await res.json();
      setUser(data.user);
      setMemberships(data.memberships || []);
      setActiveTenant(data.activeTenant || null);
      setActiveTenantId(data.activeTenantId || null);
      setActiveRole(data.activeRole || null);

      if (data.activeTenantId) {
        localStorage.setItem('7t_tenant_id', data.activeTenantId);
      }
    } catch (err) {
      console.warn('Sessão restaurada falhou, limpando token:', err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshTenantData();
  }, [token]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Credenciais inválidas' };
      }

      localStorage.setItem('7t_token', data.token);
      if (data.activeTenantId) {
        localStorage.setItem('7t_tenant_id', data.activeTenantId);
      }

      setToken(data.token);
      setUser(data.user);
      setMemberships(data.memberships || []);
      setActiveTenantId(data.activeTenantId || null);

      await refreshTenantData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: 'Erro de conexão com o servidor: ' + err.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('7t_token');
    localStorage.removeItem('7t_tenant_id');
    setToken(null);
    setUser(null);
    setActiveTenant(null);
    setActiveTenantId(null);
    setActiveRole(null);
    setMemberships([]);
  };

  const switchTenant = async (newTenantId: string): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch('/api/auth/switch-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tenantId: newTenantId })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Não foi possível alternar de terreiro.');
        return false;
      }

      localStorage.setItem('7t_token', data.token);
      localStorage.setItem('7t_tenant_id', newTenantId);
      setToken(data.token);
      setActiveTenantId(newTenantId);
      await refreshTenantData();
      return true;
    } catch (err) {
      console.error('Switch tenant error:', err);
      return false;
    }
  };

  const hasRole = (allowedRoles: UserRole[]): boolean => {
    if (!user) return false;
    if (user.is_superadmin) return true;
    if (!activeRole) return false;
    return allowedRoles.includes(activeRole);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        memberships,
        activeTenant,
        activeTenantId,
        activeRole,
        isLoading,
        login,
        logout,
        switchTenant,
        refreshTenantData,
        hasRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
