import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Alert } from '../components/ui/Alert';
import { StatusBadge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import type { Appointment, Paginated, Professional } from '../types';

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-brand-600">{value}</p>
    </div>
  );
}

function ClientDashboard() {
  const query = useQuery({
    queryKey: ['my-appointments'],
    queryFn: async () => (await api.get<Paginated<Appointment>>('/appointments/me')).data,
  });
  const prosQuery = useQuery({
    queryKey: ['professionals'],
    queryFn: async () => (await api.get<Paginated<Professional>>('/professionals')).data,
  });

  const serviceName = (pid: string, sid: string) =>
    prosQuery.data?.items.find((p) => p.id === pid)?.services.find((s) => s.id === sid)?.name ??
    'Prestation';

  const upcoming = (query.data?.items ?? [])
    .filter((a) => new Date(a.startAt).getTime() > Date.now() && a.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Rendez-vous à venir" value={upcoming.length} />
        <StatCard label="Total réservés" value={query.data?.total ?? 0} />
        <div className="card flex items-center justify-center">
          <Link to="/book" className="btn-primary">
            Réserver un rendez-vous
          </Link>
        </div>
      </div>

      <section aria-labelledby="upcoming-title">
        <h2 id="upcoming-title" className="mb-3 text-lg font-semibold">
          Prochains rendez-vous
        </h2>
        {query.isLoading ? (
          <Spinner />
        ) : upcoming.length === 0 ? (
          <Alert variant="info">Aucun rendez-vous à venir. Réservez dès maintenant !</Alert>
        ) : (
          <ul className="space-y-3">
            {upcoming.slice(0, 5).map((a) => (
              <li key={a.id} className="card flex items-center justify-between">
                <div>
                  <p className="font-medium">{serviceName(a.professionalId, a.serviceId)}</p>
                  <p className="text-sm text-slate-500">{formatDateTime(a.startAt)}</p>
                </div>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ProDashboard() {
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

  const professionalId = profileQuery.data?.id;
  const apptsQuery = useQuery({
    queryKey: ['pro-appointments', professionalId],
    enabled: Boolean(professionalId),
    queryFn: async () =>
      (await api.get<Paginated<Appointment>>(`/appointments/professional/${professionalId}`)).data,
  });

  if (profileQuery.isLoading) return <Spinner label="Chargement de votre espace…" />;

  if (!profileQuery.data) {
    return (
      <Alert variant="warning" title="Profil professionnel manquant">
        Créez votre profil professionnel pour commencer à recevoir des rendez-vous.{' '}
        <Link to="/settings" className="font-semibold text-brand-700 underline">
          Configurer mon profil
        </Link>
      </Alert>
    );
  }

  const now = Date.now();
  const weekEnd = now + 7 * 86_400_000;
  const items = apptsQuery.data?.items ?? [];
  const upcoming = items
    .filter((a) => new Date(a.startAt).getTime() > now && a.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const thisWeek = upcoming.filter((a) => new Date(a.startAt).getTime() <= weekEnd).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="RDV à venir" value={upcoming.length} />
        <StatCard label="Cette semaine" value={thisWeek} />
        <StatCard label="Prestations actives" value={profileQuery.data.services.filter((s) => s.isActive).length} />
      </div>

      <section aria-labelledby="agenda-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="agenda-title" className="text-lg font-semibold">
            Agenda — {profileQuery.data.businessName}
          </h2>
          <Link to="/settings" className="btn-secondary">
            Gérer mes prestations
          </Link>
        </div>
        {apptsQuery.isLoading ? (
          <Spinner />
        ) : upcoming.length === 0 ? (
          <Alert variant="info">Aucun rendez-vous à venir.</Alert>
        ) : (
          <ul className="space-y-3">
            {upcoming.slice(0, 8).map((a) => (
              <li key={a.id} className="card flex items-center justify-between">
                <p className="text-sm">{formatDateTime(a.startAt)}</p>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Bonjour {user?.firstName} 👋</h1>
      {user?.role === 'PRO' ? <ProDashboard /> : <ClientDashboard />}
    </div>
  );
}
