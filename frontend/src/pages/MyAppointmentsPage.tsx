import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Alert } from '../components/ui/Alert';
import { StatusBadge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { api, apiError } from '../lib/api';
import { formatDateTime } from '../lib/format';
import type { Appointment, Paginated, Professional, Slot } from '../types';

function ReschedulePanel({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const slotsQuery = useQuery({
    queryKey: ['reschedule-slots', appointment.id, date],
    enabled: Boolean(date),
    queryFn: async () => {
      const from = new Date(`${date}T00:00:00`);
      const to = new Date(`${date}T23:59:59`);
      const res = await api.get<Slot[]>('/appointments/slots', {
        params: {
          professionalId: appointment.professionalId,
          serviceId: appointment.serviceId,
          from: from.toISOString(),
          to: to.toISOString(),
        },
      });
      return res.data;
    },
  });

  const reschedule = useMutation({
    mutationFn: (startAt: string) => api.patch(`/appointments/${appointment.id}/reschedule`, { startAt }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-appointments'] });
      onClose();
    },
    onError: (e) => setError(apiError(e).message),
  });

  const slots = slotsQuery.data ?? [];

  return (
    <div className="mt-3 w-full border-t border-slate-200 pt-3">
      {error && (
        <div className="mb-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium" htmlFor={`date-${appointment.id}`}>
          Nouvelle date
        </label>
        <input
          id={`date-${appointment.id}`}
          type="date"
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          value={date}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => {
            setDate(e.target.value);
            setError(null);
          }}
        />
        <button type="button" className="btn-secondary ml-auto text-sm" onClick={onClose}>
          Fermer
        </button>
      </div>
      {slotsQuery.isLoading ? (
        <Spinner label="Recherche de créneaux…" />
      ) : slots.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun créneau disponible ce jour-là.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {slots.map((s) => (
            <li key={s.start}>
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={reschedule.isPending}
                onClick={() => reschedule.mutate(s.start)}
              >
                {new Date(s.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MyAppointmentsPage() {
  const queryClient = useQueryClient();
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);

  const apptsQuery = useQuery({
    queryKey: ['my-appointments'],
    queryFn: async () => (await api.get<Paginated<Appointment>>('/appointments/me')).data,
  });
  const prosQuery = useQuery({
    queryKey: ['professionals'],
    queryFn: async () => (await api.get<Paginated<Professional>>('/professionals')).data,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/appointments/${id}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-appointments'] }),
  });

  const proName = (pid: string) =>
    prosQuery.data?.items.find((p) => p.id === pid)?.businessName ?? 'Professionnel';
  const serviceName = (pid: string, sid: string) =>
    prosQuery.data?.items.find((p) => p.id === pid)?.services.find((s) => s.id === sid)?.name ??
    'Prestation';

  const appointments = [...(apptsQuery.data?.items ?? [])].sort(
    (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mes rendez-vous</h1>
        <Link to="/book" className="btn-primary">
          Nouveau rendez-vous
        </Link>
      </div>

      {apptsQuery.isLoading ? (
        <Spinner label="Chargement de vos rendez-vous…" />
      ) : appointments.length === 0 ? (
        <Alert variant="info">Vous n'avez pas encore de rendez-vous.</Alert>
      ) : (
        <ul className="space-y-3">
          {appointments.map((appt) => {
            const isUpcoming =
              new Date(appt.startAt).getTime() > Date.now() &&
              (appt.status === 'PENDING' || appt.status === 'CONFIRMED');
            return (
              <li key={appt.id} className="card flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{serviceName(appt.professionalId, appt.serviceId)}</p>
                  <p className="text-sm text-slate-600">{proName(appt.professionalId)}</p>
                  <p className="text-sm text-slate-500">{formatDateTime(appt.startAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={appt.status} />
                  {isUpcoming && (
                    <>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setReschedulingId((id) => (id === appt.id ? null : appt.id))}
                      >
                        Reprogrammer
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        disabled={cancel.isPending}
                        onClick={() => {
                          if (confirm('Confirmer l’annulation de ce rendez-vous ?')) {
                            cancel.mutate(appt.id);
                          }
                        }}
                      >
                        Annuler
                      </button>
                    </>
                  )}
                </div>
                {reschedulingId === appt.id && (
                  <ReschedulePanel appointment={appt} onClose={() => setReschedulingId(null)} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
