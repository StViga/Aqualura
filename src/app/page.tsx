'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

import {
  addFishRequest,
  completeTaskRequest,
  createAquariumRequest,
  fetchAquarium,
  fetchAquariums,
  fetchFishCatalog,
  fetchNotificationSettings,
  fetchSubscription,
  getSession,
  login,
  logout,
  register,
  removeFishRequest,
  updateFishQuantityRequest,
  updateNotificationSettingsRequest,
  upgradeSubscriptionRequest,
} from '@/lib/apiClient';
import {
  AquariumDTO,
  CareTaskDTO,
  FishSpeciesDTO,
  NotificationSettingsDTO,
  UserDTO,
} from '@/lib/clientTypes';
import { cn } from '@/lib/utils';

interface ErrorState {
  message: string;
  context?: string;
}

const statusCopy: Record<AquariumDTO['status'], { title: string; tone: string }> = {
  comfort: {
    title: 'Комфортная нагрузка',
    tone: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  },
  elevated: {
    title: 'Повышенная нагрузка',
    tone: 'bg-amber-100 text-amber-700 border border-amber-200',
  },
  critical: {
    title: 'Критическая нагрузка',
    tone: 'bg-rose-100 text-rose-700 border border-rose-200',
  },
};

const compatibilityCopy: Record<AquariumDTO['compatibilityStatus'], string> = {
  ok: 'Конфликтов совместимости не обнаружено',
  warn: 'Есть потенциальные конфликты — проверьте предупреждения ниже',
};

const defaultNotificationSettings: NotificationSettingsDTO = {
  channel: 'email',
  preferredTime: 'morning',
  timeZone: 'UTC',
};

const taskStatusTone: Record<CareTaskDTO['status'], string> = {
  active: 'bg-sky-50 border border-sky-200 text-sky-700',
  completed: 'bg-emerald-50 border border-emerald-200 text-emerald-700',
  overdue: 'bg-rose-50 border border-rose-200 text-rose-700',
};

const friendlyTaskStatus: Record<CareTaskDTO['status'], string> = {
  active: 'Активна',
  completed: 'Выполнена',
  overdue: 'Просрочена',
};

const behaviorCopy: Record<AquariumDTO['species'][number]['behavior'], string> = {
  peaceful: 'Мирная',
  semi_aggressive: 'Полуагрессивная',
  aggressive: 'Агрессивная',
  predator: 'Хищник',
  bottom_dweller: 'Донная',
  schooling: 'Стайная',
};

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  return format(new Date(iso), 'd MMMM yyyy, HH:mm', { locale: ru });
};

const formatRelative = (iso: string) =>
  formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ru });

const statusComment = (aquarium: AquariumDTO) => {
  switch (aquarium.status) {
    case 'comfort':
      return 'Биозагрузка в норме, добавление новых рыб допустимо после контроля параметров воды.';
    case 'elevated':
      return 'Нагрузка растет, рекомендуется усилить обслуживание и подумать об увеличении объема.';
    case 'critical':
      return 'Биозагрузка критическая, уменьшите количество рыб или добавьте объем и фильтрацию.';
    default:
      return '';
  }
};

const cardShadow = 'shadow-sm hover:shadow-md transition-shadow duration-200';

export default function AquariaGuardian() {
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [user, setUser] = useState<UserDTO | null>(null);
  const [aquariums, setAquariums] = useState<AquariumDTO[]>([]);
  const [selectedAquarium, setSelectedAquarium] = useState<AquariumDTO | null>(null);
  const [fishCatalog, setFishCatalog] = useState<FishSpeciesDTO[]>([]);
  const [error, setError] = useState<ErrorState | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', volumeLiters: 60, description: '' });
  const [showAddFishForm, setShowAddFishForm] = useState(false);
  const [fishForm, setFishForm] = useState({ speciesId: '', quantity: 1, sizeClass: 'medium' as 'juvenile' | 'medium' | 'large' });
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<NotificationSettingsDTO>(defaultNotificationSettings);
  const [taskCompletion, setTaskCompletion] = useState<{ task: CareTaskDTO; values: Record<string, string> } | null>(null);

  const clearMessages = () => {
    setError(null);
    setInfoMessage(null);
  };

  const handleApiError = (message: string, context?: string) => {
    setError({ message, context });
  };

  const loadInitial = useCallback(async () => {
    setLoading(true);
    clearMessages();
    const session = await getSession();
    if (session.error) {
      setError({ message: session.error, context: 'session' });
      setLoading(false);
      return;
    }
    const currentUser = session.data?.user ?? null;
    setUser(currentUser);
    if (currentUser) {
      const [aquariumRes, fishRes, settingsRes] = await Promise.all([
        fetchAquariums(),
        fetchFishCatalog(),
        fetchNotificationSettings(),
      ]);
      if (aquariumRes.error) handleApiError(aquariumRes.error, 'aquariums');
      if (fishRes.error) handleApiError(fishRes.error, 'fish');
      if (settingsRes.error) handleApiError(settingsRes.error, 'settings');
      if (aquariumRes.data) setAquariums(aquariumRes.data.aquariums);
      if (fishRes.data) setFishCatalog(fishRes.data.species);
      if (settingsRes.data) setSettings(settingsRes.data.settings);
    } else {
      const fishRes = await fetchFishCatalog();
      if (fishRes.data) setFishCatalog(fishRes.data.species);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadInitial();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadInitial]);

  const handleLogin = async (form: { email: string; password: string }) => {
    setIsBusy(true);
    clearMessages();
    const response = await login(form);
    if (response.error || !response.data) {
      handleApiError(response.error ?? 'Не удалось войти', 'login');
      setIsBusy(false);
      return;
    }
    setUser(response.data.user);
    await loadInitial();
    setIsBusy(false);
  };

  const handleRegister = async (form: { email: string; password: string; displayName?: string }) => {
    setIsBusy(true);
    clearMessages();
    const response = await register(form);
    if (response.error || !response.data) {
      handleApiError(response.error ?? 'Не удалось создать аккаунт', 'register');
      setIsBusy(false);
      return;
    }
    setUser(response.data.user);
    await loadInitial();
    setIsBusy(false);
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAquariums([]);
    setSelectedAquarium(null);
    setInfoMessage('Вы вышли из приложения');
  };

  const openAquarium = async (aquariumId: string) => {
    setIsBusy(true);
    clearMessages();
    const response = await fetchAquarium(aquariumId);
    if (response.error || !response.data) {
      handleApiError(response.error ?? 'Не удалось загрузить аквариум', 'aquarium');
      setIsBusy(false);
      return;
    }
    setSelectedAquarium(response.data.aquarium);
    setIsBusy(false);
  };

  const submitCreateAquarium = async () => {
    if (!createForm.name.trim()) {
      handleApiError('Название обязательно');
      return;
    }
    setIsBusy(true);
    clearMessages();
    const response = await createAquariumRequest({
      name: createForm.name.trim(),
      volumeLiters: Number(createForm.volumeLiters),
      description: createForm.description.trim() || undefined,
    });
    if (response.error || !response.data) {
      handleApiError(response.error ?? 'Не удалось создать аквариум');
      setIsBusy(false);
      return;
    }
    const updated = response.data.aquarium;
    setAquariums((prev) => [...prev, updated]);
    setSelectedAquarium(updated);
    setShowCreateForm(false);
    setCreateForm({ name: '', volumeLiters: 60, description: '' });
    setInfoMessage('Аквариум создан');
    setIsBusy(false);
  };

  const submitAddFish = async () => {
    if (!selectedAquarium) return;
    if (!fishForm.speciesId) {
      handleApiError('Выберите вид для добавления');
      return;
    }
    setIsBusy(true);
    clearMessages();
    const response = await addFishRequest(selectedAquarium.id, {
      speciesId: fishForm.speciesId,
      quantity: Number(fishForm.quantity),
      sizeClass: fishForm.sizeClass,
    });
    if (response.error || !response.data) {
      handleApiError(response.error ?? 'Не удалось добавить вид в состав');
      setIsBusy(false);
      return;
    }
    const updated = response.data.aquarium;
    setSelectedAquarium(updated);
    setAquariums((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setShowAddFishForm(false);
    setFishForm({ speciesId: '', quantity: 1, sizeClass: 'medium' });
    setIsBusy(false);
  };

  const removeFish = async (stockId: string) => {
    if (!selectedAquarium) return;
    setIsBusy(true);
    clearMessages();
    const response = await removeFishRequest(selectedAquarium.id, stockId);
    if (response.error || !response.data) {
      handleApiError(response.error ?? 'Не удалось удалить вид');
      setIsBusy(false);
      return;
    }
    const updated = response.data.aquarium;
    setSelectedAquarium(updated);
    setAquariums((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setIsBusy(false);
  };

  const updateFishQuantity = async (stockId: string, quantity: number) => {
    if (!selectedAquarium) return;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      handleApiError('Количество должно быть положительным числом');
      return;
    }
    setIsBusy(true);
    clearMessages();
    const response = await updateFishQuantityRequest(selectedAquarium.id, stockId, quantity);
    if (response.error || !response.data) {
      handleApiError(response.error ?? 'Не удалось обновить количество');
      setIsBusy(false);
      return;
    }
    const updated = response.data.aquarium;
    setSelectedAquarium(updated);
    setAquariums((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setIsBusy(false);
  };

  const completeTask = async (task: CareTaskDTO) => {
    if (!selectedAquarium) return;
    if (task.requiresMeasurement && task.parameters?.length) {
      setTaskCompletion({
        task,
        values: Object.fromEntries(
          task.parameters.map((parameter) => [parameter.parameter, parameter.value.toString()]),
        ),
      });
      return;
    }

    setIsBusy(true);
    clearMessages();
    const response = await completeTaskRequest(selectedAquarium.id, task.id);
    if (response.error || !response.data) {
      handleApiError(response.error ?? 'Не удалось отметить выполнение задачи');
      setIsBusy(false);
      return;
    }
    await openAquarium(selectedAquarium.id);
    setIsBusy(false);
  };

  const submitTaskCompletion = async () => {
    if (!selectedAquarium || !taskCompletion) return;
    const parsedValues = Object.fromEntries(
      Object.entries(taskCompletion.values).map(([key, value]) => [key, Number(value)]),
    );
    setIsBusy(true);
    clearMessages();
    const response = await completeTaskRequest(
      selectedAquarium.id,
      taskCompletion.task.id,
      parsedValues,
    );
    if (response.error || !response.data) {
      handleApiError(response.error ?? 'Не удалось сохранить показания');
      setIsBusy(false);
      return;
    }
    setTaskCompletion(null);
    await openAquarium(selectedAquarium.id);
    setIsBusy(false);
  };

  const handleSettingsSave = async () => {
    setIsBusy(true);
    clearMessages();
    const response = await updateNotificationSettingsRequest(settings);
    if (response.error || !response.data) {
      handleApiError(response.error ?? 'Не удалось сохранить настройки уведомлений');
      setIsBusy(false);
      return;
    }
    setSettings(response.data.settings);
    setShowSettings(false);
    setInfoMessage('Настройки уведомлений обновлены');
    setIsBusy(false);
  };

  const requestUpgrade = async () => {
    setIsBusy(true);
    clearMessages();
    const response = await upgradeSubscriptionRequest({ months: 1, aquariumLimit: 5 });
    if (response.error || !response.data) {
      handleApiError(response.error ?? 'Не удалось обновить тариф');
      setIsBusy(false);
      return;
    }
    const refreshed = await fetchSubscription();
    if (!refreshed.error && refreshed.data && user) {
      setUser({ ...user, subscription: refreshed.data.subscription });
    }
    setInfoMessage('Тариф обновлен — можно создать дополнительные аквариумы');
    setIsBusy(false);
  };

  const subscriptionUsage = useMemo(() => {
    if (!user) return null;
    return `${aquariums.length} / ${user.subscription.aquariumLimit}`;
  }, [aquariums.length, user]);

  const compatibilityWarnings = useMemo(() => {
    if (!selectedAquarium) return [] as string[];
    return selectedAquarium.warnings.map((warning) => {
      const speciesA = selectedAquarium.species.find((item) => item.speciesId === warning.speciesAId);
      const speciesB = selectedAquarium.species.find((item) => item.speciesId === warning.speciesBId);
      const nameA = speciesA?.commonName ?? warning.speciesAId;
      const nameB = speciesB?.commonName ?? warning.speciesBId;
      return `${nameA} и ${nameB}: ${warning.message}`;
    });
  }, [selectedAquarium]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl bg-white px-10 py-8 shadow-xl">
          <p className="text-lg font-semibold text-slate-700">Загружаем ваши аквариумы…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        authMode={authMode}
        setAuthMode={setAuthMode}
        onLogin={handleLogin}
        onRegister={handleRegister}
        error={error}
        isBusy={isBusy}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Aquaria Guardian</h1>
            <p className="text-sm text-slate-500">Прозрачный контроль перенаселения и плана ухода</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-700">{user.email}</p>
              <p className="text-xs text-slate-500">
                Тариф: {user.subscription.plan === 'free' ? 'Free' : 'Premium'} • {subscriptionUsage ?? ''}
              </p>
            </div>
            <button
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800"
              onClick={() => setShowSettings(true)}
            >
              Уведомления
            </button>
            <button
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900"
              onClick={handleLogout}
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl gap-6 px-6 py-6 md:grid md:grid-cols-[320px_1fr]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Мои аквариумы</h2>
              <button
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
                onClick={() => setShowCreateForm((prev) => !prev)}
              >
                {showCreateForm ? 'Скрыть' : 'Создать'}
              </button>
            </div>
            <p className="text-xs text-slate-500">Доступно на тарифе: {subscriptionUsage ?? ''}</p>
            {showCreateForm && (
              <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  placeholder="Название"
                  value={createForm.name}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                />
                <input
                  type="number"
                  min={10}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  placeholder="Объем (л)"
                  value={createForm.volumeLiters}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, volumeLiters: Number(event.target.value) }))
                  }
                />
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  placeholder="Описание (необязательно)"
                  value={createForm.description}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={2}
                />
                <button
                  className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={isBusy}
                  onClick={submitCreateAquarium}
                >
                  Создать аквариум
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {aquariums.map((aquarium) => (
              <button
                key={aquarium.id}
                onClick={() => openAquarium(aquarium.id)}
                className={cn(
                  'w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all',
                  cardShadow,
                  selectedAquarium?.id === aquarium.id ? 'border-slate-400 shadow-md' : '',
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-800">{aquarium.name}</h3>
                    <p className="text-xs text-slate-500">{aquarium.volumeLiters} литров</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">{formatRelative(aquarium.updatedAt)}</p>
                    <span className={cn('mt-1 inline-flex items-center rounded-full px-2 py-1 text-xs font-medium', statusCopy[aquarium.status].tone)}>
                      {statusCopy[aquarium.status].title}
                    </span>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div
                      className={cn('h-2 rounded-full',
                        aquarium.status === 'comfort'
                          ? 'bg-emerald-400'
                          : aquarium.status === 'elevated'
                            ? 'bg-amber-400'
                            : 'bg-rose-500')}
                      style={{ width: `${Math.min(120, aquarium.bioLoadPercentage)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Биозагрузка {aquarium.bioLoadPercentage}% (нужно {aquarium.requiredVolumeLiters} л)
                  </p>
                </div>
              </button>
            ))}
            {aquariums.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                Создайте первый аквариум, чтобы увидеть план ухода и рекомендации.
              </div>
            )}
          </div>

          {user.subscription.plan === 'free' && aquariums.length >= user.subscription.aquariumLimit && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
              <h3 className="text-sm font-semibold text-indigo-800">Лимит бесплатного тарифа достигнут</h3>
              <p className="mt-2 text-xs text-indigo-700">
                Вы можете управлять одним аквариумом бесплатно. Оформите премиум, чтобы добавить больше банок и получить расширенный анализ.
              </p>
              <button
                className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                onClick={requestUpgrade}
                disabled={isBusy}
              >
                Перейти на премиум
              </button>
            </div>
          )}
        </section>

        <section className="space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error.context ? <strong className="font-semibold">{error.context}: </strong> : null}
              {error.message}
            </div>
          )}
          {infoMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {infoMessage}
            </div>
          )}
          {selectedAquarium ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-800">{selectedAquarium.name}</h2>
                    <p className="text-sm text-slate-500">Объем {selectedAquarium.volumeLiters} литров</p>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
                      statusCopy[selectedAquarium.status].tone,
                    )}
                  >
                    {statusCopy[selectedAquarium.status].title}
                  </span>
                </div>
                <p className="mt-4 text-sm text-slate-600">{statusComment(selectedAquarium)}</p>
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-slate-700">Совместимость</h3>
                  <p className="text-sm text-slate-600">{compatibilityCopy[selectedAquarium.compatibilityStatus]}</p>
                  {compatibilityWarnings.length > 0 && (
                    <ul className="mt-2 space-y-2 text-sm text-rose-600">
                      {compatibilityWarnings.map((warning) => (
                        <li key={warning} className="rounded-lg bg-rose-50 px-3 py-2">
                          {warning}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-800">Состав аквариума</h3>
                  <button
                    className="text-sm font-medium text-slate-600 hover:text-slate-900"
                    onClick={() => setShowAddFishForm((prev) => !prev)}
                  >
                    {showAddFishForm ? 'Скрыть' : 'Добавить вид'}
                  </button>
                </div>

                {showAddFishForm && (
                  <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <select
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                      value={fishForm.speciesId}
                      onChange={(event) =>
                        setFishForm((prev) => ({ ...prev, speciesId: event.target.value }))
                      }
                    >
                      <option value="">Выберите вид</option>
                      {fishCatalog.map((fish) => (
                        <option key={fish.id} value={fish.id}>
                          {fish.commonName} ({behaviorCopy[fish.behavior]})
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-3">
                      <input
                        type="number"
                        min={1}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                        value={fishForm.quantity}
                        onChange={(event) =>
                          setFishForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))
                        }
                      />
                      <select
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                        value={fishForm.sizeClass}
                        onChange={(event) =>
                          setFishForm((prev) => ({ ...prev, sizeClass: event.target.value as typeof fishForm.sizeClass }))
                        }
                      >
                        <option value="juvenile">Молодняк</option>
                        <option value="medium">Средняя</option>
                        <option value="large">Крупная</option>
                      </select>
                    </div>
                    <button
                      className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
                      onClick={submitAddFish}
                      disabled={isBusy}
                    >
                      Добавить
                    </button>
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  {selectedAquarium.species.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{item.commonName}</p>
                        <p className="text-xs text-slate-500">{item.scientificName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {behaviorCopy[item.behavior]} • Рекомендовано {item.recommendedVolumePerFish} л на особь
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          key={`${item.id}-${item.quantity}`}
                          type="number"
                          min={1}
                          className="w-24 rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
                          defaultValue={item.quantity}
                          onBlur={(event) => updateFishQuantity(item.id, Number(event.target.value))}
                        />
                        <button
                          className="text-sm font-medium text-rose-600 hover:text-rose-800"
                          onClick={() => removeFish(item.id)}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                  {selectedAquarium.species.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                      Состав пока пустой. Добавьте первой рыбы, чтобы увидеть расчеты.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-800">План ухода</h3>
                  <p className="text-xs text-slate-500">
                    Последний пересчет: {formatDate(selectedAquarium.lastCalculatedAt)}
                  </p>
                </div>
                <div className="mt-4 space-y-3">
                  {[...selectedAquarium.careTasks]
                    .sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime())
                    .map((task) => (
                      <div
                        key={task.id}
                        className={cn(
                          'rounded-xl px-4 py-3 text-sm',
                          taskStatusTone[task.status],
                        )}
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-semibold">{task.title}</p>
                            <p className="text-xs opacity-80">{task.description}</p>
                            <p className="mt-1 text-xs">
                              Следующий раз: {formatDate(task.nextDueAt)} ({formatRelative(task.nextDueAt)})
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="rounded-full bg-white/40 px-2 py-1 text-xs font-medium">
                              {friendlyTaskStatus[task.status]}
                            </span>
                            <button
                              className="rounded-lg bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
                              disabled={isBusy}
                              onClick={() => completeTask(task)}
                            >
                              Отметить выполненной
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  {selectedAquarium.careTasks.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                      Задачи появятся после добавления рыб в аквариум.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              Выберите аквариум слева, чтобы увидеть подробности по биозагрузке, совместимости и уходу.
            </div>
          )}
        </section>
      </main>

      {showSettings && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/50 px-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">Настройки уведомлений</h3>
            <p className="text-sm text-slate-500">
              Выберите удобный канал и время получения напоминаний. Настройки применяются ко всем аквариумам.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">Канал</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  value={settings.channel}
                  onChange={(event) => setSettings((prev) => ({ ...prev, channel: event.target.value as NotificationSettingsDTO['channel'] }))}
                >
                  <option value="email">Email</option>
                  <option value="push">Push</option>
                  <option value="off">Отключены</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">Время напоминаний</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  value={settings.preferredTime}
                  onChange={(event) =>
                    setSettings((prev) => ({ ...prev, preferredTime: event.target.value as NotificationSettingsDTO['preferredTime'] }))
                  }
                >
                  <option value="morning">Утро</option>
                  <option value="evening">Вечер</option>
                  <option value="any">В любое время</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={settings.muteFeedingReminders ?? false}
                    onChange={(event) =>
                      setSettings((prev) => ({ ...prev, muteFeedingReminders: event.target.checked }))
                    }
                  />
                  Отключить напоминания о кормлении
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
                onClick={() => setShowSettings(false)}
              >
                Отмена
              </button>
              <button
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                onClick={handleSettingsSave}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {taskCompletion && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/60 px-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">Введите результаты теста</h3>
            <p className="text-sm text-slate-500">Задача: {taskCompletion.task.title}</p>
            <div className="mt-4 space-y-3">
              {Object.entries(taskCompletion.values).map(([key, value]) => (
                <div key={key}>
                  <label className="text-xs font-semibold uppercase text-slate-500">{key}</label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                    value={value}
                    onChange={(event) =>
                      setTaskCompletion((prev) =>
                        prev
                          ? {
                              ...prev,
                              values: { ...prev.values, [key]: event.target.value },
                            }
                          : null,
                      )
                    }
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
                onClick={() => setTaskCompletion(null)}
              >
                Отмена
              </button>
              <button
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                onClick={submitTaskCompletion}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface AuthScreenProps {
  authMode: 'login' | 'register';
  setAuthMode: (mode: 'login' | 'register') => void;
  onLogin: (payload: { email: string; password: string }) => void;
  onRegister: (payload: { email: string; password: string; displayName?: string }) => void;
  error: ErrorState | null;
  isBusy: boolean;
}

const AuthScreen = ({ authMode, setAuthMode, onLogin, onRegister, error, isBusy }: AuthScreenProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const submit = () => {
    if (authMode === 'login') {
      onLogin({ email, password });
    } else {
      onRegister({ email, password, displayName: displayName || undefined });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-slate-800">Aquaria Guardian</h1>
        <p className="mt-1 text-sm text-slate-500">
          Управляйте переноселением, совместимостью и уходом за аквариумом в одном окне.
        </p>
        <div className="mt-6 space-y-4">
          <input
            type="email"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            type="password"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            placeholder="Пароль"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {authMode === 'register' && (
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="Имя (необязательно)"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          )}
          <button
            className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            onClick={submit}
            disabled={isBusy}
          >
            {authMode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </div>
        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error.message}
          </div>
        )}
        <div className="mt-6 text-center text-sm text-slate-500">
          {authMode === 'login' ? 'Еще нет аккаунта?' : 'Уже зарегистрированы?'}{' '}
          <button
            className="font-semibold text-slate-700 hover:text-slate-900"
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
          >
            {authMode === 'login' ? 'Создать' : 'Войти'}
          </button>
        </div>
      </div>
    </div>
  );
};
