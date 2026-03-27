import axios, { AxiosInstance } from 'axios';

// ============================================================
// Bridge API Service — Open Banking Integration (BNP Paribas)
// ============================================================
// Configuration:
//   1. Inscrivez-vous sur https://bridgeapi.io/
//   2. Récupérez votre CLIENT_ID et CLIENT_SECRET
//   3. Remplissez le fichier .env avec vos identifiants
//
// Cette classe gère l'authentification, la récupération des
// comptes et des transactions depuis Bridge API.
// ============================================================

// Environment variables (loaded via babel plugin or expo config)
const BRIDGE_CLIENT_ID = process.env.BRIDGE_CLIENT_ID || '';
const BRIDGE_CLIENT_SECRET = process.env.BRIDGE_CLIENT_SECRET || '';
const BRIDGE_API_URL = process.env.BRIDGE_API_URL || 'https://api.bridgeapi.io/v2';

interface BridgeAuthResponse {
  access_token: string;
  expires_at: string;
  user: {
    uuid: string;
    email: string;
  };
}

interface BridgeAccount {
  id: number;
  name: string;
  balance: number;
  status: number;
  type: string;
  iban: string;
  currency_code: string;
  bank: {
    id: number;
    name: string;
  };
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

interface BridgeConnectUrl {
  redirect_url: string;
}

class BridgeApiService {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: BRIDGE_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Bridge-Version': '2021-06-01',
      },
    });
  }

  // --- Check if API is configured ---
  isConfigured(): boolean {
    return !!(BRIDGE_CLIENT_ID && BRIDGE_CLIENT_SECRET);
  }

  // --- Authentication ---
  async authenticate(email: string, password: string): Promise<BridgeAuthResponse> {
    const response = await this.client.post<BridgeAuthResponse>('/authenticate', {
      client_id: BRIDGE_CLIENT_ID,
      client_secret: BRIDGE_CLIENT_SECRET,
      email,
      password,
    });

    this.accessToken = response.data.access_token;
    this.tokenExpiry = new Date(response.data.expires_at);

    return response.data;
  }

  // --- Get authenticated client headers ---
  private getAuthHeaders() {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Client-Id': BRIDGE_CLIENT_ID,
      'Client-Secret': BRIDGE_CLIENT_SECRET,
    };
  }

  // --- Check token validity ---
  isTokenValid(): boolean {
    if (!this.accessToken || !this.tokenExpiry) return false;
    return new Date() < this.tokenExpiry;
  }

  // --- Generate Connect URL (for user to add bank) ---
  async getConnectUrl(): Promise<string> {
    const response = await this.client.post<BridgeConnectUrl>(
      '/connect/items/add',
      {},
      { headers: this.getAuthHeaders() }
    );
    return response.data.redirect_url;
  }

  // --- Fetch all accounts ---
  async getAccounts(): Promise<BridgeAccount[]> {
    const response = await this.client.get<{ resources: BridgeAccount[] }>(
      '/accounts',
      { headers: this.getAuthHeaders() }
    );
    return response.data.resources;
  }

  // --- Fetch transactions for an account ---
  async getTransactions(options?: {
    accountId?: number;
    since?: string;
    until?: string;
    limit?: number;
  }): Promise<BridgeTransaction[]> {
    const params: Record<string, any> = {};
    if (options?.accountId) params.account_id = options.accountId;
    if (options?.since) params.since = options.since;
    if (options?.until) params.until = options.until;
    if (options?.limit) params.limit = options.limit;

    const response = await this.client.get<{ resources: BridgeTransaction[] }>(
      '/transactions',
      {
        headers: this.getAuthHeaders(),
        params,
      }
    );
    return response.data.resources;
  }

  // --- Fetch updated transactions ---
  async getUpdatedTransactions(since?: string): Promise<BridgeTransaction[]> {
    const params: Record<string, any> = {};
    if (since) params.since = since;

    const response = await this.client.get<{ resources: BridgeTransaction[] }>(
      '/transactions/updated',
      {
        headers: this.getAuthHeaders(),
        params,
      }
    );
    return response.data.resources;
  }

  // --- Map Bridge account type to our type ---
  mapAccountType(bridgeType: string): 'checking' | 'savings' {
    const savingsTypes = ['savings', 'life_insurance', 'market', 'loan'];
    return savingsTypes.includes(bridgeType) ? 'savings' : 'checking';
  }

  // --- Map Bridge category to our categories ---
  mapCategory(bridgeCategory: { id: number; name: string }): string {
    const mapping: Record<string, string> = {
      'Alimentation & supermarché': 'Alimentation',
      'Restaurants & bars': 'Restaurants',
      'Transports': 'Transport',
      'Logement': 'Logement',
      'Loisirs & sorties': 'Loisirs',
      'Shopping': 'Shopping',
      'Santé': 'Santé',
      'Education & formation': 'Éducation',
      'Abonnements': 'Abonnements',
    };

    for (const [key, value] of Object.entries(mapping)) {
      if (bridgeCategory.name.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }
    return 'Autre';
  }
}

export const bridgeApi = new BridgeApiService();
export type { BridgeAccount, BridgeTransaction };
