import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { AuthenticatedRequest, authenticateToken, verifyTenantAccess } from '../auth.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticateToken);
dashboardRouter.use(verifyTenantAccess);

dashboardRouter.get('/metrics', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;

  try {
    // 1. Members count
    const memberStats = await queryOne<any>(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'active') as active_members,
         COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) as new_members_month,
         COUNT(*) as total_members
       FROM members WHERE tenant_id = $1`,
      [tenantId]
    );

    // 2. CRM stats
    const crmStats = await queryOne<any>(
      `SELECT 
         COUNT(*) as total_contacts,
         COUNT(*) FILTER (WHERE relationship_type = 'visitante') as visitors_count,
         COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) as new_leads_month
       FROM crm_contacts WHERE tenant_id = $1 AND is_archived = false`,
      [tenantId]
    );

    // 3. Ritual stats
    const ritualStats = await queryOne<any>(
      `SELECT 
         COUNT(r.id) as active_rituals,
         COALESCE(SUM(r.current_participants), 0) as total_participants,
         COALESCE(COUNT(reg.id) FILTER (WHERE reg.payment_status = 'under_review'), 0) as pending_receipt_reviews
       FROM rituals r
       LEFT JOIN ritual_registrations reg ON reg.ritual_id = r.id AND reg.tenant_id = r.tenant_id
       WHERE r.tenant_id = $1 AND r.status = 'published'`,
      [tenantId]
    );

    // 4. Financial metrics for current month
    const financeStats = await queryOne<any>(
      `SELECT 
         COALESCE(SUM(amount) FILTER (WHERE type = 'revenue' AND status = 'completed' AND payment_date >= date_trunc('month', CURRENT_DATE)), 0) as month_revenue_received,
         COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND status = 'completed' AND payment_date >= date_trunc('month', CURRENT_DATE)), 0) as month_expense_paid,
         COALESCE(SUM(amount) FILTER (WHERE type = 'revenue' AND status = 'pending'), 0) as accounts_receivable,
         COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND status = 'pending'), 0) as accounts_payable
       FROM financial_transactions 
       WHERE tenant_id = $1`,
      [tenantId]
    );

    const totalBankBalance = await queryOne<any>(
      `SELECT COALESCE(SUM(current_balance), 0) as total_balance FROM financial_accounts WHERE tenant_id = $1 AND is_active = true`,
      [tenantId]
    );

    // 5. Low inventory count
    const lowStock = await queryOne<any>(
      `SELECT COUNT(*) as low_stock_count FROM inventory_items WHERE tenant_id = $1 AND quantity <= min_quantity`,
      [tenantId]
    );

    // 6. Upcoming events
    const upcomingEvents = await query<any>(
      `SELECT id, title, type, start_time, end_time, location, is_public 
       FROM events 
       WHERE tenant_id = $1 AND start_time >= CURRENT_TIMESTAMP - INTERVAL '2 hours'
       ORDER BY start_time ASC 
       LIMIT 5`,
      [tenantId]
    );

    // 7. Recent registrations needing review
    const pendingReviews = await query<any>(
      `SELECT reg.id, reg.registration_code, reg.participant_name, reg.amount_paid, reg.payment_method, 
              reg.manual_receipt_url, reg.created_at, r.title as ritual_title
       FROM ritual_registrations reg
       JOIN rituals r ON r.id = reg.ritual_id
       WHERE reg.tenant_id = $1 AND reg.payment_status = 'under_review'
       ORDER BY reg.created_at DESC
       LIMIT 5`,
      [tenantId]
    );

    // 8. CRM funnel breakdown
    const funnelStages = await query<any>(
      `SELECT s.id, s.name, s.order_index, s.color, COUNT(c.id) as contact_count
       FROM crm_pipeline_stages s
       LEFT JOIN crm_contacts c ON c.stage_id = s.id AND c.tenant_id = s.tenant_id AND c.is_archived = false
       WHERE s.tenant_id = $1
       GROUP BY s.id, s.name, s.order_index, s.color
       ORDER BY s.order_index ASC`,
      [tenantId]
    );

    // 9. Revenue vs Expenses last 6 months
    const monthlyFinancials = await query<any>(
      `SELECT 
         to_char(due_date, 'YYYY-MM') as month_label,
         COALESCE(SUM(amount) FILTER (WHERE type = 'revenue' AND status = 'completed'), 0) as revenue,
         COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND status = 'completed'), 0) as expense
       FROM financial_transactions
       WHERE tenant_id = $1 AND due_date >= CURRENT_DATE - INTERVAL '6 months'
       GROUP BY to_char(due_date, 'YYYY-MM')
       ORDER BY month_label ASC`,
      [tenantId]
    );

    res.json({
      metrics: {
        activeMembers: Number(memberStats?.active_members || 0),
        newMembersMonth: Number(memberStats?.new_members_month || 0),
        totalMembers: Number(memberStats?.total_members || 0),
        totalContacts: Number(crmStats?.total_contacts || 0),
        visitorsCount: Number(crmStats?.visitors_count || 0),
        activeRituals: Number(ritualStats?.active_rituals || 0),
        totalParticipants: Number(ritualStats?.total_participants || 0),
        pendingReceiptReviews: Number(ritualStats?.pending_receipt_reviews || 0),
        monthRevenueReceived: Number(financeStats?.month_revenue_received || 0),
        monthExpensePaid: Number(financeStats?.month_expense_paid || 0),
        netMonthBalance: Number(financeStats?.month_revenue_received || 0) - Number(financeStats?.month_expense_paid || 0),
        accountsReceivable: Number(financeStats?.accounts_receivable || 0),
        accountsPayable: Number(financeStats?.accounts_payable || 0),
        totalBankBalance: Number(totalBankBalance?.total_balance || 0),
        lowStockCount: Number(lowStock?.low_stock_count || 0)
      },
      upcomingEvents,
      pendingReviews,
      funnelStages,
      monthlyFinancials
    });
  } catch (err: any) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Erro ao calcular métricas do dashboard: ' + err.message });
  }
});
