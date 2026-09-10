import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Alert } from '../components/ui/Alert';
import { StatusBadge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import type { Appointment, AppointmentStatus, Paginated, Professional, Role, User } from '../types';

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
  const queryClient = useQueryClient();
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

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      api.patch(`/appointments/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pro-appointments', professionalId] }),
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

  const services = profileQuery.data.services;
  const serviceName = (sid: string) => services.find((s) => s.id === sid)?.name ?? 'Prestation';

  const now = Date.now();
  const weekEnd = now + 7 * 86_400_000;
  const items = apptsQuery.data?.items ?? [];
  const upcoming = items
    .filter((a) => new Date(a.startAt).getTime() > now && a.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const thisWeek = upcoming.filter((a) => new Date(a.startAt).getTime() <= weekEnd).length;
  const pending = upcoming.filter((a) => a.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="RDV à venir" value={upcoming.length} />
        <StatCard label="En attente" value={pending} />
        <StatCard label="Cette semaine" value={thisWeek} />
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
              <li key={a.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{serviceName(a.serviceId)}</p>
                  <p className="text-sm text-slate-500">{formatDateTime(a.startAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={a.status} />
                  {a.status === 'PENDING' && (
                    <>
                      <button
                        type="button"
                        className="btn-primary text-sm"
                        disabled={updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ id: a.id, status: 'CONFIRMED' })}
                      >
                        Confirmer
                      </button>
                      <button
                        type="button"
                        className="btn-danger text-sm"
                        disabled={updateStatus.isPending}
                        onClick={() => {
                          if (confirm('Refuser ce rendez-vous ?')) {
                            updateStatus.mutate({ id: a.id, status: 'CANCELLED' });
                          }
                        }}
                      >
                        Refuser
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AdminDashboard() {
  const { user: current } = useAuth();
  const queryClient = useQueryClient();
  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await api.get<Paginated<User>>('/users')).data,
  });

  const adminUpdate = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { isActive?: boolean; role?: Role } }) =>
      api.patch(`/users/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const users = usersQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Comptes" value={usersQuery.data?.total ?? users.length} />
        <StatCard label="Clients" value={users.filter((u) => u.role === 'CLIENT').length} />
        <StatCard label="Professionnels" value={users.filter((u) => u.role === 'PRO').length} />
        <StatCard label="Administrateurs" value={users.filter((u) => u.role === 'ADMIN').length} />
      </div>

      <section aria-labelledby="users-title">
        <h2 id="users-title" className="mb-3 text-lg font-semibold">
          Comptes de la plateforme
        </h2>
        {usersQuery.isLoading ? (
          <Spinner />
        ) : users.length === 0 ? (
          <Alert variant="info">Aucun compte à afficher.</Alert>
        ) : (
          <ul className="space-y-2">
            {users.map((u) => {
              const isSelf = u.id === current?.id;
              return (
                <li key={u.id} className="card flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {u.firstName} {u.lastName}
                      {!u.isActive && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          Inactif
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-slate-500">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={`Rôle de ${u.email}`}
                      className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                      value={u.role}
                      disabled={isSelf || adminUpdate.isPending}
                      onChange={(e) => adminUpdate.mutate({ id: u.id, data: { role: e.target.value as Role } })}
                    >
                      <option value="CLIENT">Client</option>
                      <option value="PRO">Professionnel</option>
                      <option value="ADMIN">Administrateur</option>
                    </select>
                    <button
                      type="button"
                      className={`text-sm ${u.isActive ? 'btn-danger' : 'btn-primary'}`}
                      disabled={isSelf || adminUpdate.isPending}
                      onClick={() => adminUpdate.mutate({ id: u.id, data: { isActive: !u.isActive } })}
                    >
                      {u.isActive ? 'Désactiver' : 'Réactiver'}
                    </button>
                  </div>
                </li>
              );
            })}
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
      {user?.role === 'PRO' ? (
        <ProDashboard />
      ) : user?.role === 'ADMIN' ? (
        <AdminDashboard />
      ) : (
        <ClientDashboard />
      )}
    </div>
  );
}
