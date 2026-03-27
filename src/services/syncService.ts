import { bridgeApi } from './bridgeApi';
import { upsertAccount, insertTransaction, updateBudgetSpent } from '../database/db';
import type { BridgeAccount, BridgeTransaction } from './bridgeApi';

// ============================================================
// Sync Service v3 — Orchestrates data sync from Bridge API
// ============================================================
// v3 changes:
//   - Auth uses user_uuid (no email/password)
//   - Provider replaces Bank
//   - Transactions: use minDate/maxDate instead of /updated
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

/**
 * Sync bank data from Bridge API v3.
 *
 * @param userUuid - The Bridge user UUID (obtained after createUser)
 */
export async function syncBankData(userUuid: string): Promise<SyncResult> {
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

    // Authenticate with user UUID (v3 flow)
    if (!bridgeApi.isTokenValid()) {
      await bridgeApi.authenticate({ userUuid });
    }

    // Fetch accounts
    const bridgeAccounts = await bridgeApi.getAccounts();
    let accountsSynced = 0;
    let transactionsSynced = 0;

    for (const account of bridgeAccounts) {
      // Save account — v3: provider instead of bank
      await upsertAccount({
        id: `bridge-${account.id}`,
        name: account.name,
        type: bridgeApi.mapAccountType(account.type),
        balance: account.balance,
        bankName: account.provider?.name || 'BNP Paribas',
        iban: account.iban,
        lastSync: new Date().toISOString(),
        bridgeId: account.id,
      });
      accountsSynced++;

      // Fetch transactions (last 90 days)
      // v3: use minDate/maxDate instead of /transactions/updated
      const since = new Date();
      since.setDate(since.getDate() - 90);

      const transactions = await bridgeApi.getTransactions({
        accountId: account.id,
        minDate: since.toISOString().split('T')[0],
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
          isRecurring: false,
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

/**
 * Initialize a new Bridge user and return the uuid.
 * Call this once per app user, then store the UUID locally.
 */
export async function initBridgeUser(externalId?: string): Promise<string> {
  const user = await bridgeApi.createUser(externalId);
  return user.uuid;
}

/**
 * Get a Connect session URL for the user to link their BNP account.
 * Open this URL in a WebView or browser.
 */
export async function getBankConnectUrl(options?: {
  accountTypes?: 'payment' | 'all';
}): Promise<string> {
  return bridgeApi.createConnectSession({
    accountTypes: options?.accountTypes || 'all',
  });
}
