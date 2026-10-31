import { Router } from 'express';
import crypto from 'crypto';
import { query, queryOne } from '../db.js';
import { AuthenticatedRequest, authenticateToken, verifyTenantAccess, requireRole } from '../auth.js';
import { recordAuditLog } from '../audit.js';

export const financialRouter = Router();

financialRouter.use(authenticateToken);
financialRouter.use(verifyTenantAccess);

// 1. Accounts
financialRouter.get('/accounts', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  try {
    const accounts = await query<any>(
      `SELECT * FROM financial_accounts WHERE tenant_id = $1 ORDER BY is_active DESC, name ASC`,
      [tenantId]
    );
    res.json(accounts);
  } catch (err: any) {
    console.error('List accounts error:', err);
    res.status(500).json({ error: 'Erro ao listar contas financeiras.' });
  }
});

financialRouter.post('/accounts', requireRole(['dirigente', 'admin_casa', 'financeiro']), async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const user = req.user!;
  const { name, type = 'bank', bank_name, initial_balance = 0.00 } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nome da conta é obrigatório.' });
  }

  const id = `acc_${crypto.randomUUID().slice(0, 8)}`;

  try {
    await query(
      `INSERT INTO financial_accounts (id, tenant_id, name, type, bank_name, initial_balance, current_balance)
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [id, tenantId, name, type, bank_name || null, initial_balance]
    );

    await recordAuditLog({
      tenantId,
      actorId: user.id,
      actorName: user.full_name,
      action: 'FINANCIAL_ACCOUNT_CREATED',
      entityType: 'financial_accounts',
      entityId: id,
      details: { name, type, initial_balance }
    });

    const account = await queryOne('SELECT * FROM financial_accounts WHERE id = $1', [id]);
    res.status(201).json(account);
  } catch (err: any) {
    console.error('Create account error:', err);
    res.status(500).json({ error: 'Erro ao criar conta financeira.' });
  }
});

// 2. Categories
financialRouter.get('/categories', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  try {
    const categories = await query<any>(
      `SELECT * FROM financial_categories WHERE tenant_id = $1 ORDER BY type ASC, name ASC`,
      [tenantId]
    );
    res.json(categories);
  } catch (err: any) {
    console.error('List categories error:', err);
    res.status(500).json({ error: 'Erro ao listar categorias financeiras.' });
  }
});

financialRouter.post('/categories', requireRole(['dirigente', 'admin_casa', 'financeiro']), async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const { name, type, color = '#10b981' } = req.body;

  if (!name || !type || !['revenue', 'expense'].includes(type)) {
    return res.status(400).json({ error: "Nome e tipo ('revenue' ou 'expense') são obrigatórios." });
  }

  const id = `cat_${crypto.randomUUID().slice(0, 8)}`;

  try {
    await query(
      `INSERT INTO financial_categories (id, tenant_id, name, type, color) VALUES ($1, $2, $3, $4, $5)`,
      [id, tenantId, name, type, color]
    );
    const category = await queryOne('SELECT * FROM financial_categories WHERE id = $1', [id]);
    res.status(201).json(category);
  } catch (err: any) {
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Erro ao criar categoria.' });
  }
});

// 3. Transactions
financialRouter.get('/transactions', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const { type, status, accountId, categoryId, search, startDate, endDate } = req.query;

  let sql = `
    SELECT t.*, 
           a.name as account_name,
           c.name as category_name, c.color as category_color,
           u.full_name as author_name
    FROM financial_transactions t
    JOIN financial_accounts a ON a.id = t.account_id
    JOIN financial_categories c ON c.id = t.category_id
    LEFT JOIN users u ON u.id = t.created_by
    WHERE t.tenant_id = $1
  `;
  const params: any[] = [tenantId];

  if (type && type !== 'all') {
    params.push(type);
    sql += ` AND t.type = $${params.length}`;
  }

  if (status && status !== 'all') {
    params.push(status);
    sql += ` AND t.status = $${params.length}`;
  }

  if (accountId && accountId !== 'all') {
    params.push(accountId);
    sql += ` AND t.account_id = $${params.length}`;
  }

  if (categoryId && categoryId !== 'all') {
    params.push(categoryId);
    sql += ` AND t.category_id = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (LOWER(t.description) LIKE LOWER($${params.length}) OR LOWER(t.payer_or_payee) LIKE LOWER($${params.length}))`;
  }

  if (startDate) {
    params.push(startDate);
    sql += ` AND t.due_date >= $${params.length}`;
  }

  if (endDate) {
    params.push(endDate);
    sql += ` AND t.due_date <= $${params.length}`;
  }

  sql += ` ORDER BY t.due_date DESC, t.created_at DESC`;

  try {
    const transactions = await query(sql, params);
    res.json(transactions);
  } catch (err: any) {
    console.error('List transactions error:', err);
    res.status(500).json({ error: 'Erro ao listar lançamentos: ' + err.message });
  }
});

// Create Transaction
financialRouter.post('/transactions', requireRole(['dirigente', 'admin_casa', 'financeiro']), async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const user = req.user!;
  const {
    account_id,
    category_id,
    type,
    amount,
    description,
    due_date,
    payment_date,
    status = 'completed',
    payment_method = 'pix',
    payer_or_payee,
    receipt_url,
    notes
  } = req.body;

  if (!account_id || !category_id || !type || !amount || !description || !due_date) {
    return res.status(400).json({ error: 'Preencha os campos obrigatórios da transação.' });
  }

  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: 'Valor deve ser numérico maior que zero.' });
  }

  const id = `txn_${crypto.randomUUID().slice(0, 8)}`;
  const actualPaymentDate = status === 'completed' ? (payment_date || new Date().toISOString().slice(0, 10)) : null;

  try {
    await query(
      `INSERT INTO financial_transactions (
        id, tenant_id, account_id, category_id, type, amount, description,
        due_date, payment_date, status, payment_method, payer_or_payee, receipt_url, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        id, tenantId, account_id, category_id, type, numericAmount, description,
        due_date, actualPaymentDate, status, payment_method, payer_or_payee || null,
        receipt_url || null, notes || null, user.id
      ]
    );

    // If completed, update account current balance
    if (status === 'completed') {
      const balanceDelta = type === 'revenue' ? numericAmount : -numericAmount;
      await query(
        'UPDATE financial_accounts SET current_balance = current_balance + $1 WHERE id = $2 AND tenant_id = $3',
        [balanceDelta, account_id, tenantId]
      );
    }

    await recordAuditLog({
      tenantId,
      actorId: user.id,
      actorName: user.full_name,
      action: 'FINANCIAL_TRANSACTION_CREATED',
      entityType: 'financial_transactions',
      entityId: id,
      details: { type, amount: numericAmount, description, status }
    });

    const created = await queryOne('SELECT * FROM financial_transactions WHERE id = $1', [id]);
    res.status(201).json(created);
  } catch (err: any) {
    console.error('Create transaction error:', err);
    res.status(500).json({ error: 'Erro ao cadastrar transação: ' + err.message });
  }
});

// Settle (Mark as Paid/Received)
financialRouter.post('/transactions/:id/settle', requireRole(['dirigente', 'admin_casa', 'financeiro']), async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const { id } = req.params;
  const user = req.user!;
  const { payment_date = new Date().toISOString().slice(0, 10) } = req.body;

  try {
    const txn = await queryOne<any>(
      'SELECT * FROM financial_transactions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (!txn) {
      return res.status(404).json({ error: 'Transação não encontrada.' });
    }

    if (txn.status === 'completed') {
      return res.status(400).json({ error: 'Esta transação já se encontra baixada e confirmada.' });
    }

    await query(
      `UPDATE financial_transactions SET status = 'completed', payment_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3`,
      [payment_date, id, tenantId]
    );

    // Update account balance
    const balanceDelta = txn.type === 'revenue' ? Number(txn.amount) : -Number(txn.amount);
    await query(
      'UPDATE financial_accounts SET current_balance = current_balance + $1 WHERE id = $2 AND tenant_id = $3',
      [balanceDelta, txn.account_id, tenantId]
    );

    await recordAuditLog({
      tenantId,
      actorId: user.id,
      actorName: user.full_name,
      action: 'FINANCIAL_TRANSACTION_SETTLED',
      entityType: 'financial_transactions',
      entityId: id,
      details: { amount: txn.amount, type: txn.type, payment_date }
    });

    res.json({ success: true, message: 'Lançamento baixado com sucesso.' });
  } catch (err: any) {
    console.error('Settle transaction error:', err);
    res.status(500).json({ error: 'Erro ao baixar transação: ' + err.message });
  }
});

// Transfer between accounts
financialRouter.post('/transfers', requireRole(['dirigente', 'admin_casa', 'financeiro']), async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const user = req.user!;
  const source_account_id = req.body.source_account_id || req.body.fromAccountId;
  const destination_account_id = req.body.destination_account_id || req.body.toAccountId;
  const { amount, description = 'Transferência interna entre contas', transfer_date } = req.body;

  if (!source_account_id || !destination_account_id || !amount) {
    return res.status(400).json({ error: 'Conta de origem, conta de destino e valor são obrigatórios.' });
  }

  if (source_account_id === destination_account_id) {
    return res.status(400).json({ error: 'Conta de origem e destino devem ser diferentes.' });
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Valor de transferência inválido.' });
  }

  try {
    const srcAccount = await queryOne<any>(
      'SELECT id, name, current_balance FROM financial_accounts WHERE id = $1 AND tenant_id = $2',
      [source_account_id, tenantId]
    );
    if (!srcAccount) {
      return res.status(404).json({ error: 'Conta de origem não encontrada.' });
    }

    const dstAccount = await queryOne<any>(
      'SELECT id, name FROM financial_accounts WHERE id = $1 AND tenant_id = $2',
      [destination_account_id, tenantId]
    );
    if (!dstAccount) {
      return res.status(404).json({ error: 'Conta de destino não encontrada.' });
    }

    // AUDIT RULE: Enforce available balance check
    if (Number(srcAccount.current_balance) < numAmount) {
      return res.status(400).json({
        error: `Saldo insuficiente na conta ${srcAccount.name} (Saldo atual: R$ ${Number(srcAccount.current_balance).toFixed(2)}) para transferir R$ ${numAmount.toFixed(2)}.`
      });
    }

    const id = `trf_${crypto.randomUUID().slice(0, 8)}`;
    const date = transfer_date || new Date().toISOString().slice(0, 10);

    // Atomically execute transfer within transaction
    await query('BEGIN');
    try {
      await query(
        'UPDATE financial_accounts SET current_balance = current_balance - $1 WHERE id = $2 AND tenant_id = $3',
        [numAmount, source_account_id, tenantId]
      );
      await query(
        'UPDATE financial_accounts SET current_balance = current_balance + $1 WHERE id = $2 AND tenant_id = $3',
        [numAmount, destination_account_id, tenantId]
      );
      await query(
        `INSERT INTO financial_transfers (id, tenant_id, source_account_id, destination_account_id, amount, transfer_date, description, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, tenantId, source_account_id, destination_account_id, numAmount, date, description, user.id]
      );
      await query('COMMIT');
    } catch (txErr) {
      await query('ROLLBACK');
      throw txErr;
    }

    await recordAuditLog({
      tenantId,
      actorId: user.id,
      actorName: user.full_name,
      action: 'FINANCIAL_TRANSFER_EXECUTED',
      entityType: 'financial_transfers',
      entityId: id,
      details: { from: source_account_id, to: destination_account_id, amount: numAmount }
    });

    res.status(201).json({ success: true, message: 'Transferência executada com sucesso!' });
  } catch (err: any) {
    console.error('Transfer error:', err);
    res.status(500).json({ error: 'Erro ao executar transferência: ' + err.message });
  }
});

// Reversal / Estorno of Financial Transaction
financialRouter.post('/transactions/:id/reverse', requireRole(['dirigente', 'admin_casa', 'financeiro']), async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const { id } = req.params;
  const { reason } = req.body;
  const user = req.user!;

  try {
    const txn = await queryOne<any>(
      'SELECT * FROM financial_transactions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (!txn) {
      return res.status(404).json({ error: 'Transação não encontrada.' });
    }

    if (txn.status === 'cancelled') {
      return res.status(400).json({ error: 'Esta transação já se encontra cancelada ou estornada.' });
    }

    await query('BEGIN');
    try {
      // If transaction was completed, reverse its balance impact on the account
      if (txn.status === 'completed') {
        const reverseDelta = txn.type === 'revenue' ? -Number(txn.amount) : Number(txn.amount);
        await query(
          'UPDATE financial_accounts SET current_balance = current_balance + $1 WHERE id = $2 AND tenant_id = $3',
          [reverseDelta, txn.account_id, tenantId]
        );
      }

      const reverseNote = `Estornado em ${new Date().toLocaleDateString('pt-BR')} por ${user.full_name}. Motivo: ${reason || 'Correção contábil'}`;
      await query(
        `UPDATE financial_transactions SET 
           status = 'cancelled', 
           notes = CASE WHEN notes IS NULL THEN $1 ELSE notes || ' | ' || $1 END,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND tenant_id = $3`,
        [reverseNote, id, tenantId]
      );
      await query('COMMIT');
    } catch (txErr) {
      await query('ROLLBACK');
      throw txErr;
    }

    await recordAuditLog({
      tenantId,
      actorId: user.id,
      actorName: user.full_name,
      action: 'FINANCIAL_TRANSACTION_REVERSED',
      entityType: 'financial_transactions',
      entityId: id,
      details: { originalAmount: txn.amount, type: txn.type, reason }
    });

    res.json({ success: true, message: 'Lançamento estornado com sucesso e saldo reajustado.' });
  } catch (err: any) {
    console.error('Reverse transaction error:', err);
    res.status(500).json({ error: 'Erro ao estornar transação: ' + err.message });
  }
});

// Partial Settlement (Baixa Parcial)
financialRouter.post('/transactions/:id/partial-settle', requireRole(['dirigente', 'admin_casa', 'financeiro']), async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const { id } = req.params;
  const partial_amount = req.body.partial_amount || req.body.settledAmount;
  const { payment_date = new Date().toISOString().slice(0, 10), notes } = req.body;
  const user = req.user!;

  const numPartial = parseFloat(partial_amount);
  if (isNaN(numPartial) || numPartial <= 0) {
    return res.status(400).json({ error: 'Valor da baixa parcial deve ser numérico maior que zero.' });
  }

  try {
    const txn = await queryOne<any>(
      'SELECT * FROM financial_transactions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (!txn) {
      return res.status(404).json({ error: 'Transação não encontrada.' });
    }

    if (txn.status !== 'pending') {
      return res.status(400).json({ error: 'Apenas transações com status pendente aceitam baixa parcial.' });
    }

    const totalAmount = Number(txn.amount);
    if (numPartial >= totalAmount) {
      return res.status(400).json({
        error: `O valor parcial (R$ ${numPartial.toFixed(2)}) deve ser menor que o total pendente (R$ ${totalAmount.toFixed(2)}). Para baixa integral, use a opção 'Dar Baixa'.`
      });
    }

    const remainingAmount = totalAmount - numPartial;
    const partialTxnId = `txn_part_${crypto.randomUUID().slice(0, 8)}`;

    await query('BEGIN');
    try {
      // 1. Update original transaction amount to remaining amount
      await query(
        `UPDATE financial_transactions SET 
           amount = $1, 
           notes = CASE WHEN notes IS NULL THEN $2 ELSE notes || ' | ' || $2 END,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND tenant_id = $4`,
        [
          remainingAmount,
          `Baixa parcial de R$ ${numPartial.toFixed(2)} realizada em ${payment_date}. Restante: R$ ${remainingAmount.toFixed(2)}`,
          id,
          tenantId
        ]
      );

      // 2. Create new completed transaction for the settled partial amount
      await query(
        `INSERT INTO financial_transactions (
           id, tenant_id, account_id, category_id, type, amount, description,
           due_date, payment_date, status, payment_method, payer_or_payee, notes, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed', $10, $11, $12, $13)`,
        [
          partialTxnId,
          tenantId,
          txn.account_id,
          txn.category_id,
          txn.type,
          numPartial,
          `${txn.description} (Baixa Parcial)`,
          txn.due_date,
          payment_date,
          txn.payment_method,
          txn.payer_or_payee,
          notes || `Parcela recebida referente à transação ${id}`,
          user.id
        ]
      );

      // 3. Update account balance with settled partial amount
      const balanceDelta = txn.type === 'revenue' ? numPartial : -numPartial;
      await query(
        'UPDATE financial_accounts SET current_balance = current_balance + $1 WHERE id = $2 AND tenant_id = $3',
        [balanceDelta, txn.account_id, tenantId]
      );

      await query('COMMIT');
    } catch (txErr) {
      await query('ROLLBACK');
      throw txErr;
    }

    await recordAuditLog({
      tenantId,
      actorId: user.id,
      actorName: user.full_name,
      action: 'FINANCIAL_PARTIAL_SETTLEMENT',
      entityType: 'financial_transactions',
      entityId: id,
      details: { settledAmount: numPartial, remainingAmount, partialTxnId }
    });

    res.json({
      success: true,
      message: `Baixa parcial de R$ ${numPartial.toFixed(2)} confirmada! Restante pendente: R$ ${remainingAmount.toFixed(2)}.`,
      settledAmount: numPartial,
      remainingAmount,
      partialTxnId
    });
  } catch (err: any) {
    console.error('Partial settle error:', err);
    res.status(500).json({ error: 'Erro ao processar baixa parcial: ' + err.message });
  }
});

// Financial Report (Cashflow / Category breakdown)
financialRouter.get('/reports/summary', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const { startDate, endDate } = req.query;

  try {
    let dateFilter = '';
    const params: any[] = [tenantId];
    if (startDate && endDate) {
      params.push(startDate, endDate);
      dateFilter = ` AND due_date BETWEEN $2 AND $3`;
    }

    const byCategory = await query<any>(
      `SELECT c.id, c.name, c.type, c.color,
              COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'completed'), 0) as total_amount,
              COUNT(t.id) as transaction_count
       FROM financial_categories c
       LEFT JOIN financial_transactions t ON t.category_id = c.id AND t.tenant_id = c.tenant_id ${dateFilter}
       WHERE c.tenant_id = $1
       GROUP BY c.id, c.name, c.type, c.color
       ORDER BY total_amount DESC`,
      params
    );

    const totals = await queryOne<any>(
      `SELECT 
         COALESCE(SUM(amount) FILTER (WHERE type = 'revenue' AND status = 'completed'), 0) as total_revenue,
         COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND status = 'completed'), 0) as total_expense
       FROM financial_transactions
       WHERE tenant_id = $1 ${dateFilter}`,
      params
    );

    res.json({
      totals: {
        revenue: Number(totals?.total_revenue || 0),
        expense: Number(totals?.total_expense || 0),
        net: Number(totals?.total_revenue || 0) - Number(totals?.total_expense || 0)
      },
      byCategory
    });
  } catch (err: any) {
    console.error('Report error:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório financeiro.' });
  }
});
