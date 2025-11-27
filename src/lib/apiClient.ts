'use client';

import { getSupabaseBrowserClient } from '@/lib/supabaseClient';

import { type AquariumDTO, type CareTaskDTO, type FishSpeciesDTO, type UserDTO } from '@/lib/clientTypes';

interface ApiError {
  error: string;
  details?: unknown;
}

type ApiResult<T> = { data: T | null; error: string | null };

type SuccessResult<T> = { data: T; error: null };

type FailureResult = { data: null; error: string };

const supabase = getSupabaseBrowserClient();

const handleResponse = async <T>(response: Response): Promise<ApiResult<T>> => {
  const contentType = response.headers.get('content-type');
  const json = contentType?.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    return {
      data: null,
      error: (json as ApiError | null)?.error ?? 'Произошла ошибка',
    };
  }
  return {
    data: json as T,
    error: null,
  };
};

const getAccessToken = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
};

const api = async <T>(input: RequestInfo, init?: RequestInit): Promise<ApiResult<T>> => {
  try {
    const token = await getAccessToken();
    const headers = new Headers({
      'content-type': 'application/json',
    });
    if (init?.headers) {
      const incoming = new Headers(init.headers);
      incoming.forEach((value, key) => headers.set(key, value));
    }
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    const response = await fetch(input, {
      ...init,
      headers,
    });
    return handleResponse<T>(response);
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Ошибка сети' };
  }
};

const syncUserProfile = async (): Promise<ApiResult<{ user: UserDTO }>> => {
  return api<{ user: UserDTO }>('/api/auth/session', { method: 'GET' });
};

export const getSession = async (): Promise<ApiResult<{ user: UserDTO | null }>> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    return { data: null, error: error.message ?? 'Не удалось получить сессию' };
  }
  if (!data.session) {
    return { data: { user: null }, error: null };
  }
  const synced = await syncUserProfile();
  if (synced.error || !synced.data) {
    return { data: { user: null }, error: synced.error };
  }
  return {
    data: { user: synced.data.user },
    error: null,
  };
};

export const login = async (payload: { email: string; password: string }): Promise<ApiResult<{ user: UserDTO }>> => {
  const { error } = await supabase.auth.signInWithPassword({
    email: payload.email,
    password: payload.password,
  });
  if (error) {
    return { data: null, error: error.message ?? 'Не удалось войти' };
  }
  const synced = await syncUserProfile();
  if (synced.error || !synced.data) {
    return { data: null, error: synced.error ?? 'Не удалось получить профиль' };
  }
  return synced as SuccessResult<{ user: UserDTO }>;
};

export const register = async (payload: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<ApiResult<{ user: UserDTO }>> => {
  const { error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: payload.displayName ? { name: payload.displayName } : undefined,
    },
  });
  if (error) {
    return { data: null, error: error.message ?? 'Не удалось создать аккаунт' };
  }
  const synced = await syncUserProfile();
  if (synced.error || !synced.data) {
    return { data: null, error: synced.error ?? 'Не удалось получить профиль' };
  }
  return synced as SuccessResult<{ user: UserDTO }>;
};

export const loginWithGoogle = async (): Promise<FailureResult | { data: null; error: null }> => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });
  if (error) {
    return { data: null, error: error.message ?? 'Не удалось выполнить вход через Google' };
  }
  if (data?.url && typeof window !== 'undefined') {
    window.location.href = data.url;
  }
  return { data: null, error: null };
};

export const logout = async (): Promise<ApiResult<{ success: boolean }>> => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { data: null, error: error.message ?? 'Не удалось выйти' };
  }
  return { data: { success: true }, error: null };
};

export const fetchAquariums = async () =>
  api<{ aquariums: AquariumDTO[] }>('/api/aquariums', { method: 'GET' });

export const fetchAquarium = async (aquariumId: string) =>
  api<{ aquarium: AquariumDTO }>(`/api/aquariums/${aquariumId}`, { method: 'GET' });

export const createAquariumRequest = async (payload: {
  name: string;
  volumeLiters: number;
  description?: string;
}) =>
  api<{ aquarium: AquariumDTO }>('/api/aquariums', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateAquariumRequest = async (
  aquariumId: string,
  payload: Partial<{ name: string; volumeLiters: number; description?: string }>,
) =>
  api<{ aquarium: AquariumDTO }>(`/api/aquariums/${aquariumId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const deleteAquariumRequest = async (aquariumId: string) =>
  api<{ success: boolean }>(`/api/aquariums/${aquariumId}`, { method: 'DELETE' });

export const addFishRequest = async (
  aquariumId: string,
  payload: { speciesId: string; quantity: number; sizeClass?: 'juvenile' | 'medium' | 'large' },
) =>
  api<{ aquarium: AquariumDTO }>(`/api/aquariums/${aquariumId}/stock`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateFishQuantityRequest = async (
  aquariumId: string,
  stockId: string,
  quantity: number,
) =>
  api<{ aquarium: AquariumDTO }>(`/api/aquariums/${aquariumId}/stock/${stockId}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  });

export const removeFishRequest = async (aquariumId: string, stockId: string) =>
  api<{ aquarium: AquariumDTO }>(`/api/aquariums/${aquariumId}/stock/${stockId}`, {
    method: 'DELETE',
  });

export const completeTaskRequest = async (
  aquariumId: string,
  taskId: string,
  measurements?: Record<string, number>,
) =>
  api<{ task: CareTaskDTO }>(`/api/aquariums/${aquariumId}/care-tasks/${taskId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ measurements }),
  });

export const fetchCareTasks = async (aquariumId: string) =>
  api<{ tasks: CareTaskDTO[] }>(`/api/aquariums/${aquariumId}/care-tasks`, { method: 'GET' });

export const fetchNotificationSettings = async () =>
  api<{ settings: UserDTO['notificationSettings'] }>('/api/notifications/settings', {
    method: 'GET',
  });

export const updateNotificationSettingsRequest = async (
  payload: Partial<UserDTO['notificationSettings']>,
) =>
  api<{ settings: UserDTO['notificationSettings'] }>('/api/notifications/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const fetchSubscription = async () =>
  api<{ subscription: UserDTO['subscription'] }>('/api/subscription', { method: 'GET' });

export const upgradeSubscriptionRequest = async (payload: {
  months?: number;
  aquariumLimit?: number;
}) =>
  api<{ subscription: UserDTO['subscription'] }>('/api/subscription/upgrade', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const fetchFishCatalog = async () =>
  api<{ species: FishSpeciesDTO[] }>('/api/fish', { method: 'GET' });
