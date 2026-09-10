import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';
import { TextField } from '../components/ui/TextField';
import { api, apiError } from '../lib/api';
import { formatDuration, formatPrice, minutesToHHMM, weekdayLabel } from '../lib/format';
import type { Professional, Service, WorkingHours } from '../types';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const serviceSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  durationMinutes: z.coerce.number().int().min(5, 'Min 5 min').max(1440),
  priceEuros: z.coerce.number().min(0).max(100000),
});
type ServiceForm = z.infer<typeof serviceSchema>;

const hhmmToMinutes = (v: string): number => {
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
};

interface DayRow {
  weekday: number;
  enabled: boolean;
  start: string;
  end: string;
}

function buildDayRows(hours: WorkingHours[]): DayRow[] {
  return WEEK_ORDER.map((weekday) => {
    const entries = hours.filter((h) => h.weekday === weekday);
    if (entries.length === 0) {
      return { weekday, enabled: false, start: '09:00', end: '18:00' };
    }
    const start = Math.min(...entries.map((e) => e.startMinute));
    const end = Math.max(...entries.map((e) => e.endMinute));
    return { weekday, enabled: true, start: minutesToHHMM(start), end: minutesToHHMM(end) };
  });
}

function CreateProfileForm() {
  const queryClient = useQueryClient();
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => api.post('/professionals', { businessName, timezone: 'Europe/Paris' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-professional'] }),
    onError: (e) => setError(apiError(e).message),
  });
  return (
    <form
      className="card max-w-md space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <h2 className="text-lg font-semibold">Créer mon profil professionnel</h2>
      {error && <Alert variant="error">{error}</Alert>}
      <TextField
        label="Nom de l'établissement"
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
        required
      />
      <button type="submit" className="btn-primary" disabled={create.isPending || !businessName}>
        {create.isPending ? 'Création…' : 'Créer mon profil'}
      </button>
    </form>
  );
}

function ServicesSection({ professional }: { professional: Professional }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ServiceForm>({ resolver: zodResolver(serviceSchema) });

  const addService = useMutation({
    mutationFn: (data: ServiceForm) =>
      api.post(`/professionals/${professional.id}/services`, {
        name: data.name,
        durationMinutes: data.durationMinutes,
        priceCents: Math.round(data.priceEuros * 100),
      }),
    onSuccess: () => {
      reset();
      queryClient.invalidateQueries({ queryKey: ['my-professional'] });
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.delete(`/services/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-professional'] }),
  });

  const reactivate = useMutation({
    mutationFn: (id: string) => api.patch(`/services/${id}`, { isActive: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-professional'] }),
  });

  return (
    <section aria-labelledby="services-title" className="space-y-4">
      <h2 id="services-title" className="text-lg font-semibold">
        Prestations
      </h2>

      <ul className="space-y-2">
        {professional.services.length === 0 && (
          <li className="text-sm text-slate-500">Aucune prestation pour le moment.</li>
        )}
        {professional.services.map((s: Service) => (
          <li key={s.id} className="card flex items-center justify-between">
            <div>
              <p className="font-medium">
                {s.name} {!s.isActive && <span className="text-xs text-slate-400">(inactive)</span>}
              </p>
              <p className="text-sm text-slate-500">
                {formatDuration(s.durationMinutes)} · {formatPrice(s.priceCents)}
              </p>
            </div>
            {s.isActive ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => deactivate.mutate(s.id)}
                disabled={deactivate.isPending}
              >
                Désactiver
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={() => reactivate.mutate(s.id)}
                disabled={reactivate.isPending}
              >
                Réactiver
              </button>
            )}
          </li>
        ))}
      </ul>

      <form
        className="card grid gap-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
        onSubmit={handleSubmit((d) => addService.mutate(d))}
      >
        <TextField label="Nouvelle prestation" {...register('name')} error={errors.name?.message} />
        <TextField
          label="Durée (min)"
          type="number"
          {...register('durationMinutes')}
          error={errors.durationMinutes?.message}
        />
        <TextField
          label="Prix (€)"
          type="number"
          step="0.01"
          {...register('priceEuros')}
          error={errors.priceEuros?.message}
        />
        <button type="submit" className="btn-primary" disabled={isSubmitting || addService.isPending}>
          Ajouter
        </button>
      </form>
    </section>
  );
}

function WorkingHoursSection({ professional }: { professional: Professional }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<DayRow[]>(() => buildDayRows(professional.workingHours));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setRows(buildDayRows(professional.workingHours));
  }, [professional.workingHours]);

  const save = useMutation({
    mutationFn: () =>
      api.put(`/professionals/${professional.id}/working-hours`, {
        hours: rows
          .filter((r) => r.enabled)
          .map((r) => ({
            weekday: r.weekday,
            startMinute: hhmmToMinutes(r.start),
            endMinute: hhmmToMinutes(r.end),
          })),
      }),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['my-professional'] });
    },
  });

  const update = (weekday: number, patch: Partial<DayRow>) =>
    setRows((prev) => prev.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));

  return (
    <section aria-labelledby="hours-title" className="space-y-4">
      <h2 id="hours-title" className="text-lg font-semibold">
        Horaires d'ouverture
      </h2>
      <p className="text-sm text-slate-500">
        Une plage horaire par jour. Les pauses (déjeuner) et congés se gèrent via l'API / les
        indisponibilités.
      </p>
      <div className="card space-y-2">
        {rows.map((row) => (
          <div key={row.weekday} className="flex flex-wrap items-center gap-3">
            <label className="flex w-40 items-center gap-2">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(e) => update(row.weekday, { enabled: e.target.checked })}
              />
              <span>{weekdayLabel(row.weekday)}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="sr-only">Début {weekdayLabel(row.weekday)}</span>
              <input
                type="time"
                className="input w-32"
                value={row.start}
                disabled={!row.enabled}
                onChange={(e) => update(row.weekday, { start: e.target.value })}
              />
            </label>
            <span aria-hidden="true">→</span>
            <label className="flex items-center gap-2 text-sm">
              <span className="sr-only">Fin {weekdayLabel(row.weekday)}</span>
              <input
                type="time"
                className="input w-32"
                value={row.end}
                disabled={!row.enabled}
                onChange={(e) => update(row.weekday, { end: e.target.value })}
              />
            </label>
          </div>
        ))}
        <div className="pt-2">
          <button type="button" className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Enregistrement…' : 'Enregistrer les horaires'}
          </button>
          {saved && !save.isPending && (
            <span role="status" className="ml-3 text-sm text-green-700">
              Horaires enregistrés.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

export function ProSettingsPage() {
  const profileQuery = useQuery({
    queryKey: ['my-professional'],
    retry: false,
    queryFn: async () => {
      try {
        return (await api.get<Professional>('/professionals/me')).data;
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 404) return null;
        throw e;
      }
    },
  });

  if (profileQuery.isLoading) return <Spinner label="Chargement…" />;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Mes prestations & disponibilités</h1>
      {profileQuery.data ? (
        <>
          <ServicesSection professional={profileQuery.data} />
          <WorkingHoursSection professional={profileQuery.data} />
        </>
      ) : (
        <CreateProfileForm />
      )}
    </div>
  );
}
