import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Settings, ShieldCheck, QrCode, Phone, Palette, Building, CheckCircle2, X } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { token, activeTenantId, activeTenant, refreshTenantData, hasRole } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    legal_name: '',
    document_cnpj: '',
    email: '',
    phone: '',
    address_city: '',
    address_state: '',
    default_pix_key: '',
    pix_key_type: 'cnpj',
    pix_recipient_name: '',
    whatsapp_contact: '',
    primary_color: '#0e382b',
    secondary_color: '#1b4d3e',
    accent_color: '#c5a059',
    house_tradition: 'Umbanda',
    tagline: ''
  });
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (activeTenant) {
      setFormData({
        name: activeTenant.name || '',
        legal_name: activeTenant.legal_name || '',
        document_cnpj: activeTenant.document_cnpj || '',
        email: activeTenant.email || '',
        phone: activeTenant.phone || '',
        address_city: activeTenant.address_city || '',
        address_state: activeTenant.address_state || '',
        default_pix_key: activeTenant.default_pix_key || '',
        pix_key_type: activeTenant.pix_key_type || 'cnpj',
        pix_recipient_name: activeTenant.pix_recipient_name || '',
        whatsapp_contact: activeTenant.whatsapp_contact || '',
        primary_color: activeTenant.primary_color || '#0e382b',
        secondary_color: activeTenant.secondary_color || '#1b4d3e',
        accent_color: activeTenant.accent_color || '#c5a059',
        house_tradition: activeTenant.house_tradition || 'Umbanda',
        tagline: activeTenant.tagline || ''
      });
    }
  }, [activeTenant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeTenantId) return;

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setFeedback('Configurações salvas com sucesso!');
        await refreshTenantData();
      } else {
        alert('Erro ao atualizar configurações.');
      }
    } catch (err: any) {
      alert('Erro: ' + err.message);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-stone-100 flex items-center gap-2">
          <Settings className="text-amber-400" />
          Configurações & Identidade do Terreiro
        </h1>
        <p className="text-xs md:text-sm text-stone-400 mt-1">
          Personalize as chaves PIX da casa, contatos de WhatsApp, cores institucionais e dados cadastrais.
        </p>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-stone-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Dados Gerais da Casa */}
        <div className="p-6 rounded-2xl bg-stone-900 border border-emerald-900/40 shadow-lg space-y-4">
          <h2 className="text-sm font-bold text-stone-100 flex items-center gap-2 border-b border-stone-800 pb-3">
            <Building size={16} className="text-emerald-400" />
            Dados Institucionais do Terreiro
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Nome do Terreiro / Templo *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Razão Social / Associação</label>
              <input
                type="text"
                value={formData.legal_name}
                onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">CNPJ da Associação</label>
              <input
                type="text"
                value={formData.document_cnpj}
                onChange={(e) => setFormData({ ...formData, document_cnpj: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Cidade</label>
              <input
                type="text"
                value={formData.address_city}
                onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Estado (UF)</label>
              <input
                type="text"
                value={formData.address_state}
                onChange={(e) => setFormData({ ...formData, address_state: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                placeholder="SP"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Chaves PIX e WhatsApp */}
        <div className="p-6 rounded-2xl bg-stone-900 border border-emerald-900/40 shadow-lg space-y-4">
          <h2 className="text-sm font-bold text-stone-100 flex items-center gap-2 border-b border-stone-800 pb-3">
            <QrCode size={16} className="text-amber-400" />
            Configuração de Pagamento PIX e Contato WhatsApp
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Tipo de Chave PIX</label>
              <select
                value={formData.pix_key_type}
                onChange={(e) => setFormData({ ...formData, pix_key_type: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
              >
                <option value="cnpj">CNPJ</option>
                <option value="cpf">CPF</option>
                <option value="email">E-mail</option>
                <option value="telefone">Telefone</option>
                <option value="chave_aleatoria">Chave Aleatória (EVP)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-stone-300 mb-1">Chave PIX Oficial *</label>
              <input
                type="text"
                required
                value={formData.default_pix_key}
                onChange={(e) => setFormData({ ...formData, default_pix_key: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-amber-300 font-mono font-bold"
                placeholder="Chave utilizada para rituais e contribuições"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Nome do Favorecido no PIX</label>
              <input
                type="text"
                value={formData.pix_recipient_name}
                onChange={(e) => setFormData({ ...formData, pix_recipient_name: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                placeholder="Ex: Associação Terreiro de Umbanda"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">WhatsApp para Confirmações</label>
              <input
                type="text"
                value={formData.whatsapp_contact}
                onChange={(e) => setFormData({ ...formData, whatsapp_contact: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                placeholder="(11) 98765-4321"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Tradição e Cores da Casa */}
        <div className="p-6 rounded-2xl bg-stone-900 border border-emerald-900/40 shadow-lg space-y-4">
          <h2 className="text-sm font-bold text-stone-100 flex items-center gap-2 border-b border-stone-800 pb-3">
            <Palette size={16} className="text-emerald-400" />
            Identidade Religiosa e Visual
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Tradição / Matriz</label>
              <input
                type="text"
                value={formData.house_tradition}
                onChange={(e) => setFormData({ ...formData, house_tradition: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                placeholder="Ex: Umbanda Tradicional, Candomblé Ketu, Angola, Omolocô"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Lema / Frase Sagrada da Casa</label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                placeholder="Ex: Caridade, Humildade e Respeito aos Orixás"
              />
            </div>
          </div>
        </div>

        {hasRole(['dirigente', 'admin_casa']) && (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-bold rounded-xl bg-emerald-800 hover:bg-emerald-700 text-amber-300 border border-amber-500/40 shadow-md transition-all"
            >
              Salvar Alterações
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
