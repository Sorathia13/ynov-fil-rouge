import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';
import { api, apiError } from '../lib/api';
import { formatPrice, formatDuration, formatTime } from '../lib/format';
import type { Appointment, Paginated, Professional, Slot } from '../types';

function tomorrowISODate(): string {
  const d = new Date(Date.now() + 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function BookingPage() {
  const queryClient = useQueryClient();
  const [professionalId, setProfessionalId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(tomorrowISODate());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [alternatives, setAlternatives] = useState<Slot[]>([]);

  const prosQuery = useQuery({
    queryKey: ['professionals'],
    queryFn: async () => (await api.get<Paginated<Professional>>('/professionals')).data,
  });

  const professional = useMemo(
    () => prosQuery.data?.items.find((p) => p.id === professionalId),
    [prosQuery.data, professionalId],
  );
  const services = professional?.services.filter((s) => s.isActive) ?? [];
  const service = services.find((s) => s.id === serviceId);

  const slotsQuery = useQuery({
    queryKey: ['slots', professionalId, serviceId, date],
    enabled: Boolean(professionalId && serviceId && date),
    queryFn: async () => {
      const from = new Date(`${date}T00:00:00`);
      const to = new Date(`${date}T23:59:59`);
      const res = await api.get<Slot[]>('/appointments/slots', {
        params: { professionalId, serviceId, from: from.toISOString(), to: to.toISOString() },
      });
      return res.data;
    },
  });

  const booking = useMutation({
    mutationFn: async (startAt: string) =>
      (await api.post<Appointment>('/appointments', { professionalId, serviceId, startAt })).data,
    onSuccess: () => {
      setFeedback({ type: 'success', message: 'Votre rendez-vous a bien été réservé. Il est en attente de confirmation.' });
      setSelectedSlot(null);
      setAlternatives([]);
      void queryClient.invalidateQueries({ queryKey: ['slots', professionalId, serviceId, date] });
      void queryClient.invalidateQueries({ queryKey: ['my-appointments'] });
    },
    onError: (error) => {
      const { message, code, details } = apiError(error);
      setFeedback({ type: 'error', message });
      if (code === 'SLOT_UNAVAILABLE' && details && typeof details === 'object' && 'alternatives' in details) {
        setAlternatives((details as { alternatives: Slot[] }).alternatives ?? []);
      }
    },
  });

  const slots = slotsQuery.data ?? [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Réserver un rendez-vous</h1>

      {feedback && (
        <div className="mb-6">
          <Alert variant={feedback.type === 'success' ? 'success' : 'error'}>{feedback.message}</Alert>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        {/* Selection panel */}
        <div className="card space-y-4">
          <div>
            <label className="label" htmlFor="pro">
              Professionnel
            </label>
            <select
              id="pro"
              className="input"
              value={professionalId}
              onChange={(e) => {
                setProfessionalId(e.target.value);
                setServiceId('');
                setSelectedSlot(null);
              }}
            >
              <option value="">— Choisir —</option>
              {prosQuery.data?.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.businessName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="service">
              Prestation
            </label>
            <select
              id="service"
              className="input"
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                setSelectedSlot(null);
              }}
              disabled={!professional}
            >
              <option value="">— Choisir —</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatDuration(s.durationMinutes)} · {formatPrice(s.priceCents)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="date">
              Date
            </label>
            <input
              id="date"
              type="date"
              className="input"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => {
                setDate(e.target.value);
                setSelectedSlot(null);
              }}
            />
          </div>

          {service && (
            <p className="text-sm text-slate-600">
              Durée : {formatDuration(service.durationMinutes)} — Prix : {formatPrice(service.priceCents)}
            </p>
          )}
        </div>

        {/* Slots panel */}
        <section aria-labelledby="slots-title" className="card">
          <h2 id="slots-title" className="mb-4 text-lg font-semibold">
            Créneaux disponibles
          </h2>

          {!professionalId || !serviceId ? (
            <p className="text-slate-500">Sélectionnez un professionnel et une prestation.</p>
          ) : slotsQuery.isLoading ? (
            <Spinner label="Recherche des créneaux…" />
          ) : slotsQuery.isError ? (
            <Alert variant="error">Impossible de charger les créneaux.</Alert>
          ) : slots.length === 0 ? (
            <Alert variant="warning">Aucun créneau disponible ce jour-là. Essayez une autre date.</Alert>
          ) : (
            <>
              <p className="sr-only" role="status">
                {slots.length} créneaux disponibles
              </p>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => (
                  <li key={slot.start}>
                    <button
                      type="button"
                      aria-pressed={selectedSlot === slot.start}
                      onClick={() => setSelectedSlot(slot.start)}
                      className={clsx(
                        'w-full rounded-lg border px-2 py-2 text-sm transition',
                        selectedSlot === slot.start
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-slate-300 bg-white hover:border-brand-600',
                      )}
                    >
                      {formatTime(slot.start)}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {selectedSlot && (
            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
              <p className="text-sm">
                Créneau sélectionné : <strong>{formatTime(selectedSlot)}</strong>
              </p>
              <button
                type="button"
                className="btn-primary"
                disabled={booking.isPending}
                onClick={() => booking.mutate(selectedSlot)}
              >
                {booking.isPending ? 'Réservation…' : 'Confirmer la réservation'}
              </button>
            </div>
          )}

          {alternatives.length > 0 && (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <h3 className="mb-2 text-sm font-semibold">Créneaux alternatifs proposés</h3>
              <ul className="flex flex-wrap gap-2">
                {alternatives.map((alt) => (
                  <li key={alt.start}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setSelectedSlot(alt.start);
                        setAlternatives([]);
                        setFeedback(null);
                      }}
                    >
                      {formatTime(alt.start)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
