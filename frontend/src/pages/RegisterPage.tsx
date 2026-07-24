import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Alert } from '../components/ui/Alert';
import { TextField } from '../components/ui/TextField';
import { useAuth } from '../context/AuthContext';
import { apiError } from '../lib/api';

const schema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  email: z.string().email('Adresse e-mail invalide'),
  password: z.string().min(8, 'Au moins 8 caractères'),
  role: z.enum(['CLIENT', 'PRO']),
});
type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { role: 'CLIENT' } });

  const onSubmit = handleSubmit(async (data) => {
    setError(null);
    try {
      await registerUser(data);
      navigate('/', { replace: true });
    } catch (e) {
      setError(apiError(e).message);
    }
  });

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold">Créer un compte</h1>
      <form className="card space-y-4" onSubmit={onSubmit} noValidate>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Prénom" autoComplete="given-name" {...register('firstName')} error={errors.firstName?.message} />
          <TextField label="Nom" autoComplete="family-name" {...register('lastName')} error={errors.lastName?.message} />
        </div>
        <TextField label="Adresse e-mail" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
        <TextField
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          hint="8 caractères minimum"
          {...register('password')}
          error={errors.password?.message}
        />
        <fieldset>
          <legend className="label">Type de compte</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" value="CLIENT" {...register('role')} /> Client
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" value="PRO" {...register('role')} /> Professionnel
            </label>
          </div>
        </fieldset>
        <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Création…' : 'Créer mon compte'}
        </button>
        <p className="text-sm text-slate-600">
          Déjà inscrit ?{' '}
          <Link className="text-brand-600 underline" to="/login">
            Se connecter
          </Link>
        </p>
      </form>
    </div>
  );
}
