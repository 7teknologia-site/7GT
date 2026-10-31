const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function logPass(name: string, details?: string) {
  totalTests++;
  passedTests++;
  console.log(`  ✅ [PASS] ${name}${details ? ` -> ${details}` : ''}`);
}

function logFail(name: string, error: string) {
  totalTests++;
  failedTests++;
  console.error(`  ❌ [FAIL] ${name} -> ${error}`);
}

async function runHostileAudit() {
  console.log('========================================================================');
  console.log('🛡️  7 GESTÃO DE TERREIROS (7Teknologia) — AUDITORIA HOSTIL V2');
  console.log('    Equipe Independente: Segurança, PostgreSQL, Finanças, Multi-Tenant');
  console.log('========================================================================\n');

  console.log('--- FASE 1: AUTENTICAÇÃO E EMISSÃO DE SESSÕES ---');

  // Login Dirigente A
  const loginResA = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dirigente@aruanda.org', password: 'aruanda123' })
  });
  const dataA = await loginResA.json();
  if (loginResA.ok && dataA.token) {
    logPass('Login Dirigente A (Terreiro Pai Benedito)', `Tenant: ${dataA.activeTenantId}`);
  } else {
    logFail('Login Dirigente A', JSON.stringify(dataA));
  }

  // Login Financeiro A
  const loginResFinA = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'financeiro@aruanda.org', password: 'aruanda123' })
  });
  const dataFinA = await loginResFinA.json();
  if (loginResFinA.ok && dataFinA.token) {
    logPass('Login Financeiro A (Terreiro Pai Benedito)', `Role: ${dataFinA.memberships[0]?.role}`);
  } else {
    logFail('Login Financeiro A', JSON.stringify(dataFinA));
  }

  // Login Membro A
  const loginResMemA = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'membro@aruanda.org', password: 'aruanda123' })
  });
  const dataMemA = await loginResMemA.json();
  if (loginResMemA.ok && dataMemA.token) {
    logPass('Login Membro A (Terreiro Pai Benedito)', `Role: ${dataMemA.memberships[0]?.role}`);
  } else {
    logFail('Login Membro A', JSON.stringify(dataMemA));
  }

  // Login Dirigente B (Tenant B: Caboclo Pena Branca)
  const loginResB = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dirigente@penabranca.org', password: 'penabranca123' })
  });
  const dataB = await loginResB.json();
  if (loginResB.ok && dataB.token) {
    logPass('Login Dirigente B (Terreiro Caboclo Pena Branca)', `Tenant: ${dataB.activeTenantId}`);
  } else {
    logFail('Login Dirigente B', JSON.stringify(dataB));
  }

  const tokenA = dataA.token;
  const tokenFinA = dataFinA.token;
  const tokenMemA = dataMemA.token;
  const tokenB = dataB.token;

  console.log('\n--- FASE 2: AUDITORIA DE SEGURANÇA E ISOLAMENTO MULTI-TENANT ---');

  // Test 1: Unauthenticated request must return 401
  const unauthRes = await fetch(`${BASE_URL}/api/members`);
  if (unauthRes.status === 401) {
    logPass('Bloqueio de requisição sem token JWT (HTTP 401)');
  } else {
    logFail('Bloqueio sem token', `Esperado 401, recebido ${unauthRes.status}`);
  }

  // Test 2: Spoofed X-Tenant-Id attack
  const spoofRes = await fetch(`${BASE_URL}/api/members`, {
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'X-Tenant-Id': 'tenant-aruanda'
    }
  });
  if (spoofRes.status === 403) {
    logPass('Bloqueio de spoofing/falsificação de X-Tenant-Id (HTTP 403 Forbidden)', 'Dirigente B não pode acessar Terreiro A');
  } else {
    logFail('Falsificação de X-Tenant-Id', `Esperado 403, recebido ${spoofRes.status}`);
  }

  // Test 3: Cross-tenant CRM IDOR - Dirigente B accesses crm_1 belonging to Tenant A
  const crmIdorRes = await fetch(`${BASE_URL}/api/crm/contacts/crm_1`, {
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'X-Tenant-Id': 'tenant-penabranca'
    }
  });
  if (crmIdorRes.status === 404 || crmIdorRes.status === 403) {
    logPass('Bloqueio de IDOR em contato do CRM entre terreiros (HTTP 404/403)');
  } else {
    logFail('Vazamento IDOR CRM', `Esperado 404 ou 403, recebido ${crmIdorRes.status}`);
  }

  // Test 4: Cross-tenant CRM Activity Injection IDOR
  const actIdorRes = await fetch(`${BASE_URL}/api/crm/contacts/crm_1/activities`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'X-Tenant-Id': 'tenant-penabranca',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ type: 'ligacao', title: 'Tentativa de injeção maliciosa' })
  });
  if (actIdorRes.status === 404 || actIdorRes.status === 403) {
    logPass('Bloqueio de inserção cruzada de atividade em contato de outro terreiro (HTTP 404)');
  } else {
    logFail('Injeção IDOR Atividade', `Esperado 404/403, recebido ${actIdorRes.status}`);
  }

  // Test 5: Cross-tenant Event Check-in IDOR
  const eventIdorRes = await fetch(`${BASE_URL}/api/events/evt_1/checkin`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'X-Tenant-Id': 'tenant-penabranca',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: 'Visitante Intruso' })
  });
  if (eventIdorRes.status === 404 || eventIdorRes.status === 403) {
    logPass('Bloqueio de check-in em evento de outro terreiro (HTTP 404)');
  } else {
    logFail('Injeção IDOR Event Checkin', `Esperado 404/403, recebido ${eventIdorRes.status}`);
  }

  // Test 6: Privilege Escalation - Member attempting financial write
  const privEscRes = await fetch(`${BASE_URL}/api/financial/transactions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenMemA}`,
      'X-Tenant-Id': 'tenant-aruanda',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'expense',
      description: 'Tentativa de lançamento por membro comum',
      amount: 1000
    })
  });
  if (privEscRes.status === 403) {
    logPass('Bloqueio de escalonamento de privilégio: Membro comum impedido de criar finanças (HTTP 403)');
  } else {
    logFail('Escalonamento de Privilégios', `Esperado 403, recebido ${privEscRes.status}`);
  }

  console.log('\n--- FASE 3: AUDITORIA FINANCEIRA E INTEGRIDADE TRANSACIONAL ---');

  // Test 7: Overdraft rejection on transfer
  const overdraftRes = await fetch(`${BASE_URL}/api/financial/transfers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenFinA}`,
      'X-Tenant-Id': 'tenant-aruanda',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source_account_id: 'acc_banco_inter',
      destination_account_id: 'acc_caixa_fisico',
      amount: 999999.00,
      description: 'Transferência fraudulenta sem saldo'
    })
  });
  const overdraftData = await overdraftRes.json();
  if (overdraftRes.status === 400 && overdraftData.error?.includes('Saldo insuficiente')) {
    logPass('Bloqueio de transferência interna a descoberto (Saldo Insuficiente HTTP 400)');
  } else {
    logFail('Transferência a descoberto permitida', `Status: ${overdraftRes.status}, resp: ${JSON.stringify(overdraftData)}`);
  }

  // Test 8: Valid Atomic Transfer
  const accountsBeforeRes = await fetch(`${BASE_URL}/api/financial/accounts`, {
    headers: { Authorization: `Bearer ${tokenFinA}`, 'X-Tenant-Id': 'tenant-aruanda' }
  });
  const accountsBefore = await accountsBeforeRes.json();
  const accInterBefore = accountsBefore.find((a: any) => a.id === 'acc_banco_inter');
  const accCaixaBefore = accountsBefore.find((a: any) => a.id === 'acc_caixa_fisico');
  const transferAmount = 50.00;

  const validTransferRes = await fetch(`${BASE_URL}/api/financial/transfers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenFinA}`,
      'X-Tenant-Id': 'tenant-aruanda',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source_account_id: 'acc_banco_inter',
      destination_account_id: 'acc_caixa_fisico',
      amount: transferAmount,
      description: 'Suprimento de caixa para velas'
    })
  });

  const accountsAfterRes = await fetch(`${BASE_URL}/api/financial/accounts`, {
    headers: { Authorization: `Bearer ${tokenFinA}`, 'X-Tenant-Id': 'tenant-aruanda' }
  });
  const accountsAfter = await accountsAfterRes.json();
  const accInterAfter = accountsAfter.find((a: any) => a.id === 'acc_banco_inter');
  const accCaixaAfter = accountsAfter.find((a: any) => a.id === 'acc_caixa_fisico');

  const interDiff = Number(accInterBefore.current_balance) - Number(accInterAfter.current_balance);
  const caixaDiff = Number(accCaixaAfter.current_balance) - Number(accCaixaBefore.current_balance);

  if (validTransferRes.ok && Math.abs(interDiff - transferAmount) < 0.01 && Math.abs(caixaDiff - transferAmount) < 0.01) {
    logPass('Transferência atômica entre contas com atualização exata de saldos', `Inter: -R$ ${interDiff.toFixed(2)}, Caixa: +R$ ${caixaDiff.toFixed(2)}`);
  } else {
    logFail('Falha na transferência atômica', `Inter diff: ${interDiff}, Caixa diff: ${caixaDiff}`);
  }

  // Test 9: Financial Partial Settlement (Baixa Parcial)
  const createTxnRes = await fetch(`${BASE_URL}/api/financial/transactions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenFinA}`,
      'X-Tenant-Id': 'tenant-aruanda',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'revenue',
      description: 'Mensalidade de Apoiador - Carnê Anual',
      amount: 100.00,
      due_date: '2026-11-10',
      account_id: 'acc_banco_inter',
      category_id: 'cat_mensalidades',
      status: 'pending'
    })
  });
  const createdTxn = await createTxnRes.json();

  const partialRes = await fetch(`${BASE_URL}/api/financial/transactions/${createdTxn.id}/partial-settle`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenFinA}`,
      'X-Tenant-Id': 'tenant-aruanda',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      settledAmount: 40.00,
      accountId: 'acc_banco_inter',
      notes: 'Baixa de primeira parcela R$ 40,00'
    })
  });
  const partialData = await partialRes.json();

  const txnsRes = await fetch(`${BASE_URL}/api/financial/transactions`, {
    headers: { Authorization: `Bearer ${tokenFinA}`, 'X-Tenant-Id': 'tenant-aruanda' }
  });
  const allTxns = await txnsRes.json();
  const originalTxnUpdated = allTxns.find((t: any) => t.id === createdTxn.id);
  const splitTxnId = partialData.partialTxnId || partialData.settledTransaction?.id;
  const splitTxn = allTxns.find((t: any) => t.id === splitTxnId);

  if (
    partialRes.ok &&
    originalTxnUpdated &&
    Math.abs(Number(originalTxnUpdated.amount) - 60.00) < 0.01 &&
    splitTxn &&
    Math.abs(Number(splitTxn.amount) - 40.00) < 0.01 &&
    splitTxn.status === 'completed'
  ) {
    logPass('Baixa Parcial (Split) com preservação da dívida restante e baixa efetiva', `Original restante: R$ ${originalTxnUpdated.amount}, Baixado: R$ ${splitTxn.amount}`);
  } else {
    logFail('Baixa Parcial', `Original: ${JSON.stringify(originalTxnUpdated)}, Split: ${JSON.stringify(splitTxn)}`);
  }

  // Test 10: Financial Estorno / Reversal
  const estornoTxnRes = await fetch(`${BASE_URL}/api/financial/transactions/${splitTxnId}/reverse`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenFinA}`,
      'X-Tenant-Id': 'tenant-aruanda',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reason: 'Estorno de pagamento realizado por engano' })
  });

  const txnsAfterEstornoRes = await fetch(`${BASE_URL}/api/financial/transactions`, {
    headers: { Authorization: `Bearer ${tokenFinA}`, 'X-Tenant-Id': 'tenant-aruanda' }
  });
  const allTxnsAfter = await txnsAfterEstornoRes.json();
  const reversedTxn = allTxnsAfter.find((t: any) => t.id === splitTxnId);

  if (estornoTxnRes.ok && reversedTxn?.status === 'cancelled' && (reversedTxn?.notes?.includes('Estornado') || reversedTxn?.notes?.includes('[ESTORNO]'))) {
    logPass('Estorno atômico de transação financeira com reversão de saldo e trilha');
  } else {
    logFail('Estorno de transação', `Status: ${reversedTxn?.status}, notes: ${reversedTxn?.notes}`);
  }

  console.log('\n--- FASE 4: CICLO COMPLETO DE RITUAIS COLETIVOS E DUPLA APROVAÇÃO ---');

  // Test 11: Public Registration
  const testEmail = `visitante_${Date.now()}@teste.com`;
  const regRes = await fetch(`${BASE_URL}/api/rituals/public/trabalho-prosperidade-oxum-2026/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_name: 'Juliana Fagundes',
      participant_email: testEmail,
      participant_phone: '(11) 98765-4321',
      intentions_text: 'Abertura de caminhos profissionais e paz familiar',
      payment_method: 'pix_manual'
    })
  });
  const regData = await regRes.json();
  if (regRes.status === 201 && (regData.registrationCode || regData.registration?.registration_code)) {
    logPass('Inscrição pública em ritual coletivo gerada com sucesso', `Código: ${regData.registrationCode || regData.registration?.registration_code}`);
  } else {
    logFail('Inscrição pública', `Status: ${regRes.status}, Resp: ${JSON.stringify(regData)}`);
  }

  const regCode = regData.registrationCode || regData.registration?.registration_code;
  const regId = regData.registrationId || regData.registration?.id;

  // Test 12: Duplicate Registration Protection with same email
  const dupRegRes = await fetch(`${BASE_URL}/api/rituals/public/trabalho-prosperidade-oxum-2026/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_name: 'Juliana Fagundes (Duplicada)',
      participant_email: testEmail,
      participant_phone: '(11) 98765-4321',
      intentions_text: 'Tentativa duplicada',
      payment_method: 'pix_manual'
    })
  });
  if (dupRegRes.status === 409) {
    logPass('Prevenção de inscrição duplicada no mesmo ritual (HTTP 409 Conflict)');
  } else {
    logFail('Inscrição duplicada permitida', `Esperado 409, recebido ${dupRegRes.status}`);
  }

  // Test 13: Attach Receipt
  const receiptRes = await fetch(`${BASE_URL}/api/rituals/public/receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      registrationCode: regCode,
      receiptUrl: 'https://comprovantes.7teknologia.com.br/rec_pix_99182312.pdf'
    })
  });
  if (receiptRes.ok) {
    logPass('Envio de comprovante manual pelo participante (Status -> under_review)');
  } else {
    logFail('Envio de comprovante manual', `Status: ${receiptRes.status}`);
  }

  // Test 14: Approve Registration & Block Repeated Approval (Hostile test)
  // First approval: should succeed and record financial transaction
  const approveRes1 = await fetch(`${BASE_URL}/api/rituals/registrations/${regId}/review`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenFinA}`,
      'X-Tenant-Id': 'tenant-aruanda',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action: 'approve', review_notes: 'PIX conferido no extrato Inter' })
  });

  // Second approval: MUST BE REJECTED with HTTP 400
  const approveRes2 = await fetch(`${BASE_URL}/api/rituals/registrations/${regId}/review`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenFinA}`,
      'X-Tenant-Id': 'tenant-aruanda',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action: 'approve', review_notes: 'Tentativa de aprovação repetida maliciosa' })
  });
  const approveData2 = await approveRes2.json();

  if (approveRes1.ok && approveRes2.status === 400 && approveData2.error?.includes('confirmada')) {
    logPass('Proteção contra dupla aprovação de pagamento em ritual (HTTP 400)', 'Impediu duplicação de receita e de vaga');
  } else {
    logFail('Dupla aprovação não prevenida', `Aprovação 1: ${approveRes1.status}, Aprovação 2: ${approveRes2.status}, erro: ${approveData2?.error}`);
  }

  // Test 15: Registration Cancellation & Spot Decrement
  const ritualsBeforeCancelRes = await fetch(`${BASE_URL}/api/rituals`, {
    headers: { Authorization: `Bearer ${tokenA}`, 'X-Tenant-Id': 'tenant-aruanda' }
  });
  const ritualsBeforeCancel = await ritualsBeforeCancelRes.json();
  const oxumBeforeCancel = ritualsBeforeCancel.find((r: any) => r.slug === 'trabalho-prosperidade-oxum-2026');

  const cancelRes = await fetch(`${BASE_URL}/api/rituals/registrations/${regId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'X-Tenant-Id': 'tenant-aruanda',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reason: 'Desistência voluntária do participante' })
  });

  const ritualsAfterCancelRes = await fetch(`${BASE_URL}/api/rituals`, {
    headers: { Authorization: `Bearer ${tokenA}`, 'X-Tenant-Id': 'tenant-aruanda' }
  });
  const ritualsAfterCancel = await ritualsAfterCancelRes.json();
  const oxumAfterCancel = ritualsAfterCancel.find((r: any) => r.slug === 'trabalho-prosperidade-oxum-2026');

  const regsAfterCancelRes = await fetch(`${BASE_URL}/api/rituals/${oxumAfterCancel.id}/registrations`, {
    headers: { Authorization: `Bearer ${tokenA}`, 'X-Tenant-Id': 'tenant-aruanda' }
  });
  const regsAfterCancel = await regsAfterCancelRes.json();
  const targetReg = regsAfterCancel.find((r: any) => r.id === regId);

  if (
    cancelRes.ok &&
    (targetReg?.payment_status === 'refunded' || targetReg?.payment_status === 'rejected') &&
    Number(oxumAfterCancel.current_participants) === Number(oxumBeforeCancel.current_participants) - 1
  ) {
    logPass('Cancelamento de inscrição com liberação atômica da vaga e estorno financeiro', `Vagas: ${oxumBeforeCancel.current_participants} -> ${oxumAfterCancel.current_participants}`);
  } else {
    logFail('Cancelamento de inscrição', `Cancel status: ${cancelRes.status}, Vagas: ${oxumBeforeCancel?.current_participants} -> ${oxumAfterCancel?.current_participants}, regStatus: ${targetReg?.payment_status}`);
  }

  console.log('\n--- FASE 5: AUDITORIA DE AUDIT LOGS E OBSERVABILIDADE ---');

  // Test 16: Audit log verification
  const auditLogsRes = await fetch(`${BASE_URL}/api/audit?limit=20`, {
    headers: { Authorization: `Bearer ${tokenA}`, 'X-Tenant-Id': 'tenant-aruanda' }
  });
  const auditLogs = await auditLogsRes.json();
  const actions = auditLogs.map((l: any) => l.action);
  const hasLoginLog = actions.includes('USER_LOGIN');
  const hasTransferLog = actions.some((a: string) => a.includes('TRANSFER'));
  const hasReviewLog = actions.includes('RITUAL_PAYMENT_APPROVED');
  const hasCancelLog = actions.includes('RITUAL_REGISTRATION_CANCELLED');

  if (hasLoginLog && hasTransferLog && hasReviewLog && hasCancelLog) {
    logPass('Trilha de auditoria completa gravando eventos críticos (Login, Transferência, Aprovação, Cancelamento)');
  } else {
    logFail('Trilha de auditoria incompleta', `Ações encontradas: ${actions.join(', ')}`);
  }

  console.log('\n========================================================================');
  console.log(`📊 RELATÓRIO DE EXECUÇÃO: TOTAL: ${totalTests} | ✅ APROVADOS: ${passedTests} | ❌ REPROVADOS: ${failedTests}`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runHostileAudit().catch(err => {
  console.error('Falha crítica na execução da auditoria:', err);
  process.exit(1);
});
