# 💰 Budget Control

Application mobile de gestion de budget personnelle avec synchronisation bancaire BNP Paribas.

## 🛠️ Stack Technique

- **Framework** : React Native (Expo SDK 55)
- **Language** : TypeScript
- **Base de données** : SQLite (expo-sqlite) — 100% locale
- **API Bancaire** : Bridge API (Open Banking)
- **Navigation** : React Navigation (Bottom Tabs)
- **Graphiques** : React Native SVG (composants custom)

## 🚀 Lancement

### Prérequis
- Node.js 18+
- npm ou yarn
- Expo CLI (`npm install -g expo-cli`) ou utiliser `npx expo`
- Expo Go (app mobile) ou un émulateur iOS/Android

### Installation

```bash
# Installer les dépendances
npm install

# Copier la configuration d'environnement
cp .env.example .env

# Lancer le serveur de développement
npx expo start
```

### Tester sur mobile
1. Télécharger **Expo Go** depuis l'App Store / Play Store
2. Scanner le QR code affiché dans le terminal
3. L'application démarre avec des **données de démonstration**

## 🏦 Synchronisation BNP Paribas (Bridge API)

L'app utilise [Bridge by Bankin'](https://bridgeapi.io/) pour la connexion Open Banking.

### Configuration
1. Créer un compte sur [bridgeapi.io](https://bridgeapi.io/)
2. Récupérer votre `CLIENT_ID` et `CLIENT_SECRET`
3. Éditer le fichier `.env` :

```env
BRIDGE_CLIENT_ID=votre_client_id
BRIDGE_CLIENT_SECRET=votre_client_secret
BRIDGE_API_URL=https://api.bridgeapi.io/v2
```

4. Relancer l'application
5. Aller dans l'onglet **Comptes** → appuyer sur **Synchroniser**

> **Note** : Sans clés API, l'application fonctionne avec les données de démonstration.

## 📱 Fonctionnalités

| Fonctionnalité | Description |
|---|---|
| 📊 **Dashboard** | Vue d'ensemble, score de santé financière, insights |
| 🏦 **Comptes** | Soldes chèques/livrets, transactions, sync BNP |
| 💰 **Budgets** | Jauges par catégorie, alertes dépassement |
| 📅 **Calendrier** | Prélèvements récurrents, vue mensuelle |
| 🎯 **Objectifs** | Anneaux de progression, suivi épargne |
| 📈 **Comparaison** | Mois actuel vs moyenne 3 mois, détection anomalies |

## 📂 Architecture

```
src/
├── components/       # Composants réutilisables (GaugeBar, ProgressRing, etc.)
├── database/         # SQLite : schéma, CRUD, seed
├── navigation/       # React Navigation (bottom tabs)
├── screens/          # 5 écrans principaux
├── services/         # Bridge API, analytics, sync
├── theme/            # Couleurs, typographie, design tokens
└── types/            # Interfaces TypeScript
```

## 🔒 Sécurité

- Les données sont stockées **localement** (SQLite)
- Les clés API sont dans `.env` (jamais commité)
- L'accès bancaire est en **lecture seule**
- Aucun serveur distant — tout est sur votre appareil

## 📝 Git

```bash
# Initialisation (déjà fait)
git init
git add .
git commit -m "feat: initial commit - budget control app"

# Pousser vers un repo distant
git remote add origin https://github.com/VOTRE_USERNAME/budget-control.git
git branch -M main
git push -u origin main
```
