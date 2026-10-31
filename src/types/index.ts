// TypeScript Type Definitions for 7Teknologia Gestão de Terreiros

export type UserRole =
  | 'superadmin'
  | 'dirigente'
  | 'admin_casa'
  | 'financeiro'
  | 'responsavel_area'
  | 'responsavel_rituais'
  | 'responsavel_crm'
  | 'membro'
  | 'visitante';

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  is_superadmin: boolean;
}

export interface TenantMembership {
  membership_id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  role: UserRole;
  status: string;
  primary_color?: string;
  accent_color?: string;
  logo_url?: string;
  house_tradition?: string;
  tagline?: string;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  legal_name?: string;
  document_cnpj?: string;
  email: string;
  phone?: string;
  address_city?: string;
  address_state?: string;
  is_active: boolean;
  plan_id: string;
  plan_name?: string;
  plan_code?: string;
  max_members?: number;
  max_rituals_per_month?: number;
  default_pix_key?: string;
  pix_key_type?: string;
  pix_recipient_name?: string;
  whatsapp_contact?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  logo_url?: string;
  banner_url?: string;
  house_tradition?: string;
  tagline?: string;
}

export interface Member {
  id: string;
  tenant_id: string;
  full_name: string;
  spiritual_name?: string;
  email?: string;
  phone?: string;
  document_cpf?: string;
  birth_date?: string;
  entry_date?: string;
  status: 'active' | 'in_training' | 'licensed' | 'inactive' | 'honorary';
  role_in_house: string;
  emergency_contact?: string;
  emergency_phone?: string;
  notes?: string;
  consent_communication: boolean;
  created_at: string;
}

export interface CrmContact {
  id: string;
  tenant_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  stage_id?: string;
  relationship_type: string;
  source: string;
  notes?: string;
  consent_whatsapp: boolean;
  pending_tasks_count?: number;
  created_at: string;
}

export interface CrmPipelineStage {
  id: string;
  tenant_id: string;
  name: string;
  order_index: number;
  color: string;
  is_terminal: boolean;
  contacts?: CrmContact[];
}

export interface CrmActivity {
  id: string;
  tenant_id: string;
  contact_id: string;
  user_id?: string;
  author_name?: string;
  type: 'ligacao' | 'conversa_whatsapp' | 'atendimento' | 'visita' | 'email' | 'participacao' | 'tarefa_followup';
  title: string;
  description?: string;
  due_date?: string;
  is_completed: boolean;
  completed_at?: string;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  tenant_id: string;
  title: string;
  type: 'gira_publica' | 'gira_fechada' | 'festa_anual' | 'sessao_cura' | 'estudo' | 'mutirao' | 'reuniao_admin';
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  max_attendees?: number;
  is_public: boolean;
  status: string;
  attendees_count?: number;
  checkedin_count?: number;
}

export interface Ritual {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  spiritual_guidance?: string;
  ritual_date: string;
  cutoff_date: string;
  is_paid: boolean;
  price: number;
  max_participants: number;
  current_participants: number;
  status: 'draft' | 'published' | 'completed' | 'cancelled';
  image_url?: string;
  pix_key?: string;
  pix_recipient_name?: string;
  whatsapp_phone?: string;
  cancellation_policy?: string;
  confirmed_count?: number;
  pending_review_count?: number;
}

export interface RitualRegistration {
  id: string;
  tenant_id: string;
  ritual_id: string;
  registration_code: string;
  participant_name: string;
  participant_email: string;
  participant_phone: string;
  intentions_text?: string;
  payment_method: 'pix_manual' | 'gateway_card' | 'gateway_pix' | 'gratuito';
  payment_status: 'pending' | 'under_review' | 'confirmed' | 'rejected' | 'refunded';
  amount_paid: number;
  manual_receipt_url?: string;
  review_notes?: string;
  reviewed_by?: string;
  reviewer_name?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface FinancialAccount {
  id: string;
  tenant_id: string;
  name: string;
  type: 'bank' | 'cash' | 'pix' | 'gateway_reserve';
  bank_name?: string;
  initial_balance: number;
  current_balance: number;
  is_active: boolean;
}

export interface FinancialCategory {
  id: string;
  tenant_id: string;
  name: string;
  type: 'revenue' | 'expense';
  color: string;
  is_system?: boolean;
}

export interface FinancialTransaction {
  id: string;
  tenant_id: string;
  account_id: string;
  account_name?: string;
  category_id: string;
  category_name?: string;
  category_color?: string;
  type: 'revenue' | 'expense';
  amount: number;
  description: string;
  due_date: string;
  payment_date?: string;
  status: 'pending' | 'completed' | 'cancelled';
  payment_method: string;
  payer_or_payee?: string;
  receipt_url?: string;
  notes?: string;
  author_name?: string;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  tenant_id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  min_quantity: number;
  unit_cost: number;
  supplier_name?: string;
  storage_location?: string;
  is_low_stock?: boolean;
}

export interface Announcement {
  id: string;
  tenant_id: string;
  title: string;
  content: string;
  target_audience: string;
  priority: 'baixa' | 'normal' | 'alta' | 'urgente';
  author_name?: string;
  is_pinned: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id?: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details_json: Record<string, any>;
  created_at: string;
}

export interface DashboardMetrics {
  activeMembers: number;
  newMembersMonth: number;
  totalMembers: number;
  totalContacts: number;
  visitorsCount: number;
  activeRituals: number;
  totalParticipants: number;
  pendingReceiptReviews: number;
  monthRevenueReceived: number;
  monthExpensePaid: number;
  netMonthBalance: number;
  accountsReceivable: number;
  accountsPayable: number;
  totalBankBalance: number;
  lowStockCount: number;
}
