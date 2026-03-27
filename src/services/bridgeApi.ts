import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Identifiant lisible pour tracer l’appel dans bridgeApi.ts (méthode / flux). */
    bridgeOperation?: string;
  }
}

/** Erreur Bridge : message exploitable + lien vers l’opération dans notre code. */
export class BridgeApiError extends Error {
  readonly operation: string;
  readonly httpMethod: string;
  readonly requestUrl: string;
  readonly status: number | null;
  readonly responseBody: unknown;

  constructor(params: {
    operation: string;
    message: string;
    httpMethod: string;
    requestUrl: string;
    status: number | null;
    responseBody: unknown;
  }) {
    super(params.message);
    this.name = 'BridgeApiError';
    this.operation = params.operation;
    this.httpMethod = params.httpMethod;
    this.requestUrl = params.requestUrl;
    this.status = params.status;
    this.responseBody = params.responseBody;
    Object.setPrototypeOf(this, BridgeApiError.prototype);
  }
}

function buildBridgeErrorFromAxios(operation: string, error: AxiosError): BridgeApiError {
  const cfg = error.config;
  const method = (cfg?.method || 'GET').toUpperCase();
  const path = cfg?.url || '';
  const base = cfg?.baseURL || '';
  const fullUrl = path.startsWith('http') ? path : `${base}${path}`;
  const status = error.response?.status ?? null;
  const data = error.response?.data;
  let detail = '';
  if (data !== undefined) {
    detail = typeof data === 'string' ? data : JSON.stringify(data);
  } else if (error.message) {
    detail = error.message;
  }
  if (detail.length > 800) detail = `${detail.slice(0, 800)}…`;

  const msg = `[bridgeApi.ts → ${operation}] ${method} ${fullUrl} → ${status ?? 'réseau'}${detail ? `: ${detail}` : ''}`;

  return new BridgeApiError({
    operation,
    message: msg,
    httpMethod: method,
    requestUrl: fullUrl,
    status,
    responseBody: data,
  });
}

// ============================================================
// Bridge API v3 Service — Open Banking Integration (BNP Paribas)
// ============================================================
// Documentation : https://docs.bridgeapi.io/docs
// Version API   : 2025-01-15 (v3)
//
// Configuration :
//   1. Inscrivez-vous sur https://dashboard.bridgeapi.io/
//   2. Récupérez votre CLIENT_ID et CLIENT_SECRET
//   3. Remplissez le fichier .env avec vos identifiants
//
// Changements v3 vs v2 :
//   - Tous les endpoints passent de /v2/ à /v3/aggregation/
//   - Plus besoin d'email/password → user_uuid ou external_user_id
//   - "Bank" remplacé par "Provider"
//   - Les valeurs null ne sont plus retournées dans les réponses
//   - /transactions/updated n'existe plus → utiliser ?since=
// ============================================================

// Environment variables
const BRIDGE_CLIENT_ID = process.env.EXPO_PUBLIC_BRIDGE_CLIENT_ID || '';
const BRIDGE_CLIENT_SECRET = process.env.EXPO_PUBLIC_BRIDGE_CLIENT_SECRET || '';
const BRIDGE_API_URL_RAW = process.env.EXPO_PUBLIC_BRIDGE_API_URL || 'https://api.bridgeapi.io';

function normalizeBridgeBaseUrl(raw: string): string {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  // Desired base for this app is ALWAYS Bridge v3 aggregation root:
  //   https://api.bridgeapi.io/v3/aggregation
  //
  // Accept common inputs and normalize:
  // - https://api.bridgeapi.io
  // - https://api.bridgeapi.io/v2
  // - https://api.bridgeapi.io/v3
  // - https://api.bridgeapi.io/v3/aggregation
  const root = trimmed.replace(/\/v\d+(\/aggregation)?$/i, '');
  return `${root || 'https://api.bridgeapi.io'}/v3/aggregation`;
}

const BRIDGE_API_URL = normalizeBridgeBaseUrl(BRIDGE_API_URL_RAW);

const AGGREGATION_PATH_PREFIX = '/v3/aggregation';

/**
 * Bridge renvoie `pagination.next_uri` en path absolu (`/v3/aggregation/transactions?…`).
 * Notre client axios a déjà `baseURL` = `…/v3/aggregation`, donc il faut retirer ce préfixe
 * pour éviter `…/v3/aggregation/v3/aggregation/...` (404).
 */
function normalizeBridgePaginationPath(uri: string): string {
  let path = uri.trim();
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const u = new URL(path);
      path = u.pathname + u.search;
    } catch {
      return uri;
    }
  }
  if (path.startsWith(`${AGGREGATION_PATH_PREFIX}/`)) {
    return path.slice(AGGREGATION_PATH_PREFIX.length);
  }
  if (path === AGGREGATION_PATH_PREFIX) {
    return '/';
  }
  return path;
}

// --- Types v3 ---

interface BridgeAuthResponse {
  access_token: string;
  expires_at: string;
  user: {
    uuid: string;
    external_user_id?: string;
  };
}

interface BridgeUser {
  uuid: string;
  external_user_id?: string;
}

interface BridgeAccount {
  id: number;
  name: string;
  balance: number;
  // Note: account status is not always present in v3 responses
  type: string;
  iban?: string;
  currency_code: string;
  provider: {
    id: number;
    name: string;
  };
  item_id: number;
}

interface BridgeTransaction {
  id: number;
  amount: number;
  currency_code: string;
  date: string;
  clean_description?: string;
  provider_description?: string;
  description?: string;
  raw_description?: string;
  category?: {
    id: number;
    name: string;
  };
  future?: boolean;
  is_future?: boolean;
  account_id: number;
}

interface BridgeConnectSession {
  id: string;
  url: string;
}

interface BridgeItem {
  id: number;
  provider_id: number;
  status: number;
  status_code_info?: string;
  status_code_description?: string;
  account_types: 'payment' | 'all';
  last_successful_refresh?: string;
  last_try_refresh?: string;
  created_at?: string;
  authentication_expires_at?: string;
}

interface BridgePaginatedResponse<T> {
  resources: T[];
  pagination?: {
    next_uri?: string;
  };
}

class BridgeApiService {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private currentUserUuid: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: BRIDGE_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Bridge-Version': '2025-01-15',
        'Client-Id': BRIDGE_CLIENT_ID,
        'Client-Secret': BRIDGE_CLIENT_SECRET,
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const cfg = error.config;
        if (!cfg) {
          return Promise.reject(error);
        }
        const op = cfg.bridgeOperation ?? 'BridgeApiService(requête sans bridgeOperation)';
        return Promise.reject(buildBridgeErrorFromAxios(op, error));
      }
    );
  }

  // --- Check if API is configured ---
  isConfigured(): boolean {
    return !!(BRIDGE_CLIENT_ID && BRIDGE_CLIENT_SECRET);
  }

  // --- User Management (v3: no email/password) ---

  /**
   * Create a new Bridge user.
   * v3: No email/password required. Optionally provide an external_user_id.
   */
  async createUser(externalUserId?: string): Promise<BridgeUser> {
    const body: Record<string, any> = {};
    if (externalUserId) {
      body.external_user_id = externalUserId;
    }

    const response = await this.client.post<BridgeUser>(
      '/users',
      body,
      { bridgeOperation: 'createUser' }
    );

    this.currentUserUuid = response.data.uuid;
    return response.data;
  }

  /**
   * Authenticate a user by uuid or external_user_id to get an access_token.
   * v3: POST /v3/aggregation/authorization/token
   */
  async authenticate(options: {
    userUuid?: string;
    externalUserId?: string;
  }): Promise<BridgeAuthResponse> {
    const body: Record<string, any> = {};
    if (options.userUuid) {
      body.user_uuid = options.userUuid;
    } else if (options.externalUserId) {
      body.external_user_id = options.externalUserId;
    } else {
      throw new Error('Provide either userUuid or externalUserId');
    }
    const response = await this.client.post<BridgeAuthResponse>(
      '/authorization/token',
      body,
      { bridgeOperation: 'authenticate' }
    );
    this.accessToken = response.data.access_token;
    this.tokenExpiry = new Date(response.data.expires_at);
    this.currentUserUuid = response.data.user.uuid;

    return response.data;
  }

  // --- Auth Headers ---
  private getAuthHeaders() {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Client-Id': BRIDGE_CLIENT_ID,
      'Client-Secret': BRIDGE_CLIENT_SECRET,
      'Bridge-Version': '2025-01-15',
    };
  }

  // --- Token status ---
  isTokenValid(): boolean {
    if (!this.accessToken || !this.tokenExpiry) return false;
    return new Date() < this.tokenExpiry;
  }

  getCurrentUserUuid(): string | null {
    return this.currentUserUuid;
  }

  setCurrentUserUuid(userUuid: string | null) {
    this.currentUserUuid = userUuid;
  }

  /** Infos non sensibles pour l’écran debug (pas de token complet). */
  getDebugMeta() {
    return {
      baseUrl: BRIDGE_API_URL,
      configured: this.isConfigured(),
      clientIdSuffix: BRIDGE_CLIENT_ID ? `…${BRIDGE_CLIENT_ID.slice(-6)}` : '(vide)',
      currentUserUuid: this.currentUserUuid,
      tokenValid: this.isTokenValid(),
      tokenExpiresAt: this.tokenExpiry?.toISOString() ?? null,
    };
  }

  /**
   * Une seule requête par ressource (première page) pour le debug — évite de paginer toute la base.
   */
  async fetchDebugPipelineSnapshot(userUuid: string): Promise<{
    ok: boolean;
    error?: string;
    tokenExpiresAt: string | null;
    items: BridgeItem[];
    accounts: BridgeAccount[];
    transactionsSample: BridgeTransaction[];
  }> {
    try {
      if (!this.isTokenValid()) {
        await this.authenticate({ userUuid });
      }
      const headers = this.getAuthHeaders();
      const [itemsRes, accRes, txRes] = await Promise.all([
        this.client.get<BridgePaginatedResponse<BridgeItem>>('/items', {
          headers,
          params: { limit: 10 },
          bridgeOperation: 'fetchDebugPipelineSnapshot.items',
        }),
        this.client.get<BridgePaginatedResponse<BridgeAccount>>('/accounts', {
          headers,
          params: { limit: 10 },
          bridgeOperation: 'fetchDebugPipelineSnapshot.accounts',
        }),
        this.client.get<BridgePaginatedResponse<BridgeTransaction>>('/transactions', {
          headers,
          params: { limit: 8 },
          bridgeOperation: 'fetchDebugPipelineSnapshot.transactions',
        }),
      ]);
      return {
        ok: true,
        tokenExpiresAt: this.tokenExpiry?.toISOString() ?? null,
        items: itemsRes.data.resources || [],
        accounts: accRes.data.resources || [],
        transactionsSample: txRes.data.resources || [],
      };
    } catch (e: any) {
      const msg =
        e?.response?.data != null
          ? JSON.stringify(e.response.data)
          : e?.message || 'Erreur Bridge';
      return {
        ok: false,
        error: msg,
        tokenExpiresAt: this.tokenExpiry?.toISOString() ?? null,
        items: [],
        accounts: [],
        transactionsSample: [],
      };
    }
  }

  private async fetchAllPages<T>(operation: string, firstPath: string, options: {
    headers?: Record<string, string>;
    params?: Record<string, any>;
  }): Promise<T[]> {
    const all: T[] = [];
    let nextPath: string | null = firstPath;
    let first = true;
    let page = 0;

    while (nextPath) {
      page += 1;
      const response: { data: BridgePaginatedResponse<T> } = await this.client.get<BridgePaginatedResponse<T>>(
        nextPath,
        {
          ...(first ? options : { headers: options.headers }),
          bridgeOperation: `${operation}.page${page}`,
        }
      );
      all.push(...(response.data.resources || []));
      const nextUri: string | undefined | null = response.data.pagination?.next_uri;
      nextPath = nextUri ? normalizeBridgePaginationPath(nextUri) : null;
      first = false;
    }

    return all;
  }

  // --- Connect Session (for user to link their bank) ---
  /**
   * Create a Connect session URL for adding a bank account.
   * v3: POST /v3/aggregation/connect-sessions
   */
  async createConnectSession(options?: {
    userEmail?: string;
    accountTypes?: 'payment' | 'all';
    providerId?: number;
    callbackUrl?: string;
    context?: string;
    countryCode?: string;
    allowAccountSelection?: boolean;
    maxSelectableAccounts?: number;
    // Manage existing item:
    itemId?: number;
    forceReauthentication?: boolean;
  }): Promise<string> {
    const body: Record<string, any> = {};
    if (options?.accountTypes) body.account_types = options.accountTypes;
    if (options?.callbackUrl) body.callback_url = options.callbackUrl;
    if (options?.context) body.context = options.context;
    if (options?.countryCode) body.country_code = options.countryCode;
    if (typeof options?.allowAccountSelection === 'boolean') body.allow_account_selection = options.allowAccountSelection;
    if (typeof options?.maxSelectableAccounts === 'number') body.max_selectable_accounts = options.maxSelectableAccounts;

    if (typeof options?.itemId === 'number') {
      body.item_id = options.itemId;
      if (typeof options?.forceReauthentication === 'boolean') {
        body.force_reauthentication = options.forceReauthentication;
      }
    } else {
      // Connect new item flow requires a user_email (unless using temporary sync).
      if (options?.userEmail) body.user_email = options.userEmail;
      if (typeof options?.providerId === 'number') body.provider_id = options.providerId;
    }

    const response = await this.client.post<BridgeConnectSession>(
      '/connect-sessions',
      body,
      { headers: this.getAuthHeaders(), bridgeOperation: 'createConnectSession' }
    );
    return response.data.url;
  }

  // --- Accounts ---
  /**
   * Fetch all accounts for the authenticated user.
   * v3: GET /v3/aggregation/accounts
   */
  async getAccounts(options?: { itemId?: number; limit?: number }): Promise<BridgeAccount[]> {
    const params: Record<string, any> = {};
    if (typeof options?.itemId === 'number') params.item_id = options.itemId;
    if (typeof options?.limit === 'number') params.limit = options.limit;
    return this.fetchAllPages<BridgeAccount>('getAccounts', '/accounts', {
      headers: this.getAuthHeaders(),
      params,
    });
  }

  /**
   * Fetch a single account by ID.
   * v3: GET /v3/aggregation/accounts/{id}
   */
  async getAccount(accountId: number): Promise<BridgeAccount> {
    const response = await this.client.get<BridgeAccount>(
      `/accounts/${accountId}`,
      { headers: this.getAuthHeaders(), bridgeOperation: 'getAccount' }
    );
    return response.data;
  }

  // --- Transactions ---
  /**
   * Fetch transactions.
   * v3: GET /v3/aggregation/transactions
   *     - since, min_date, max_date params
   *     - /transactions/updated is REMOVED in v3 → use ?since= instead
   */
  async getTransactions(options?: {
    accountId?: number;
    since?: string;    // ISO date — only new transactions since this date
    minDate?: string;  // Filter: transactions on or after this date
    maxDate?: string;  // Filter: transactions on or before this date
    limit?: number;
  }): Promise<BridgeTransaction[]> {
    const params: Record<string, any> = {};
    if (options?.accountId) params.account_id = options.accountId;
    if (options?.since) params.since = options.since;
    if (options?.minDate) params.min_date = options.minDate;
    if (options?.maxDate) params.max_date = options.maxDate;
    if (options?.limit) params.limit = options.limit;

    return this.fetchAllPages<BridgeTransaction>('getTransactions', '/transactions', {
      headers: this.getAuthHeaders(),
      params,
    });
  }

  // --- Items (bank connections) ---
  /**
   * List all items (connections) for the authenticated user.
   * v3: GET /v3/aggregation/items
   */
  async getItems(options?: { limit?: number }): Promise<BridgeItem[]> {
    const params: Record<string, any> = {};
    if (typeof options?.limit === 'number') params.limit = options.limit;
    return this.fetchAllPages<BridgeItem>('getItems', '/items', {
      headers: this.getAuthHeaders(),
      params,
    });
  }

  // --- Providers (formerly Banks in v2) ---
  /**
   * List available providers.
   * v3: GET /v3/aggregation/providers (replaces /v2/banks)
   */
  async getProviders(): Promise<any[]> {
    const response = await this.client.get<BridgePaginatedResponse<any>>(
      '/providers',
      { bridgeOperation: 'getProviders' }
    );
    return response.data.resources;
  }

  // --- Mapping Helpers ---

  /** Map Bridge account type to our internal type */
  mapAccountType(bridgeType: string): 'checking' | 'savings' {
    const savingsTypes = ['savings', 'life_insurance', 'market', 'loan'];
    return savingsTypes.includes(bridgeType) ? 'savings' : 'checking';
  }

  /** Map Bridge category to our budget categories */
  mapCategory(bridgeCategory: { id: number; name: string }): string {
    const mapping: Record<string, string> = {
      'alimentation': 'Alimentation',
      'supermarché': 'Alimentation',
      'restaurant': 'Restaurants',
      'bar': 'Restaurants',
      'transport': 'Transport',
      'logement': 'Logement',
      'loisir': 'Loisirs',
      'sortie': 'Loisirs',
      'shopping': 'Shopping',
      'santé': 'Santé',
      'education': 'Éducation',
      'formation': 'Éducation',
      'abonnement': 'Abonnements',
    };

    const name = bridgeCategory.name.toLowerCase();
    for (const [key, value] of Object.entries(mapping)) {
      if (name.includes(key)) {
        return value;
      }
    }
    return 'Autre';
  }
}

export const bridgeApi = new BridgeApiService();
export type { BridgeAccount, BridgeTransaction, BridgeUser, BridgeItem };
