import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Kanban,
  Calendar,
  Sparkles,
  DollarSign,
  Package,
  Megaphone,
  ShieldAlert,
  Settings,
  Building2,
  LogOut,
  ChevronDown,
  Menu,
  X,
  ExternalLink,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

interface AppLayoutProps {
  currentView: string;
  onViewChange: (view: string) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ currentView, onViewChange, children }) => {
  const { user, activeTenant, memberships, activeRole, switchTenant, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'members', label: 'Pessoas & Membros', icon: Users },
    { id: 'crm', label: 'CRM & Atendimento', icon: Kanban },
    { id: 'calendar', label: 'Calendário & Giras', icon: Calendar },
    { id: 'rituals', label: 'Rituais a Distância', icon: Sparkles, badge: 'PIX/Manual' },
    { id: 'financial', label: 'Financeiro & Caixa', icon: DollarSign },
    { id: 'inventory', label: 'Estoque & Materiais', icon: Package },
    { id: 'announcements', label: 'Mural de Avisos', icon: Megaphone },
    { id: 'audit', label: 'Trilha de Auditoria', icon: ShieldCheck },
    { id: 'lgpd', label: 'Privacidade LGPD', icon: ShieldAlert },
    { id: 'settings', label: 'Configurações da Casa', icon: Settings }
  ];

  // If superadmin, add 7Teknologia SaaS Admin item
  if (user?.is_superadmin) {
    navItems.push({ id: 'superadmin', label: 'Console 7Teknologia', icon: Building2 });
  }

  const roleLabels: Record<string, string> = {
    superadmin: 'Superadmin 7T',
    dirigente: 'Dirigente Espiritual',
    admin_casa: 'Administrador da Casa',
    financeiro: 'Tesouraria / Financeiro',
    responsavel_area: 'Responsável de Área',
    responsavel_rituais: 'Coordenador de Rituais',
    responsavel_crm: 'Atendimento & CRM',
    membro: 'Médium / Membro',
    visitante: 'Visitante'
  };

  return (
    <div className="min-h-screen flex bg-stone-900 text-stone-100 font-sans">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 md:hidden backdrop-blur-xs"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-[#09231b] border-r border-emerald-900/40 flex flex-col transition-transform duration-200 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-emerald-900/40 flex items-center justify-between bg-[#061913]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-950/40 border border-amber-400/30 font-serif font-bold text-stone-950 text-xl">
              7
            </div>
            <div>
              <div className="text-sm font-bold text-stone-100 tracking-tight leading-none">
                7 Gestão de Terreiros
              </div>
              <div className="text-[10px] text-amber-400/90 font-medium mt-1">
                Uma solução 7Teknologia.
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden text-stone-400 hover:text-white p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Current Active Terreiro Card */}
        <div className="p-4 bg-[#0c2f24] border-b border-emerald-900/40">
          <div className="text-[10px] uppercase tracking-wider text-emerald-400/80 font-medium mb-1">
            Terreiro Ativo
          </div>
          <div className="relative">
            <button
              onClick={() => setIsTenantDropdownOpen(!isTenantDropdownOpen)}
              className="w-full text-left flex items-center justify-between p-2 rounded-lg bg-emerald-950/60 border border-emerald-700/30 hover:border-amber-500/40 transition-colors"
            >
              <div className="truncate pr-2">
                <div className="text-sm font-semibold text-stone-100 truncate">
                  {activeTenant?.name || 'Carregando...'}
                </div>
                <div className="text-xs text-amber-300/80">
                  {activeTenant?.house_tradition || 'Tradição Religiosa'}
                </div>
              </div>
              <ChevronDown size={16} className="text-amber-400 shrink-0" />
            </button>

            {/* Tenant Switcher Dropdown */}
            {isTenantDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-stone-950 border border-emerald-700/50 rounded-lg shadow-2xl py-2 z-50">
                <div className="px-3 py-1 text-[11px] font-medium text-stone-400 uppercase tracking-wider">
                  Alternar Terreiro
                </div>
                {memberships.map((m) => (
                  <button
                    key={m.tenant_id}
                    onClick={() => {
                      switchTenant(m.tenant_id);
                      setIsTenantDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-emerald-900/30 transition-colors ${
                      m.tenant_id === activeTenant?.id ? 'text-amber-400 font-bold bg-emerald-950/50' : 'text-stone-300'
                    }`}
                  >
                    <span className="truncate">{m.tenant_name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/30">
                      {m.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-800 to-emerald-700 text-amber-300 shadow-md shadow-emerald-950/50 border border-amber-500/30'
                    : 'text-stone-300 hover:bg-emerald-950/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? 'text-amber-400' : 'text-emerald-400'} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Public Ritual Shortcut & User Footer */}
        <div className="p-4 border-t border-emerald-900/40 bg-[#061913] space-y-3">
          <button
            onClick={() => onViewChange('public-ritual-preview')}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 transition-colors"
          >
            <ExternalLink size={14} />
            <span>Página Pública de Inscrição</span>
          </button>

          <div className="flex items-center justify-between pt-2 border-t border-emerald-900/30">
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-8 h-8 rounded-full bg-emerald-800 flex items-center justify-center font-bold text-amber-300 text-xs border border-amber-500/30">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-stone-100 truncate">
                  {user?.full_name}
                </div>
                <div className="text-[10px] text-emerald-400 font-medium">
                  {roleLabels[activeRole || 'membro'] || activeRole}
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              title="Encerrar sessão"
              className="p-1.5 text-stone-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-[#09231b] border-b border-emerald-900/40 px-4 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-stone-300 hover:text-white rounded-lg hover:bg-emerald-900/50"
            >
              <Menu size={20} />
            </button>
            <div>
              <h2 className="text-base md:text-lg font-semibold text-stone-100 flex items-center gap-2">
                <span>{activeTenant?.name || 'Terreiro'}</span>
                <span className="hidden sm:inline-block text-[11px] font-normal px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Plano {activeTenant?.plan_name || 'Gestão'}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/80 px-3 py-1.5 rounded-full border border-emerald-700/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Multi-tenant Isolado com PostgreSQL</span>
            </div>

            <div className="flex items-center gap-2 pl-2 border-l border-emerald-900/50">
              <span className="text-xs text-stone-300 hidden sm:inline">
                Olá, <strong className="text-amber-300">{user?.full_name?.split(' ')[0]}</strong>
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic View Body */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-stone-950">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
