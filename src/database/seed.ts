import { upsertAccount, insertTransaction, upsertBudget, upsertSavingsGoal, upsertSubscription, queryFirst } from './db';
import { CategoryColors } from '../theme/colors';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function prevMonth(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  return d.toISOString().slice(0, 7);
}

export async function seedDemoData(): Promise<void> {
  // Check if already seeded
  const existing = await queryFirst<any>('SELECT COUNT(*) as count FROM accounts');
  if (existing && existing.count > 0) return;

  // --- Accounts ---
  const checkingId = uuid();
  const savingsId = uuid();
  const livretAId = uuid();

  await upsertAccount({
    id: checkingId,
    name: 'Compte Courant',
    type: 'checking',
    balance: 2847.53,
    bankName: 'BNP Paribas',
    iban: 'FR76 3000 4028 3700 0100 0000 123',
    lastSync: dateStr(0),
  });

  await upsertAccount({
    id: savingsId,
    name: 'Livret A',
    type: 'savings',
    balance: 12450.00,
    bankName: 'BNP Paribas',
    iban: 'FR76 3000 4028 3700 0100 0000 456',
    lastSync: dateStr(0),
  });

  await upsertAccount({
    id: livretAId,
    name: 'Livret Jeune',
    type: 'savings',
    balance: 1590.00,
    bankName: 'BNP Paribas',
    lastSync: dateStr(0),
  });

  // --- Transactions (current month + 3 months back) ---
  const txData = [
    // Current month
    { accountId: checkingId, amount: 2200, desc: 'Salaire Mars', cat: 'Salaire', days: 2, type: 'credit' as const },
    { accountId: checkingId, amount: -750, desc: 'Loyer Appartement', cat: 'Logement', days: 1, type: 'debit' as const },
    { accountId: checkingId, amount: -45.90, desc: 'Carrefour Market', cat: 'Alimentation', days: 1, type: 'debit' as const },
    { accountId: checkingId, amount: -9.99, desc: 'Netflix', cat: 'Abonnements', days: 3, type: 'debit' as const },
    { accountId: checkingId, amount: -14.99, desc: 'Spotify Family', cat: 'Abonnements', days: 3, type: 'debit' as const },
    { accountId: checkingId, amount: -67.50, desc: 'SNCF Billet Train', cat: 'Transport', days: 4, type: 'debit' as const },
    { accountId: checkingId, amount: -32.80, desc: 'Restaurant Le Bistrot', cat: 'Restaurants', days: 5, type: 'debit' as const },
    { accountId: checkingId, amount: -89.99, desc: 'Zara Shopping', cat: 'Shopping', days: 6, type: 'debit' as const },
    { accountId: checkingId, amount: -25.00, desc: 'Pharmacie', cat: 'Santé', days: 7, type: 'debit' as const },
    { accountId: checkingId, amount: -55.00, desc: 'Salle de sport', cat: 'Loisirs', days: 8, type: 'debit' as const },
    { accountId: checkingId, amount: -120.30, desc: 'Auchan Courses', cat: 'Alimentation', days: 10, type: 'debit' as const },
    { accountId: checkingId, amount: -42.00, desc: 'Uber Eats', cat: 'Restaurants', days: 11, type: 'debit' as const },
    { accountId: checkingId, amount: -19.99, desc: 'Amazon Prime', cat: 'Abonnements', days: 12, type: 'debit' as const },
    { accountId: checkingId, amount: -75.00, desc: 'EDF Électricité', cat: 'Logement', days: 14, type: 'debit' as const },
    { accountId: checkingId, amount: -15.50, desc: 'Boulangerie Paul', cat: 'Alimentation', days: 15, type: 'debit' as const },
    // 1 month ago
    { accountId: checkingId, amount: 2200, desc: 'Salaire Février', cat: 'Salaire', days: 32, type: 'credit' as const },
    { accountId: checkingId, amount: -750, desc: 'Loyer', cat: 'Logement', days: 31, type: 'debit' as const },
    { accountId: checkingId, amount: -135.40, desc: 'Courses Leclerc', cat: 'Alimentation', days: 35, type: 'debit' as const },
    { accountId: checkingId, amount: -9.99, desc: 'Netflix', cat: 'Abonnements', days: 33, type: 'debit' as const },
    { accountId: checkingId, amount: -14.99, desc: 'Spotify', cat: 'Abonnements', days: 33, type: 'debit' as const },
    { accountId: checkingId, amount: -45.00, desc: 'Essence Total', cat: 'Transport', days: 38, type: 'debit' as const },
    { accountId: checkingId, amount: -28.90, desc: 'Pizza Hut', cat: 'Restaurants', days: 40, type: 'debit' as const },
    { accountId: checkingId, amount: -55.00, desc: 'Sport', cat: 'Loisirs', days: 41, type: 'debit' as const },
    { accountId: checkingId, amount: -75.00, desc: 'EDF', cat: 'Logement', days: 44, type: 'debit' as const },
    { accountId: checkingId, amount: -62.50, desc: 'Courses Carrefour', cat: 'Alimentation', days: 48, type: 'debit' as const },
    { accountId: checkingId, amount: -19.99, desc: 'Amazon Prime', cat: 'Abonnements', days: 42, type: 'debit' as const },
    // 2 months ago
    { accountId: checkingId, amount: 2200, desc: 'Salaire Janvier', cat: 'Salaire', days: 62, type: 'credit' as const },
    { accountId: checkingId, amount: -750, desc: 'Loyer', cat: 'Logement', days: 61, type: 'debit' as const },
    { accountId: checkingId, amount: -98.70, desc: 'Courses Monoprix', cat: 'Alimentation', days: 65, type: 'debit' as const },
    { accountId: checkingId, amount: -9.99, desc: 'Netflix', cat: 'Abonnements', days: 63, type: 'debit' as const },
    { accountId: checkingId, amount: -14.99, desc: 'Spotify', cat: 'Abonnements', days: 63, type: 'debit' as const },
    { accountId: checkingId, amount: -38.00, desc: 'RATP Navigo', cat: 'Transport', days: 67, type: 'debit' as const },
    { accountId: checkingId, amount: -22.50, desc: 'Sushi Shop', cat: 'Restaurants', days: 70, type: 'debit' as const },
    { accountId: checkingId, amount: -55.00, desc: 'Sport', cat: 'Loisirs', days: 71, type: 'debit' as const },
    { accountId: checkingId, amount: -75.00, desc: 'EDF', cat: 'Logement', days: 74, type: 'debit' as const },
    { accountId: checkingId, amount: -45.30, desc: 'Intermarché', cat: 'Alimentation', days: 78, type: 'debit' as const },
    { accountId: checkingId, amount: -19.99, desc: 'Amazon Prime', cat: 'Abonnements', days: 72, type: 'debit' as const },
    // 3 months ago
    { accountId: checkingId, amount: 2200, desc: 'Salaire Décembre', cat: 'Salaire', days: 92, type: 'credit' as const },
    { accountId: checkingId, amount: -750, desc: 'Loyer', cat: 'Logement', days: 91, type: 'debit' as const },
    { accountId: checkingId, amount: -210.50, desc: 'Courses Noël', cat: 'Alimentation', days: 95, type: 'debit' as const },
    { accountId: checkingId, amount: -9.99, desc: 'Netflix', cat: 'Abonnements', days: 93, type: 'debit' as const },
    { accountId: checkingId, amount: -14.99, desc: 'Spotify', cat: 'Abonnements', days: 93, type: 'debit' as const },
    { accountId: checkingId, amount: -250.00, desc: 'Cadeaux Noël', cat: 'Shopping', days: 96, type: 'debit' as const },
    { accountId: checkingId, amount: -85.00, desc: 'Restaurant Noël', cat: 'Restaurants', days: 94, type: 'debit' as const },
    { accountId: checkingId, amount: -55.00, desc: 'Sport', cat: 'Loisirs', days: 99, type: 'debit' as const },
    { accountId: checkingId, amount: -75.00, desc: 'EDF', cat: 'Logement', days: 104, type: 'debit' as const },
    { accountId: checkingId, amount: -19.99, desc: 'Amazon Prime', cat: 'Abonnements', days: 102, type: 'debit' as const },
  ];

  for (const tx of txData) {
    await insertTransaction({
      id: uuid(),
      accountId: tx.accountId,
      amount: tx.amount,
      description: tx.desc,
      category: tx.cat,
      date: dateStr(tx.days),
      type: tx.type,
      isRecurring: ['Loyer', 'Netflix', 'Spotify', 'Amazon Prime', 'EDF', 'Sport'].some(n => tx.desc.includes(n)),
    });
  }

  // --- Budgets (current month) ---
  const month = currentMonth();
  const budgetData = [
    { cat: 'Alimentation', limit: 350 },
    { cat: 'Transport', limit: 150 },
    { cat: 'Logement', limit: 900 },
    { cat: 'Loisirs', limit: 100 },
    { cat: 'Shopping', limit: 150 },
    { cat: 'Santé', limit: 50 },
    { cat: 'Abonnements', limit: 60 },
    { cat: 'Restaurants', limit: 100 },
  ];

  for (const b of budgetData) {
    await upsertBudget({
      id: uuid(),
      category: b.cat,
      limit: b.limit,
      spent: 0,
      month,
      color: CategoryColors[b.cat] || '#8E92B0',
    });
  }

  // --- Savings Goals ---
  await upsertSavingsGoal({
    id: uuid(),
    name: 'Vacances Été',
    targetAmount: 2000,
    currentAmount: 1350,
    deadline: '2026-07-01',
    color: '#00CEC9',
    icon: '🏖️',
  });

  await upsertSavingsGoal({
    id: uuid(),
    name: 'MacBook Pro',
    targetAmount: 2500,
    currentAmount: 800,
    deadline: '2026-12-01',
    color: '#6C5CE7',
    icon: '💻',
  });

  await upsertSavingsGoal({
    id: uuid(),
    name: 'Fonds d\'urgence',
    targetAmount: 5000,
    currentAmount: 3200,
    deadline: undefined,
    color: '#00B894',
    icon: '🛡️',
  });

  // --- Subscriptions ---
  const subsData = [
    { name: 'Netflix', amount: 9.99, freq: 'monthly', day: 5, cat: 'Abonnements', color: '#E50914' },
    { name: 'Spotify Family', amount: 14.99, freq: 'monthly', day: 5, cat: 'Abonnements', color: '#1DB954' },
    { name: 'Amazon Prime', amount: 19.99, freq: 'monthly', day: 15, cat: 'Abonnements', color: '#FF9900' },
    { name: 'Salle de Sport', amount: 55.00, freq: 'monthly', day: 1, cat: 'Loisirs', color: '#E17055' },
    { name: 'EDF Électricité', amount: 75.00, freq: 'monthly', day: 20, cat: 'Logement', color: '#45B7D1' },
    { name: 'Loyer', amount: 750.00, freq: 'monthly', day: 1, cat: 'Logement', color: '#6C5CE7' },
    { name: 'Assurance Auto', amount: 480.00, freq: 'yearly', day: 15, cat: 'Transport', color: '#FDCB6E' },
  ];

  for (const sub of subsData) {
    const nextDate = new Date();
    nextDate.setDate(sub.day);
    if (nextDate < new Date()) nextDate.setMonth(nextDate.getMonth() + 1);

    await upsertSubscription({
      id: uuid(),
      name: sub.name,
      amount: sub.amount,
      frequency: sub.freq,
      nextDate: nextDate.toISOString().split('T')[0],
      category: sub.cat,
      color: sub.color,
    });
  }
}
