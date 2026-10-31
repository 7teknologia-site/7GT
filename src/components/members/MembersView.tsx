import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Member } from '../../types';
import {
  Users,
  Search,
  Plus,
  Download,
  Filter,
  UserCheck,
  Phone,
  Mail,
  Calendar,
  X,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export const MembersView: React.FC = () => {
  const { token, activeTenantId, hasRole } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    spiritual_name: '',
    role_in_house: 'Filho(a) de Fé',
    status: 'active' as const,
    phone: '',
    email: '',
    document_cpf: '',
    entry_date: new Date().toISOString().slice(0, 10),
    notes: '',
    consent_communication: true
  });

  const fetchMembers = async () => {
    if (!token || !activeTenantId) return;
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (statusFilter !== 'all') queryParams.append('status', statusFilter);
      if (roleFilter !== 'all') queryParams.append('role', roleFilter);

      const res = await fetch(`/api/members?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        }
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [token, activeTenantId, search, statusFilter, roleFilter]);

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeTenantId) return;

    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Membro cadastrado com sucesso!' });
        setIsModalOpen(false);
        setFormData({
          full_name: '',
          spiritual_name: '',
          role_in_house: 'Filho(a) de Fé',
          status: 'active',
          phone: '',
          email: '',
          document_cpf: '',
          entry_date: new Date().toISOString().slice(0, 10),
          notes: '',
          consent_communication: true
        });
        fetchMembers();
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Erro ao cadastrar membro.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Erro de conexão: ' + err.message });
    }
  };

  const handleExportCSV = async () => {
    if (!token || !activeTenantId) return;
    try {
      const res = await fetch('/api/members/export/csv', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `membros_terreiro_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        alert('Erro ao exportar membros.');
      }
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    active: { label: 'Ativo na Corrente', color: 'bg-emerald-950 text-emerald-300 border-emerald-700/50' },
    in_training: { label: 'Em Desenvolvimento', color: 'bg-amber-950 text-amber-300 border-amber-700/50' },
    licensed: { label: 'Licenciado / Afastado', color: 'bg-stone-800 text-stone-300 border-stone-600' },
    inactive: { label: 'Inativo', color: 'bg-red-950 text-red-300 border-red-800/50' },
    honorary: { label: 'Membro de Honra', color: 'bg-purple-950 text-purple-300 border-purple-700/50' }
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-stone-100 flex items-center gap-2">
            <Users className="text-emerald-400" />
            Comunidade & Membros da Corrente
          </h1>
          <p className="text-xs md:text-sm text-stone-400 mt-1">
            Cadastro completo de filhos de fé, médiuns, cambonos, ogãs e corpo sacerdotal.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-700 transition-colors shadow-xs"
          >
            <Download size={14} /> Exportar CSV
          </button>
          {hasRole(['dirigente', 'admin_casa']) && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-800 hover:bg-emerald-700 text-amber-300 border border-amber-500/30 transition-colors shadow-sm"
            >
              <Plus size={16} /> Novo Membro
            </button>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
              : 'bg-red-950/60 text-red-300 border border-red-800/40'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-stone-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="p-4 rounded-xl bg-stone-900 border border-emerald-900/40 shadow-md flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, nome espiritual, e-mail ou telefone..."
            className="w-full pl-9 pr-4 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs md:text-sm text-stone-100 placeholder-stone-500 focus:outline-hidden focus:border-emerald-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-300 focus:outline-hidden focus:border-emerald-600"
          >
            <option value="all">Todos os Status</option>
            <option value="active">Ativo na Corrente</option>
            <option value="in_training">Em Desenvolvimento</option>
            <option value="licensed">Licenciado</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
      </div>

      {/* Members Table */}
      <div className="rounded-xl bg-stone-900 border border-emerald-900/40 overflow-hidden shadow-lg">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-stone-400">Carregando lista de membros...</div>
        ) : members.length === 0 ? (
          <div className="py-12 text-center text-stone-400">
            <Users size={32} className="mx-auto text-stone-600 mb-2" />
            <p className="text-sm font-semibold">Nenhum membro encontrado</p>
            <p className="text-xs text-stone-500 mt-1">Ajuste os filtros ou cadastre um novo membro.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-[#09231b] border-b border-emerald-900/50 text-emerald-300 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Nome & Função</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Contatos</th>
                  <th className="py-3 px-4">Data Ingresso</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                {members.map((m) => {
                  const statusInfo = statusLabels[m.status] || {
                    label: m.status,
                    color: 'bg-stone-800 text-stone-300'
                  };

                  return (
                    <tr key={m.id} className="hover:bg-emerald-950/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-stone-100">{m.full_name}</div>
                        <div className="text-xs text-amber-300/90 font-medium">
                          {m.role_in_house}
                          {m.spiritual_name && (
                            <span className="text-stone-400 font-normal"> ({m.spiritual_name})</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-300 space-y-0.5">
                        {m.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone size={12} className="text-emerald-400" />
                            <span>{m.phone}</span>
                          </div>
                        )}
                        {m.email && (
                          <div className="flex items-center gap-1.5 text-stone-400">
                            <Mail size={12} />
                            <span>{m.email}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-400">
                        {m.entry_date ? new Date(m.entry_date).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setViewingMember(m)}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700"
                        >
                          Ver Ficha
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Member 360 Details Modal */}
      {viewingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-stone-900 border border-emerald-800/60 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 bg-[#09231b] border-b border-emerald-900/50 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                  Ficha do Médium / Membro da Corrente
                </span>
                <h3 className="text-base font-bold text-stone-100">{viewingMember.full_name}</h3>
              </div>
              <button onClick={() => setViewingMember(null)} className="text-stone-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs md:text-sm">
              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-400">Cargo / Função:</span>
                  <span className="font-bold text-amber-300">{viewingMember.role_in_house}</span>
                </div>
                {viewingMember.spiritual_name && (
                  <div className="flex justify-between">
                    <span className="text-stone-400">Nome Espiritual / Djina:</span>
                    <span className="text-stone-200 font-semibold">{viewingMember.spiritual_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-stone-400">Status na Corrente:</span>
                  <span className="font-semibold text-emerald-400 capitalize">{viewingMember.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Data de Ingresso:</span>
                  <span className="text-stone-300">
                    {viewingMember.entry_date ? new Date(viewingMember.entry_date).toLocaleDateString('pt-BR') : 'Não informada'}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <span className="text-xs font-bold text-emerald-400 block mb-1">Canais de Contato</span>
                <div className="flex justify-between">
                  <span className="text-stone-400">Telefone:</span>
                  <span className="text-stone-200 font-mono">{viewingMember.phone || 'Não informado'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">E-mail:</span>
                  <span className="text-stone-300">{viewingMember.email || 'Não informado'}</span>
                </div>
              </div>

              {viewingMember.notes && (
                <div>
                  <span className="text-xs font-bold text-stone-300 block mb-1">Anotações Administrativas</span>
                  <p className="p-3 rounded-lg bg-stone-950 border border-stone-800 text-stone-300 italic text-xs">
                    "{viewingMember.notes}"
                  </p>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewingMember(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-stone-800 text-stone-200 hover:bg-stone-700"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-stone-900 border border-emerald-800/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-[#09231b] border-b border-emerald-900/50 flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <Users size={18} className="text-amber-400" />
                Cadastrar Novo Membro da Corrente
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 focus:outline-hidden focus:border-emerald-600"
                    placeholder="Nome civil do médium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    Nome Espiritual / Djina (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.spiritual_name}
                    onChange={(e) => setFormData({ ...formData, spiritual_name: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 focus:outline-hidden focus:border-emerald-600"
                    placeholder="Ex: Ogum Sete Espadas"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    Cargo / Função na Casa *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.role_in_house}
                    onChange={(e) => setFormData({ ...formData, role_in_house: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 focus:outline-hidden focus:border-emerald-600"
                    placeholder="Ex: Filho de Santo, Ogã, Cambono, Mãe Pequena"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">
                    Status na Corrente
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e: any) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 focus:outline-hidden focus:border-emerald-600"
                  >
                    <option value="active">Ativo na Corrente</option>
                    <option value="in_training">Em Desenvolvimento</option>
                    <option value="licensed">Licenciado</option>
                    <option value="honorary">Membro de Honra</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 focus:outline-hidden focus:border-emerald-600"
                    placeholder="(11) 98765-4321"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 focus:outline-hidden focus:border-emerald-600"
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Data de Ingresso</label>
                  <input
                    type="date"
                    value={formData.entry_date}
                    onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 focus:outline-hidden focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">CPF (Opcional)</label>
                  <input
                    type="text"
                    value={formData.document_cpf}
                    onChange={(e) => setFormData({ ...formData, document_cpf: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 focus:outline-hidden focus:border-emerald-600"
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">
                  Observações Administrativas (Privado)
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100 focus:outline-hidden focus:border-emerald-600"
                  placeholder="Informações administrativas da casa..."
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="consent"
                  checked={formData.consent_communication}
                  onChange={(e) => setFormData({ ...formData, consent_communication: e.target.checked })}
                  className="rounded bg-stone-950 border-stone-700 text-emerald-600 focus:ring-0"
                />
                <label htmlFor="consent" className="text-xs text-stone-400">
                  Consentimento para avisos institucionais da casa e escalas de gira (LGPD).
                </label>
              </div>

              <div className="pt-4 border-t border-stone-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-800 hover:bg-emerald-700 text-amber-300 border border-amber-500/40 shadow-sm"
                >
                  Salvar Membro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
