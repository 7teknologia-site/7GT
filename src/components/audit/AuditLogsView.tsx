import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuditLog } from '../../types';
import { ShieldCheck, Clock, User, Eye, X, Filter } from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const { token, activeTenantId } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    if (!token || !activeTenantId) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/audit', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [token, activeTenantId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-stone-100 flex items-center gap-2">
          <ShieldCheck className="text-emerald-400" />
          Trilha de Auditoria & Segurança SaaS
        </h1>
        <p className="text-xs md:text-sm text-stone-400 mt-1">
          Registro imutável de todas as ações críticas: acessos, conferências financeiras, alterações em membros e rituais.
        </p>
      </div>

      <div className="rounded-xl bg-stone-900 border border-emerald-900/40 overflow-hidden shadow-lg">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-stone-400">Carregando trilha de auditoria...</div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-stone-500">Nenhum registro de auditoria encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-[#09231b] border-b border-emerald-900/50 text-emerald-300 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Operador (Ator)</th>
                  <th className="py-3 px-4">Ação Realizada</th>
                  <th className="py-3 px-4">Entidade Afetada</th>
                  <th className="py-3 px-4 text-right">Metadados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-emerald-950/20 transition-colors">
                    <td className="py-3 px-4 text-stone-400 font-mono text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 font-semibold text-stone-200">
                      {log.actor_name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-amber-300 px-2 py-0.5 rounded bg-stone-950 border border-stone-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stone-300 capitalize text-xs">
                      {log.entity_type} ({log.entity_id})
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 text-xs font-medium rounded bg-stone-800 hover:bg-stone-700 text-stone-200"
                      >
                        Inspecionar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-stone-900 border border-emerald-800/60 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 bg-[#09231b] border-b border-emerald-900/50 flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <ShieldCheck size={18} className="text-amber-400" />
                Registro de Auditoria #{selectedLog.id}
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-stone-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs md:text-sm">
              <div className="grid grid-cols-2 gap-2 text-stone-300">
                <div>Ação: <strong className="text-amber-300">{selectedLog.action}</strong></div>
                <div>Ator: <strong className="text-stone-100">{selectedLog.actor_name}</strong></div>
                <div>Entidade: <strong className="text-emerald-400">{selectedLog.entity_type}</strong></div>
                <div>ID: <strong className="font-mono text-stone-400">{selectedLog.entity_id}</strong></div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-stone-400 mb-1">
                  Metadados e Parâmetros (JSON):
                </span>
                <pre className="p-4 rounded-xl bg-stone-950 border border-stone-800 text-emerald-400 font-mono text-xs overflow-x-auto">
                  {JSON.stringify(selectedLog.details_json, null, 2)}
                </pre>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 text-xs bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
