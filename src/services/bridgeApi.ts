import axios, { AxiosInstance } from 'axios';

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
const BRIDGE_API_URL = process.env.EXPO_PUBLIC_BRIDGE_API_URL || 'https://api.bridgeapi.io';

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
  status: string; // v3: lowercase strings ("valid", "invalid_creds", etc.)
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
  description: string;
  raw_description: string;
  date: string;
  category: {
    id: number;
    name: string;
  };
  is_future: boolean;
  account_id: number;
}

interface BridgeConnectSession {
  redirect_url: string;
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
      '/v3/aggregation/users',
      body,
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
      '/v3/aggregation/authorization/token',
      body,
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

  // --- Connect Session (for user to link their bank) ---
  /**
   * Create a Connect session URL for adding a bank account.
   * v3: POST /v3/aggregation/connect/sessions/create
   */
  async createConnectSession(options?: {
    accountTypes?: 'payment' | 'all';
    providerId?: number;
    callbackUrl?: string;
  }): Promise<string> {
    const body: Record<string, any> = {};
    if (options?.accountTypes) body.account_types = options.accountTypes;
    if (options?.providerId) body.provider_id = options.providerId;
    if (options?.callbackUrl) body.callback_url = options.callbackUrl;

    const response = await this.client.post<BridgeConnectSession>(
      '/v3/aggregation/connect/sessions/create',
      body,
      { headers: this.getAuthHeaders() }
    );
    return response.data.redirect_url;
  }

  // --- Accounts ---
  /**
   * Fetch all accounts for the authenticated user.
   * v3: GET /v3/aggregation/accounts
   */
  async getAccounts(): Promise<BridgeAccount[]> {
    const response = await this.client.get<BridgePaginatedResponse<BridgeAccount>>(
      '/v3/aggregation/accounts',
      { headers: this.getAuthHeaders() }
    );
    return response.data.resources;
  }

  /**
   * Fetch a single account by ID.
   * v3: GET /v3/aggregation/accounts/{id}
   */
  async getAccount(accountId: number): Promise<BridgeAccount> {
    const response = await this.client.get<BridgeAccount>(
      `/v3/aggregation/accounts/${accountId}`,
      { headers: this.getAuthHeaders() }
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

    const response = await this.client.get<BridgePaginatedResponse<BridgeTransaction>>(
      '/v3/aggregation/transactions',
      {
        headers: this.getAuthHeaders(),
        params,
      }
    );
    return response.data.resources;
  }

  // --- Items (bank connections) ---
  /**
   * List all items (connections) for the authenticated user.
   * v3: GET /v3/aggregation/items
   */
  async getItems(): Promise<any[]> {
    const response = await this.client.get<BridgePaginatedResponse<any>>(
      '/v3/aggregation/items',
      { headers: this.getAuthHeaders() }
    );
    return response.data.resources;
  }

  // --- Providers (formerly Banks in v2) ---
  /**
   * List available providers.
   * v3: GET /v3/aggregation/providers (replaces /v2/banks)
   */
  async getProviders(): Promise<any[]> {
    const response = await this.client.get<BridgePaginatedResponse<any>>(
      '/v3/aggregation/providers',
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
export type { BridgeAccount, BridgeTransaction, BridgeUser };
