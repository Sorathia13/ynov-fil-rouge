import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Alert } from '../components/ui/Alert';
import { TextField } from '../components/ui/TextField';
import { useAuth } from '../context/AuthContext';
import { apiError } from '../lib/api';

const schema = z.object({
  email: z.string().email('Adresse e-mail invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (data) => {
    setError(null);
    try {
      await login(data.email, data.password);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (e) {
      setError(apiError(e).message);
    }
  });

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold">Connexion</h1>
      <form className="card space-y-4" onSubmit={onSubmit} noValidate>
        {error && <Alert variant="error">{error}</Alert>}
        <TextField
          label="Adresse e-mail"
          type="email"
          autoComplete="email"
          {...register('email')}
          error={errors.email?.message}
        />
        <TextField
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          {...register('password')}
          error={errors.password?.message}
        />
        <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Connexion…' : 'Se connecter'}
        </button>
        <p className="text-sm text-slate-600">
          Pas encore de compte ?{' '}
          <Link className="text-brand-600 underline" to="/register">
            Créer un compte
          </Link>
        </p>
      </form>
      <p className="mt-4 text-center text-xs text-slate-500">
        Comptes de démo (mot de passe <code>Password123!</code>) :<br />
        client@smartbooking.dev · pro@smartbooking.dev · admin@smartbooking.dev
      </p>
    </div>
  );
}
