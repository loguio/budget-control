import * as SecureStore from 'expo-secure-store';

const KEY = 'bridge.user_uuid';

export async function getStoredBridgeUserUuid(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function setStoredBridgeUserUuid(uuid: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, uuid);
}

export async function clearStoredBridgeUserUuid(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}

