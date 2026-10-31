import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Announcement } from '../../types';
import { Megaphone, Plus, Pin, Clock, User, X } from 'lucide-react';

export const AnnouncementsView: React.FC = () => {
  const { token, activeTenantId, hasRole } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({
    title: '',
    content: '',
    target_audience: 'todos',
    priority: 'normal' as const,
    is_pinned: false
  });

  const fetchAnnouncements = async () => {
    if (!token || !activeTenantId) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/announcements', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data);
      }
    } catch (err) {
      console.error('Error fetching announcements:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [token, activeTenantId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeTenantId) return;

    try {
      const res = await fetch('/api/announcements', {
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
        setForm({ title: '', content: '', target_audience: 'todos', priority: 'normal', is_pinned: false });
        fetchAnnouncements();
      }
    } catch (err) {
      console.error('Error posting announcement:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-stone-100 flex items-center gap-2">
            <Megaphone className="text-amber-400" />
            Mural de Comunicados da Casa
          </h1>
          <p className="text-xs md:text-sm text-stone-400 mt-1">
            Orientações gerais para médiuns, escalas de trabalho, escalas de limpeza e avisos doutrinários.
          </p>
        </div>

        {hasRole(['dirigente', 'admin_casa']) && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-800 hover:bg-emerald-700 text-amber-300 border border-amber-500/40 shadow-sm self-start sm:self-auto"
          >
            <Plus size={16} /> Publicar Comunicado
          </button>
        )}
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-stone-400">Carregando avisos...</div>
        ) : announcements.length === 0 ? (
          <div className="py-12 text-center text-stone-500 rounded-xl bg-stone-900 border border-emerald-950">
            Nenhum comunicado publicado no momento.
          </div>
        ) : (
          announcements.map((anc) => (
            <div
              key={anc.id}
              className={`p-5 rounded-2xl border shadow-md space-y-3 transition-all ${
                anc.is_pinned
                  ? 'bg-gradient-to-r from-[#0c2f24] to-stone-900 border-amber-500/50'
                  : 'bg-stone-900 border-emerald-900/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {anc.is_pinned && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      <Pin size={11} /> Fixado no Topo
                    </span>
                  )}
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-stone-950 text-stone-300 border border-stone-800">
                    Público: {anc.target_audience}
                  </span>
                </div>
                <div className="text-[11px] text-stone-400 flex items-center gap-1">
                  <Clock size={12} />
                  <span>{new Date(anc.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              <h3 className="text-base font-bold text-stone-100">{anc.title}</h3>
              <p className="text-xs md:text-sm text-stone-300 leading-relaxed whitespace-pre-line">
                {anc.content}
              </p>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-stone-900 border border-emerald-800/60 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 bg-[#09231b] border-b border-emerald-900/50 flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <Megaphone size={18} className="text-amber-400" />
                Novo Comunicado
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Título do Comunicado *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  placeholder="Ex: Escala de cambonos para a gira de sábado"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Conteúdo da Mensagem *</label>
                <textarea
                  rows={4}
                  required
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  placeholder="Instruções claras e respeitosas para a comunidade..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Destinatários</label>
                  <select
                    value={form.target_audience}
                    onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                  >
                    <option value="todos">Toda a Comunidade</option>
                    <option value="corrente">Apenas Médiuns da Corrente</option>
                    <option value="dirigentes">Apenas Dirigentes e Capitães</option>
                    <option value="novos_membros">Desenvolvimento Mediúnico</option>
                  </select>
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-300">
                    <input
                      type="checkbox"
                      checked={form.is_pinned}
                      onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
                      className="rounded bg-stone-950 border-stone-700 text-amber-500"
                    />
                    <span>Fixar no topo do mural</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-stone-800 text-stone-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-800 hover:bg-emerald-700 text-amber-300 border border-amber-500/40 shadow-sm"
                >
                  Publicar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
