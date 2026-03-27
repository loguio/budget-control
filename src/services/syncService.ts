import { bridgeApi } from './bridgeApi';
import { upsertAccount, insertTransaction, updateBudgetSpent, getAccounts } from '../database/db';
import type { BridgeAccount, BridgeTransaction } from './bridgeApi';

// ============================================================
// Sync Service — Orchestrates data sync from Bridge API
// ============================================================

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface SyncResult {
  success: boolean;
  accountsSynced: number;
  transactionsSynced: number;
  error?: string;
}

export async function syncBankData(email: string, password: string): Promise<SyncResult> {
  try {
    // Check if API is configured
    if (!bridgeApi.isConfigured()) {
      return {
        success: false,
        accountsSynced: 0,
        transactionsSynced: 0,
        error: 'Bridge API non configurée. Ajoutez vos clés dans le fichier .env',
      };
    }

    // Authenticate if needed
    if (!bridgeApi.isTokenValid()) {
      await bridgeApi.authenticate(email, password);
    }

    // Fetch accounts
    const bridgeAccounts = await bridgeApi.getAccounts();
    let accountsSynced = 0;
    let transactionsSynced = 0;

    for (const account of bridgeAccounts) {
      // Save account
      await upsertAccount({
        id: `bridge-${account.id}`,
        name: account.name,
        type: bridgeApi.mapAccountType(account.type),
        balance: account.balance,
        bankName: account.bank?.name || 'BNP Paribas',
        iban: account.iban,
        lastSync: new Date().toISOString(),
        bridgeId: account.id,
      });
      accountsSynced++;

      // Fetch transactions for this account (last 90 days)
      const since = new Date();
      since.setDate(since.getDate() - 90);

      const transactions = await bridgeApi.getTransactions({
        accountId: account.id,
        since: since.toISOString().split('T')[0],
      });

      for (const tx of transactions) {
        await insertTransaction({
          id: `bridge-tx-${tx.id}`,
          accountId: `bridge-${account.id}`,
          amount: tx.amount,
          description: tx.description || tx.raw_description,
          category: bridgeApi.mapCategory(tx.category),
          date: tx.date,
          type: tx.amount < 0 ? 'debit' : 'credit',
          isRecurring: false, // Could be improved with pattern detection
          bridgeId: tx.id,
        });
        transactionsSynced++;
      }
    }

    // Recalculate budget spending after sync
    const currentMonth = new Date().toISOString().slice(0, 7);
    await updateBudgetSpent(currentMonth);

    return { success: true, accountsSynced, transactionsSynced };
  } catch (error: any) {
    return {
      success: false,
      accountsSynced: 0,
      transactionsSynced: 0,
      error: error.message || 'Erreur lors de la synchronisation',
    };
  }
}

// --- Auto-detect recurring transactions ---
export async function detectRecurringTransactions(): Promise<void> {
  // This would analyze transaction patterns to detect subscriptions
  // For now, we use the isRecurring flag set during import
}
