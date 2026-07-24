import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'font-semibold text-brand-600' : 'text-slate-600 hover:text-brand-600';
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Aller au contenu principal
      </a>

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="text-lg font-bold text-brand-600">
            SmartBooking
          </Link>
          <nav aria-label="Navigation principale" className="flex flex-wrap items-center gap-4 text-sm">
            {user ? (
              <>
                <NavLink to="/" end className={navClass}>
                  Tableau de bord
                </NavLink>
                {user.role === 'CLIENT' && (
                  <>
                    <NavLink to="/book" className={navClass}>
                      Réserver
                    </NavLink>
                    <NavLink to="/appointments" className={navClass}>
                      Mes rendez-vous
                    </NavLink>
                  </>
                )}
                {user.role === 'PRO' && (
                  <NavLink to="/settings" className={navClass}>
                    Mes prestations
                  </NavLink>
                )}
                <span className="text-slate-400" aria-hidden="true">
                  |
                </span>
                <span className="text-slate-600">
                  {user.firstName} {user.lastName}
                </span>
                <button type="button" className="btn-secondary" onClick={() => void logout()}>
                  Se déconnecter
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navClass}>
                  Se connecter
                </NavLink>
                <Link to="/register" className="btn-primary">
                  Créer un compte
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        SmartBooking — Plateforme de prise de rendez-vous · Projet RNCP 39583
      </footer>
    </div>
  );
}
