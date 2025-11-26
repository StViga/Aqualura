import { AquariumDTO, CareTaskDTO, FishSpeciesDTO, UserDTO } from "@/lib/clientTypes";

interface ApiError {
  error: string;
  details?: unknown;
}

type ApiResult<T> = { data: T | null; error: string | null };

const handleResponse = async <T>(response: Response): Promise<ApiResult<T>> => {
  const contentType = response.headers.get("content-type");
  const json = contentType?.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    return {
      data: null,
      error: (json as ApiError | null)?.error ?? "Произошла ошибка",
    };
  }
  return {
    data: json as T,
    error: null,
  };
};

export const api = async <T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<ApiResult<T>> => {
  try {
    const response = await fetch(input, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
      credentials: "include",
    });
    return handleResponse<T>(response);
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Ошибка сети" };
  }
};

export const getSession = async () =>
  api<{ user: UserDTO | null }>("/api/auth/session", { method: "GET" });

export const login = async (payload: { email: string; password: string }) =>
  api<{ user: UserDTO }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const register = async (payload: {
  email: string;
  password: string;
  displayName?: string;
}) =>
  api<{ user: UserDTO }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const logout = async () => api<{ success: boolean }>("/api/auth/logout", { method: "POST" });

export const fetchAquariums = async () =>
  api<{ aquariums: AquariumDTO[] }>("/api/aquariums", { method: "GET" });

export const fetchAquarium = async (aquariumId: string) =>
  api<{ aquarium: AquariumDTO }>(`/api/aquariums/${aquariumId}`, { method: "GET" });

export const createAquariumRequest = async (payload: {
  name: string;
  volumeLiters: number;
  description?: string;
}) =>
  api<{ aquarium: AquariumDTO }>("/api/aquariums", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateAquariumRequest = async (
  aquariumId: string,
  payload: Partial<{ name: string; volumeLiters: number; description?: string }>,
) =>
  api<{ aquarium: AquariumDTO }>(`/api/aquariums/${aquariumId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteAquariumRequest = async (aquariumId: string) =>
  api<{ success: boolean }>(`/api/aquariums/${aquariumId}`, { method: "DELETE" });

export const addFishRequest = async (
  aquariumId: string,
  payload: { speciesId: string; quantity: number; sizeClass?: "juvenile" | "medium" | "large" },
) =>
  api<{ aquarium: AquariumDTO }>(`/api/aquariums/${aquariumId}/stock`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateFishQuantityRequest = async (
  aquariumId: string,
  stockId: string,
  quantity: number,
) =>
  api<{ aquarium: AquariumDTO }>(`/api/aquariums/${aquariumId}/stock/${stockId}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });

export const removeFishRequest = async (aquariumId: string, stockId: string) =>
  api<{ aquarium: AquariumDTO }>(`/api/aquariums/${aquariumId}/stock/${stockId}`, {
    method: "DELETE",
  });

export const completeTaskRequest = async (
  aquariumId: string,
  taskId: string,
  measurements?: Record<string, number>,
) =>
  api<{ task: CareTaskDTO }>(`/api/aquariums/${aquariumId}/care-tasks/${taskId}/complete`, {
    method: "POST",
    body: JSON.stringify({ measurements }),
  });

export const fetchCareTasks = async (aquariumId: string) =>
  api<{ tasks: CareTaskDTO[] }>(`/api/aquariums/${aquariumId}/care-tasks`, { method: "GET" });

export const fetchNotificationSettings = async () =>
  api<{ settings: UserDTO["notificationSettings"] }>("/api/notifications/settings", {
    method: "GET",
  });

export const updateNotificationSettingsRequest = async (
  payload: Partial<UserDTO["notificationSettings"]>,
) =>
  api<{ settings: UserDTO["notificationSettings"] }>("/api/notifications/settings", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const fetchSubscription = async () =>
  api<{ subscription: UserDTO["subscription"] }>("/api/subscription", { method: "GET" });

export const upgradeSubscriptionRequest = async (payload: {
  months?: number;
  aquariumLimit?: number;
}) =>
  api<{ subscription: UserDTO["subscription"] }>("/api/subscription/upgrade", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const fetchFishCatalog = async () =>
  api<{ species: FishSpeciesDTO[] }>("/api/fish", { method: "GET" });
