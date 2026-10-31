import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardView } from './components/dashboard/DashboardView';
import { MembersView } from './components/members/MembersView';
import { CrmView } from './components/crm/CrmView';
import { CalendarView } from './components/calendar/CalendarView';
import { RitualsAdminView } from './components/rituals/RitualsAdminView';
import { PublicRitualPage } from './components/rituals/PublicRitualPage';
import { FinancialView } from './components/financial/FinancialView';
import { InventoryView } from './components/inventory/InventoryView';
import { AnnouncementsView } from './components/announcements/AnnouncementsView';
import { AuditLogsView } from './components/audit/AuditLogsView';
import { LgpdView } from './components/lgpd/LgpdView';
import { SettingsView } from './components/settings/SettingsView';
import { SuperadminView } from './components/admin/SuperadminView';
import { LoginModal } from './components/auth/LoginModal';
import { RegisterModal } from './components/auth/RegisterModal';

function MainRouter() {
  const { user, isLoading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [publicSlug, setPublicSlug] = useState('trabalho-prosperidade-oxum-2026');

  // Check URL pathname for /r/:slug
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/r/')) {
      const slug = path.replace('/r/', '').trim();
      if (slug) {
        setPublicSlug(slug);
        setCurrentView('public-ritual-preview');
      }
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center text-stone-400">
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-3" />
        <p className="text-xs uppercase tracking-widest text-amber-400 font-bold">
          7Teknologia Gestão de Terreiros
        </p>
        <p className="text-xs text-stone-500 mt-1">Carregando dados seguros no PostgreSQL...</p>
      </div>
    );
  }

  // If in public ritual view
  if (currentView === 'public-ritual-preview') {
    return (
      <PublicRitualPage
        slug={publicSlug}
        onBackToApp={user ? () => setCurrentView('rituals') : () => setCurrentView('dashboard')}
      />
    );
  }

  // If not logged in, render Login
  if (!user) {
    return (
      <>
        <LoginModal
          onOpenRegister={() => setIsRegisterOpen(true)}
          onPreviewPublic={() => setCurrentView('public-ritual-preview')}
        />
        {isRegisterOpen && (
          <RegisterModal
            onClose={() => setIsRegisterOpen(false)}
            onSuccess={() => {
              setIsRegisterOpen(false);
              setCurrentView('dashboard');
            }}
          />
        )}
      </>
    );
  }

  return (
    <AppLayout currentView={currentView} onViewChange={setCurrentView}>
      {currentView === 'dashboard' && <DashboardView onNavigate={setCurrentView} />}
      {currentView === 'members' && <MembersView />}
      {currentView === 'crm' && <CrmView />}
      {currentView === 'calendar' && <CalendarView />}
      {currentView === 'rituals' && (
        <RitualsAdminView
          onPreviewPublic={(slug) => {
            setPublicSlug(slug);
            setCurrentView('public-ritual-preview');
          }}
        />
      )}
      {currentView === 'financial' && <FinancialView />}
      {currentView === 'inventory' && <InventoryView />}
      {currentView === 'announcements' && <AnnouncementsView />}
      {currentView === 'audit' && <AuditLogsView />}
      {currentView === 'lgpd' && <LgpdView />}
      {currentView === 'settings' && <SettingsView />}
      {currentView === 'superadmin' && <SuperadminView />}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainRouter />
    </AuthProvider>
  );
}
