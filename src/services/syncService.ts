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
  action?: {
    type: 'connect';
    itemId?: number;
    forceReauthentication?: boolean;
  };
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
    console.log('syncBankData', bridgeApi.isTokenValid() );
    // Authenticate with user UUID (v3 flow)
    if (!bridgeApi.isTokenValid()) {
      await bridgeApi.authenticate({ userUuid });
    }
    console.log(await bridgeApi.getItems({ limit: 500 }));
    // Fetch items first (connections), then accounts.
    const items = await bridgeApi.getItems({ limit: 500 });
    if (!items || items.length === 0) {
      return {
        success: false,
        accountsSynced: 0,
        transactionsSynced: 0,
        error: "Aucune connexion bancaire (item) trouvée. Connectez d'abord votre banque via Bridge, puis réessayez.",
        action: { type: 'connect' },
      };
    }

    // A "healthy" item typically has status 0 / ok (see Bridge docs).
    const unhealthy = items.find((it) => it.status !== 0);
    if (unhealthy) {
      return {
        success: false,
        accountsSynced: 0,
        transactionsSynced: 0,
        error:
          unhealthy.status_code_description ||
          `Connexion bancaire incomplète (${unhealthy.status_code_info || unhealthy.status}). Ouvrez Bridge pour finaliser.`,
        action: { type: 'connect', itemId: unhealthy.id, forceReauthentication: true },
      };
    }

    // Fetch accounts (all pages)
    const bridgeAccounts = await bridgeApi.getAccounts({ limit: 500 });
    if (!bridgeAccounts || bridgeAccounts.length === 0) {
      return {
        success: false,
        accountsSynced: 0,
        transactionsSynced: 0,
        error: "Aucun compte trouvé. Ouvrez Bridge pour connecter/autoriser vos comptes, puis réessayez.",
        action: { type: 'connect' },
      };
    }
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
        const description =
          (tx as any).description ||
          (tx as any).clean_description ||
          (tx as any).raw_description ||
          (tx as any).provider_description ||
          '';
        await insertTransaction({
          id: `bridge-tx-${tx.id}`,
          accountId: `bridge-${account.id}`,
          amount: tx.amount,
          description,
          category: tx.category ? bridgeApi.mapCategory(tx.category) : 'Autre',
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
  console.log('initBridgeUser', externalId);
  const user = await bridgeApi.createUser(externalId);
  return user.uuid;
}

/**
 * Get a Connect session URL for the user to link their BNP account.
 * Open this URL in a WebView or browser.
 */
export async function getBankConnectUrl(options?: {
  userUuid?: string;
  itemId?: number;
  forceReauthentication?: boolean;
  accountTypes?: 'payment' | 'all';
}): Promise<string> {
  const userUuid = options?.userUuid || bridgeApi.getCurrentUserUuid();
  const safeId = (userUuid || 'user').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32) || 'user';
  const userEmail = `${safeId}@budget-control.app`;

  return bridgeApi.createConnectSession({
    userEmail,
    accountTypes: options?.accountTypes || 'all',
    itemId: options?.itemId,
    forceReauthentication: options?.forceReauthentication,
  });
}
