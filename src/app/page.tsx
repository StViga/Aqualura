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
  loginWithGoogle,
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
    tone: 'status-badge status-badge--comfort',
  },
  elevated: {
    title: 'Повышенная нагрузка',
    tone: 'status-badge status-badge--elevated',
  },
  critical: {
    title: 'Критическая нагрузка',
    tone: 'status-badge status-badge--critical',
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
  active: 'task-card task-card--active',
  completed: 'task-card task-card--completed',
  overdue: 'task-card task-card--overdue',
};

const friendlyTaskStatus: Record<CareTaskDTO['status'], string> = {
  active: 'Активна',
  completed: 'Выполнена',
  overdue: 'Просрочена',
};

const bioLoadMeterTone: Record<AquariumDTO['status'], string> = {
  comfort: 'progress-meter progress-meter--comfort',
  elevated: 'progress-meter progress-meter--elevated',
  critical: 'progress-meter progress-meter--critical',
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

const cardShadow = 'transition-transform duration-200 hover:-translate-y-[2px]';

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

  const handleGoogleLogin = async () => {
    setIsBusy(true);
    clearMessages();
    const response = await loginWithGoogle();
    if (response.error) {
      handleApiError(response.error, 'google');
      setIsBusy(false);
      return;
    }
    // После успешного редиректа Supabase обновит сессию и loadInitial подтянет профиль
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="glass-panel px-10 py-8 text-primary">
          <p className="text-lg font-semibold text-primary-strong">Загружаем ваши аквариумы…</p>
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
        onGoogleLogin={handleGoogleLogin}
        error={error}
        isBusy={isBusy}
      />
    );
  }

  return (
    <div className="min-h-screen text-primary">
      <header className="header-glass sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold text-primary-strong">Aquaria Guardian</h1>
            <p className="text-sm text-muted">Прозрачный контроль перенаселения и плана ухода</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-primary-strong">{user.email}</p>
              <p className="text-xs text-soft">
                Тариф: {user.subscription.plan === 'free' ? 'Free' : 'Premium'} • {subscriptionUsage ?? ''}
              </p>
            </div>
            <button className="button-secondary" onClick={() => setShowSettings(true)}>
              Уведомления
            </button>
            <button className="button-ghost" onClick={handleLogout}>
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl gap-6 px-6 py-6 md:grid md:grid-cols-[320px_1fr]">
        <section className="space-y-4">
          <div className="glass-panel p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-primary-strong">Мои аквариумы</h2>
              <button
                className="text-sm font-medium text-accent transition-colors hover:text-accent"
                onClick={() => setShowCreateForm((prev) => !prev)}
              >
                {showCreateForm ? 'Скрыть' : 'Создать'}
              </button>
            </div>
            <p className="text-xs text-soft">Доступно на тарифе: {subscriptionUsage ?? ''}</p>
            {showCreateForm && (
              <div className="glass-panel-muted mt-4 space-y-3 border border-transparent p-3">
                <input
                  className="input-field w-full"
                  placeholder="Название"
                  value={createForm.name}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                />
                <input
                  type="number"
                  min={10}
                  className="input-field w-full"
                  placeholder="Объем (л)"
                  value={createForm.volumeLiters}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, volumeLiters: Number(event.target.value) }))
                  }
                />
                <textarea
                  className="input-field w-full"
                  placeholder="Описание (необязательно)"
                  value={createForm.description}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={2}
                />
                <button className="button-primary w-full" disabled={isBusy} onClick={submitCreateAquarium}>
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
                  'w-full glass-panel-muted border border-transparent p-4 text-left transition-all',
                  cardShadow,
                  selectedAquarium?.id === aquarium.id ? 'panel-selected' : '',
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-primary-strong">{aquarium.name}</h3>
                    <p className="text-xs text-soft">{aquarium.volumeLiters} литров</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-soft">{formatRelative(aquarium.updatedAt)}</p>
                    <span className={cn('mt-1', statusCopy[aquarium.status].tone)}>
                      {statusCopy[aquarium.status].title}
                    </span>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="progress-track">
                    <div
                      className={cn(bioLoadMeterTone[aquarium.status])}
                      style={{ width: `${Math.min(120, aquarium.bioLoadPercentage)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-soft">
                    Биозагрузка {aquarium.bioLoadPercentage}% (нужно {aquarium.requiredVolumeLiters} л)
                  </p>
                </div>
              </button>
            ))}
            {aquariums.length === 0 && (
              <div className="glass-panel-dashed p-6 text-center text-sm">
                Создайте первый аквариум, чтобы увидеть план ухода и рекомендации.
              </div>
            )}
          </div>

          {user.subscription.plan === 'free' && aquariums.length >= user.subscription.aquariumLimit && (
            <div className="glass-panel border border-transparent p-4">
              <h3 className="text-sm font-semibold text-primary-strong">Лимит бесплатного тарифа достигнут</h3>
              <p className="mt-2 text-xs text-muted">
                Управлять одним аквариумом можно бесплатно. Оформите премиум, чтобы подключить дополнительные банки и расширенный анализ.
              </p>
              <button className="button-primary mt-3 w-full" onClick={requestUpgrade} disabled={isBusy}>
                Перейти на премиум
              </button>
            </div>
          )}
        </section>

        <section className="space-y-4">
          {error && (
            <div className="glass-panel-muted border border-rose-400/40 p-3 text-sm text-primary">
              {error.context ? <strong className="font-semibold text-primary-strong">{error.context}: </strong> : null}
              {error.message}
            </div>
          )}
          {infoMessage && (
            <div className="glass-panel-muted border border-emerald-400/35 p-3 text-sm text-primary">
              {infoMessage}
            </div>
          )}
          {selectedAquarium ? (
            <div className="space-y-6">
              <div className="glass-panel border border-transparent p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-primary-strong">{selectedAquarium.name}</h2>
                    <p className="text-sm text-soft">Объем {selectedAquarium.volumeLiters} литров</p>
                  </div>
                  <span className={statusCopy[selectedAquarium.status].tone}>
                    {statusCopy[selectedAquarium.status].title}
                  </span>
                </div>
                <p className="mt-4 text-sm text-muted">{statusComment(selectedAquarium)}</p>
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-primary-strong">Совместимость</h3>
                  <p className="text-sm text-muted">{compatibilityCopy[selectedAquarium.compatibilityStatus]}</p>
                  {compatibilityWarnings.length > 0 && (
                    <ul className="mt-2 space-y-2 text-sm text-primary">
                      {compatibilityWarnings.map((warning) => (
                        <li key={warning} className="glass-panel-muted border border-rose-400/25 px-3 py-2">
                          {warning}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="glass-panel border border-transparent p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-primary-strong">Состав аквариума</h3>
                  <button
                    className="text-sm font-medium text-accent hover:text-accent"
                    onClick={() => setShowAddFishForm((prev) => !prev)}
                  >
                    {showAddFishForm ? 'Скрыть' : 'Добавить вид'}
                  </button>
                </div>

                {showAddFishForm && (
                  <div className="glass-panel-muted mt-4 space-y-3 border border-transparent p-4">
                    <select
                      className="input-field w-full"
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
                        className="input-field w-full"
                        value={fishForm.quantity}
                        onChange={(event) =>
                          setFishForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))
                        }
                      />
                      <select
                        className="input-field w-full"
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
                    <button className="button-primary w-full" onClick={submitAddFish} disabled={isBusy}>
                      Добавить
                    </button>
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  {selectedAquarium.species.map((item) => (
                    <div
                      key={item.id}
                      className="glass-panel-muted flex flex-col gap-3 border border-transparent p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-primary-strong">{item.commonName}</p>
                        <p className="text-xs text-soft">{item.scientificName}</p>
                        <p className="mt-1 text-xs text-soft">
                          {behaviorCopy[item.behavior]} • Рекомендовано {item.recommendedVolumePerFish} л на особь
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          key={`${item.id}-${item.quantity}`}
                          type="number"
                          min={1}
                          className="input-field !w-24 text-center"
                          defaultValue={item.quantity}
                          onBlur={(event) => updateFishQuantity(item.id, Number(event.target.value))}
                        />
                        <button
                          className="text-sm font-medium text-rose-300 hover:text-rose-200"
                          onClick={() => removeFish(item.id)}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                  {selectedAquarium.species.length === 0 && (
                    <div className="glass-panel-dashed p-4 text-center text-sm">
                      Состав пока пустой. Добавьте первой рыбы, чтобы увидеть расчеты.
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-panel border border-transparent p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-primary-strong">План ухода</h3>
                  <p className="text-xs text-soft">
                    Последний пересчет: {formatDate(selectedAquarium.lastCalculatedAt)}
                  </p>
                </div>
                <div className="mt-4 space-y-3">
                  {[...selectedAquarium.careTasks]
                    .sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime())
                    .map((task) => (
                      <div key={task.id} className={cn(taskStatusTone[task.status], 'text-sm')}>
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-semibold">{task.title}</p>
                            <p className="text-xs text-soft">{task.description}</p>
                            <p className="mt-1 text-xs">
                              Следующий раз: {formatDate(task.nextDueAt)} ({formatRelative(task.nextDueAt)})
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="task-status-chip">
                              {friendlyTaskStatus[task.status]}
                            </span>
                            <button
                              className="button-secondary text-xs font-semibold"
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
                    <div className="glass-panel-dashed p-4 text-center text-sm">
                      Задачи появятся после добавления рыб в аквариум.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel-dashed p-10 text-center text-soft">
              Выберите аквариум слева, чтобы увидеть подробности по биозагрузке, совместимости и уходу.
            </div>
          )}
        </section>
      </main>

      {showSettings && (
        <div className="modal-overlay fixed inset-0 z-20 flex items-center justify-center px-6">
          <div className="modal-surface w-full max-w-lg p-6 text-primary">
            <h3 className="text-lg font-semibold text-primary-strong">Настройки уведомлений</h3>
            <p className="text-sm text-muted">
              Выберите удобный канал и время получения напоминаний. Настройки применяются ко всем аквариумам.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-soft">Канал</label>
                <select
                  className="input-field mt-1 w-full"
                  value={settings.channel}
                  onChange={(event) => setSettings((prev) => ({ ...prev, channel: event.target.value as NotificationSettingsDTO['channel'] }))}
                >
                  <option value="email">Email</option>
                  <option value="push">Push</option>
                  <option value="off">Отключены</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-soft">Время напоминаний</label>
                <select
                  className="input-field mt-1 w-full"
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
                <label className="flex items-center gap-2 text-sm text-muted">
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
              <button className="button-secondary" onClick={() => setShowSettings(false)}>
                Отмена
              </button>
              <button className="button-primary" onClick={handleSettingsSave}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {taskCompletion && (
        <div className="modal-overlay fixed inset-0 z-30 flex items-center justify-center px-6">
          <div className="modal-surface w-full max-w-md p-6 text-primary">
            <h3 className="text-lg font-semibold text-primary-strong">Введите результаты теста</h3>
            <p className="text-sm text-muted">Задача: {taskCompletion.task.title}</p>
            <div className="mt-4 space-y-3">
              {Object.entries(taskCompletion.values).map(([key, value]) => (
                <div key={key}>
                  <label className="text-xs font-semibold uppercase text-soft">{key}</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field mt-1 w-full"
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
              <button className="button-secondary" onClick={() => setTaskCompletion(null)}>
                Отмена
              </button>
              <button className="button-primary" onClick={submitTaskCompletion}>
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
  onGoogleLogin: () => void;
  error: ErrorState | null;
  isBusy: boolean;
}

const AuthScreen = ({ authMode, setAuthMode, onLogin, onRegister, onGoogleLogin, error, isBusy }: AuthScreenProps) => {
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
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-md glass-panel px-8 py-9 text-primary">
        <h1 className="text-2xl font-semibold text-primary-strong">Aquaria Guardian</h1>
        <p className="mt-1 text-sm text-muted">
          Прозрачный контроль перенаселения, совместимости и ухода в одном приложении.
        </p>
        <div className="mt-6 space-y-4">
          <input
            type="email"
            className="input-field w-full"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            type="password"
            className="input-field w-full"
            placeholder="Пароль"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {authMode === 'register' && (
            <input
              className="input-field w-full"
              placeholder="Имя (необязательно)"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          )}
          <button className="button-primary w-full" onClick={submit} disabled={isBusy}>
            {authMode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
          <div className="flex items-center gap-3 text-xs text-soft">
            <span className="h-px flex-1 bg-white/10" />
            <span>или</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <button
            className="button-secondary w-full justify-center gap-2"
            onClick={onGoogleLogin}
            disabled={isBusy}
          >
            <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.52 12.272c0-.816-.072-1.632-.216-2.424H12v4.584h6.516a5.57 5.57 0 0 1-2.412 3.66v3.024h3.9c2.28-2.088 3.516-5.172 3.516-8.844"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.964-1.08 7.952-2.952l-3.9-3.024c-1.08.744-2.46 1.188-4.052 1.188-3.108 0-5.736-2.1-6.672-4.932H1.316v3.096C3.336 21.528 7.38 24 12 24"
              />
              <path
                fill="#FBBC05"
                d="M5.328 14.28a6.81 6.81 0 0 1-.36-2.28c0-.792.132-1.56.36-2.28V6.624H1.32A11.94 11.94 0 0 0 0 12c0 1.944.468 3.768 1.32 5.376z"
              />
              <path
                fill="#EA4335"
                d="M12 4.752c1.764 0 3.348.6 4.596 1.776l3.42-3.42C17.964 1.08 15.24 0 12 0 7.38 0 3.336 2.472 1.32 6.624l4.008 3.096C6.264 6.852 8.892 4.752 12 4.752"
              />
            </svg>
            Войти через Google
          </button>
        </div>
        {error && (
          <div className="glass-panel-muted mt-4 border border-rose-400/40 px-4 py-3 text-sm text-primary">
            {error.message}
          </div>
        )}
        <div className="mt-6 text-center text-sm text-muted">
          {authMode === 'login' ? 'Еще нет аккаунта?' : 'Уже зарегистрированы?'}{' '}
          <button
            className="text-primary-strong underline underline-offset-4 transition-colors hover:text-accent"
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
          >
            {authMode === 'login' ? 'Создать' : 'Войти'}
          </button>
        </div>
      </div>
    </div>
  );
};
