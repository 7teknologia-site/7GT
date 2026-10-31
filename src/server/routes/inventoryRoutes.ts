import { Router } from 'express';
import crypto from 'crypto';
import { query, queryOne } from '../db.js';
import { AuthenticatedRequest, authenticateToken, verifyTenantAccess, requireRole } from '../auth.js';
import { recordAuditLog } from '../audit.js';

export const inventoryRouter = Router();

inventoryRouter.use(authenticateToken);
inventoryRouter.use(verifyTenantAccess);

// List inventory
inventoryRouter.get('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  try {
    const items = await query<any>(
      `SELECT *,
              (quantity <= min_quantity) as is_low_stock
       FROM inventory_items
       WHERE tenant_id = $1
       ORDER BY (quantity <= min_quantity) DESC, name ASC`,
      [tenantId]
    );
    res.json(items);
  } catch (err: any) {
    console.error('List inventory error:', err);
    res.status(500).json({ error: 'Erro ao listar estoque.' });
  }
});

// Create item
inventoryRouter.post('/', requireRole(['dirigente', 'admin_casa', 'financeiro', 'responsavel_area']), async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const user = req.user!;
  const {
    name,
    category = 'velas_defumadores',
    unit = 'un',
    quantity = 0,
    min_quantity = 5,
    unit_cost = 0,
    supplier_name,
    storage_location
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nome do item é obrigatório.' });
  }

  const id = `inv_${crypto.randomUUID().slice(0, 8)}`;

  try {
    await query(
      `INSERT INTO inventory_items (
        id, tenant_id, name, category, unit, quantity, min_quantity, unit_cost, supplier_name, storage_location
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, tenantId, name, category, unit, quantity, min_quantity, unit_cost, supplier_name || null, storage_location || null]
    );

    await recordAuditLog({
      tenantId,
      actorId: user.id,
      actorName: user.full_name,
      action: 'INVENTORY_ITEM_CREATED',
      entityType: 'inventory_items',
      entityId: id,
      details: { name, category, quantity }
    });

    const item = await queryOne('SELECT * FROM inventory_items WHERE id = $1', [id]);
    res.status(201).json(item);
  } catch (err: any) {
    console.error('Create item error:', err);
    res.status(500).json({ error: 'Erro ao criar item de estoque: ' + err.message });
  }
});

// Record Movement (Entrada / Saída / Ajuste)
inventoryRouter.post('/:id/movements', requireRole(['dirigente', 'admin_casa', 'financeiro', 'responsavel_area']), async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const { id } = req.params;
  const user = req.user!;
  const { type, quantity, notes } = req.body;

  if (!type || !quantity || Number(quantity) <= 0) {
    return res.status(400).json({ error: 'Tipo e quantidade maior que zero são obrigatórios.' });
  }

  const numQty = parseFloat(quantity);
  const movId = `mov_${crypto.randomUUID().slice(0, 8)}`;

  try {
    const item = await queryOne<any>('SELECT id, name, quantity FROM inventory_items WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado.' });
    }

    let delta = 0;
    if (type === 'entrada') delta = numQty;
    else if (type === 'saida' || type === 'perda') delta = -numQty;
    else if (type === 'ajuste_inventario') delta = numQty - Number(item.quantity);

    await query(
      'UPDATE inventory_items SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3',
      [delta, id, tenantId]
    );

    await query(
      `INSERT INTO inventory_movements (id, tenant_id, item_id, type, quantity, notes, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [movId, tenantId, id, type, numQty, notes || null, user.id]
    );

    await recordAuditLog({
      tenantId,
      actorId: user.id,
      actorName: user.full_name,
      action: 'INVENTORY_MOVEMENT_RECORDED',
      entityType: 'inventory_items',
      entityId: id,
      details: { itemName: item.name, type, quantity: numQty, previousStock: item.quantity, newStock: Number(item.quantity) + delta }
    });

    const updatedItem = await queryOne('SELECT * FROM inventory_items WHERE id = $1', [id]);
    res.json({ success: true, item: updatedItem });
  } catch (err: any) {
    console.error('Movement error:', err);
    res.status(500).json({ error: 'Erro ao registrar movimentação de estoque.' });
  }
});
