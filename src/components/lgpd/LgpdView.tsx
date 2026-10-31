import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, CheckCircle, FileText, Lock, Plus, X } from 'lucide-react';

export const LgpdView: React.FC = () => {
  const { token, activeTenantId, activeTenant } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    requester_name: '',
    requester_email: '',
    request_type: 'exportacao',
    notes: ''
  });

  const fetchRequests = async () => {
    if (!token || !activeTenantId) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/lgpd/requests', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error('Error fetching LGPD requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [token, activeTenantId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeTenantId) return;

    try {
      const res = await fetch('/api/lgpd/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        setIsModalOpen(false);
        setForm({ requester_name: '', requester_email: '', request_type: 'exportacao', notes: '' });
        fetchRequests();
      }
    } catch (err) {
      console.error('Error logging LGPD request:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-stone-100 flex items-center gap-2">
            <ShieldAlert className="text-emerald-400" />
            Central de Privacidade & LGPD para Terreiros
          </h1>
          <p className="text-xs md:text-sm text-stone-400 mt-1">
            Governança ética e estrita conformidade legal: proteção de dados pessoais e respeito absoluto à convicção religiosa.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-800 hover:bg-emerald-700 text-amber-300 border border-amber-500/40 shadow-sm self-start sm:self-auto"
        >
          <Plus size={16} /> Nova Solicitação de Titular
        </button>
      </div>

      {/* Guidelines Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-stone-900 border border-emerald-900/40 space-y-2">
          <div className="text-amber-400 font-bold text-xs flex items-center gap-1.5">
            <Lock size={14} /> Minimização de Dados
          </div>
          <p className="text-xs text-stone-300">
            O terreiro coleta apenas nome, e-mail e telefone estritamente necessários para organização dos trabalhos e rituais.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-stone-900 border border-emerald-900/40 space-y-2">
          <div className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
            <ShieldAlert size={14} /> Proteção a Dados Sensíveis
          </div>
          <p className="text-xs text-stone-300">
            A convicção religiosa e intenções do congá são mantidas sob estrito sigilo litúrgico, jamais comercializadas ou cedidas.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-stone-900 border border-emerald-900/40 space-y-2">
          <div className="text-amber-300 font-bold text-xs flex items-center gap-1.5">
            <FileText size={14} /> Direitos dos Titulares
          </div>
          <p className="text-xs text-stone-300">
            Qualquer visitante ou membro pode solicitar a exportação de seus dados cadastrais, correção ou exclusão definitiva.
          </p>
        </div>
      </div>

      {/* Requests Table */}
      <div className="rounded-xl bg-stone-900 border border-emerald-900/40 overflow-hidden shadow-lg">
        <div className="p-4 bg-[#09231b] border-b border-emerald-900/50">
          <h3 className="text-sm font-bold text-stone-100">Registro de Atendimento a Titulares</h3>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-stone-400">Carregando solicitações...</div>
        ) : requests.length === 0 ? (
          <div className="py-12 text-center text-stone-500">
            Nenhuma solicitação de titular pendente no momento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-stone-950 text-stone-400 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Titular</th>
                  <th className="py-3 px-4">E-mail</th>
                  <th className="py-3 px-4">Tipo de Solicitação</th>
                  <th className="py-3 px-4">Data Registro</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-emerald-950/20 transition-colors">
                    <td className="py-3 px-4 font-semibold text-stone-200">{req.requester_name}</td>
                    <td className="py-3 px-4 text-stone-400 text-xs">{req.requester_email}</td>
                    <td className="py-3 px-4 capitalize text-amber-300 text-xs">{req.request_type}</td>
                    <td className="py-3 px-4 text-stone-400 font-mono text-xs">
                      {new Date(req.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                        {req.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-stone-900 border border-emerald-800/60 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 bg-[#09231b] border-b border-emerald-900/50 flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <ShieldAlert size={18} className="text-amber-400" />
                Registrar Solicitação LGPD
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Nome do Titular *</label>
                <input
                  type="text"
                  required
                  value={form.requester_name}
                  onChange={(e) => setForm({ ...form, requester_name: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">E-mail de Contato *</label>
                <input
                  type="email"
                  required
                  value={form.requester_email}
                  onChange={(e) => setForm({ ...form, requester_email: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Tipo de Solicitação</label>
                <select
                  value={form.request_type}
                  onChange={(e) => setForm({ ...form, request_type: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                >
                  <option value="exportacao">Exportação Integral de Dados Cadastrais</option>
                  <option value="correcao">Retificação / Atualização de Dados</option>
                  <option value="revogacao_consentimento">Revogação de Notificações</option>
                  <option value="exclusao">Anonimização / Exclusão de Cadastro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Observações do Atendimento</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs bg-stone-800 text-stone-300 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-800 hover:bg-emerald-700 text-amber-300 rounded border border-amber-500/40"
                >
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
