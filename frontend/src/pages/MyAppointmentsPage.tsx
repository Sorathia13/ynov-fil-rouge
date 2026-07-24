import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Alert } from '../components/ui/Alert';
import { StatusBadge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import type { Appointment, Paginated, Professional } from '../types';

export function MyAppointmentsPage() {
  const queryClient = useQueryClient();

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
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
