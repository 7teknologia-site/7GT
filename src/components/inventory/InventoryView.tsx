import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { InventoryItem } from '../../types';
import {
  Package,
  Plus,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  CheckCircle,
  X,
  Boxes
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const { token, activeTenantId, hasRole } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Item Form
  const [itemForm, setItemForm] = useState({
    name: '',
    category: 'velas',
    unit: 'un',
    quantity: 0,
    min_quantity: 10,
    unit_cost: 0,
    supplier_name: '',
    storage_location: ''
  });

  // Movement Form
  const [movForm, setMovForm] = useState({
    type: 'entrada',
    quantity: '',
    notes: ''
  });

  const fetchInventory = async () => {
    if (!token || !activeTenantId) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/inventory', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [token, activeTenantId]);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeTenantId) return;

    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        },
        body: JSON.stringify(itemForm)
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Item adicionado ao estoque!' });
        setIsItemModalOpen(false);
        fetchInventory();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Erro ao cadastrar item.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Erro: ' + err.message });
    }
  };

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeTenantId || !movementItem) return;

    try {
      const res = await fetch(`/api/inventory/${movementItem.id}/movements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': activeTenantId
        },
        body: JSON.stringify(movForm)
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', text: `Movimentação registrada para ${movementItem.name}!` });
        setMovementItem(null);
        setMovForm({ type: 'entrada', quantity: '', notes: '' });
        fetchInventory();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Erro ao movimentar.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Erro: ' + err.message });
    }
  };

  const filteredItems = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-stone-100 flex items-center gap-2">
            <Package className="text-emerald-400" />
            Estoque & Patrimônio do Terreiro
          </h1>
          <p className="text-xs md:text-sm text-stone-400 mt-1">
            Controle de velas de 7 dias, defumadores, ervas sagradas, tecidos, quartinhas e materiais litúrgicos.
          </p>
        </div>

        {hasRole(['dirigente', 'admin_casa', 'financeiro', 'responsavel_area']) && (
          <button
            onClick={() => setIsItemModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-800 hover:bg-emerald-700 text-amber-300 border border-amber-500/40 shadow-sm self-start sm:self-auto"
          >
            <Plus size={16} /> Novo Item
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
              : 'bg-red-950/60 text-red-300 border border-red-800/40'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-stone-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="p-4 rounded-xl bg-stone-900 border border-emerald-900/40 shadow-md">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por item, categoria ou localização no terreiro..."
            className="w-full pl-9 pr-4 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs md:text-sm text-stone-100 placeholder-stone-500"
          />
        </div>
      </div>

      {/* Inventory Table */}
      <div className="rounded-xl bg-stone-900 border border-emerald-900/40 overflow-hidden shadow-lg">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-stone-400">Carregando itens...</div>
        ) : filteredItems.length === 0 ? (
          <div className="py-12 text-center text-stone-500">Nenhum item em estoque com esses filtros.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-[#09231b] border-b border-emerald-900/50 text-emerald-300 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Item & Localização</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Quantidade Atual</th>
                  <th className="py-3 px-4">Estoque Mínimo</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4 text-right">Movimentar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                {filteredItems.map((item) => {
                  const isLow = Number(item.quantity) <= Number(item.min_quantity);

                  return (
                    <tr key={item.id} className="hover:bg-emerald-950/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-stone-100">{item.name}</div>
                        <div className="text-xs text-stone-400">{item.storage_location || 'Depósito Geral'}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-amber-300 capitalize">
                        {item.category.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-stone-100 text-sm">
                        {Number(item.quantity).toFixed(0)} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-stone-400 text-xs">
                        {Number(item.min_quantity).toFixed(0)} {item.unit}
                      </td>
                      <td className="py-3 px-4">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-800/60 animate-pulse">
                            <AlertTriangle size={12} /> Estoque Baixo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                            Adequado
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setMovementItem(item)}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700"
                        >
                          Entrada / Saída
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

      {/* Movement Modal */}
      {movementItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-stone-900 border border-emerald-800/60 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 bg-[#09231b] border-b border-emerald-900/50 flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <Boxes size={18} className="text-amber-400" />
                Registrar Movimento no Estoque
              </h3>
              <button onClick={() => setMovementItem(null)} className="text-stone-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRecordMovement} className="p-5 space-y-4">
              <div className="text-xs text-stone-300">
                Item: <strong className="text-amber-300">{movementItem.name}</strong> • Saldo atual:{' '}
                <strong>{Number(movementItem.quantity).toFixed(0)} {movementItem.unit}</strong>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Tipo de Movimento</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMovForm({ ...movForm, type: 'entrada' })}
                    className={`py-2 text-xs font-bold rounded-lg border ${
                      movForm.type === 'entrada'
                        ? 'bg-emerald-800 border-emerald-500 text-stone-100'
                        : 'bg-stone-950 border-stone-800 text-stone-400'
                    }`}
                  >
                    Entrada / Compra (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovForm({ ...movForm, type: 'saida' })}
                    className={`py-2 text-xs font-bold rounded-lg border ${
                      movForm.type === 'saida'
                        ? 'bg-amber-900 border-amber-600 text-stone-100'
                        : 'bg-stone-950 border-stone-800 text-stone-400'
                    }`}
                  >
                    Saída / Consumo (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Quantidade ({movementItem.unit}) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={movForm.quantity}
                  onChange={(e) => setMovForm({ ...movForm, quantity: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Motivo / Observação</label>
                <input
                  type="text"
                  value={movForm.notes}
                  onChange={(e) => setMovForm({ ...movForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                  placeholder="Ex: Utilizado na gira de Pretos Velhos"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMovementItem(null)}
                  className="px-3 py-1.5 text-xs bg-stone-800 text-stone-300 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-800 hover:bg-emerald-700 text-amber-300 rounded border border-amber-500/40"
                >
                  Confirmar Movimento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Item Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-stone-900 border border-emerald-800/60 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 bg-[#09231b] border-b border-emerald-900/50 flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <Plus size={18} className="text-amber-400" />
                Cadastrar Item no Estoque
              </h3>
              <button onClick={() => setIsItemModalOpen(false)} className="text-stone-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateItem} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Nome do Item *</label>
                <input
                  type="text"
                  required
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  placeholder="Ex: Vela Bicolor Vermelha e Preta"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Categoria</label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                  >
                    <option value="velas">Velas e Votivas</option>
                    <option value="defumacao">Defumações e Ervas</option>
                    <option value="bebidas_liturgicas">Bebidas Litúrgicas</option>
                    <option value="loucas_barro">Louças, Alguidares e Quartinhas</option>
                    <option value="limpeza_geral">Limpeza do Templo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Unidade de Medida</label>
                  <select
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                  >
                    <option value="un">Unidade (un)</option>
                    <option value="kg">Quilograma (kg)</option>
                    <option value="pacote">Pacote</option>
                    <option value="litro">Litro</option>
                    <option value="caixa">Caixa</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Quantidade Inicial</label>
                  <input
                    type="number"
                    value={itemForm.quantity}
                    onChange={(e) => setItemForm({ ...itemForm, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Estoque Mínimo (Alerta)</label>
                  <input
                    type="number"
                    value={itemForm.min_quantity}
                    onChange={(e) => setItemForm({ ...itemForm, min_quantity: parseFloat(e.target.value) || 5 })}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-sm text-stone-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Localização no Terreiro</label>
                <input
                  type="text"
                  value={itemForm.storage_location}
                  onChange={(e) => setItemForm({ ...itemForm, storage_location: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                  placeholder="Ex: Armário de Ferro Trancado ou Depósito dos Guias"
                />
              </div>

              <div className="pt-3 border-t border-stone-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-stone-800 text-stone-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-800 hover:bg-emerald-700 text-amber-300 border border-amber-500/40 shadow-sm"
                >
                  Salvar Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
