'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { PageSection } from '@/components/page-section';
import { ApiError, login, saveAccessToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const auth = await login({ email, password });
      saveAccessToken(auth.accessToken);
      router.push('/dashboard');
      router.refresh();
    } catch (submissionError) {
      if (submissionError instanceof ApiError) {
        setError(submissionError.message);
      } else {
        setError('Unexpected error. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageSection title="Login" subtitle="Sign in to your OpsPilot workspace">
      <form className="form-grid" onSubmit={onSubmit}>
        <label>
          Work Email
          <input
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
          />
        </label>
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      {error ? <p className="warning" style={{ marginTop: '0.7rem' }}>{error}</p> : null}
      <p className="helper-text" style={{ marginTop: '0.8rem' }}>
        Demo credentials are available in the seed script.
      </p>
      <p className="helper-text" style={{ marginTop: '0.35rem' }}>
        Need an account?{' '}
        <Link href="/register" className="inline-link">
          Register here
        </Link>
      </p>
    </PageSection>
  );
}
