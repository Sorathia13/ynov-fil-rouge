import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="text-3xl font-bold">404</h1>
      <p className="mt-2 text-slate-600">Cette page n'existe pas.</p>
      <Link to="/" className="btn-primary mt-6 inline-flex">
        Retour à l'accueil
      </Link>
    </div>
  );
}
