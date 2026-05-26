'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { PageSection } from '@/components/page-section';
import { ApiError, register, saveAccessToken } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const auth = await register({ fullName, email, password });
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
    <PageSection
      title="Register"
      subtitle="Create a standard employee account for submitting tickets"
    >
      <form className="form-grid" onSubmit={onSubmit}>
        <label>
          Full Name
          <input
            type="text"
            name="fullName"
            data-testid="register-full-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Jane Doe"
            required
          />
        </label>
        <label>
          Work Email
          <input
            type="email"
            name="email"
            data-testid="register-email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="jane.doe@company.com"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            data-testid="register-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Use a strong password"
            minLength={8}
            required
          />
        </label>
        <button
          type="submit"
          className="btn"
          data-testid="register-submit"
          disabled={submitting}
        >
          {submitting ? 'Creating...' : 'Create Account'}
        </button>
      </form>
      {error ? <p className="warning" style={{ marginTop: '0.7rem' }}>{error}</p> : null}
      <p className="helper-text" style={{ marginTop: '0.35rem' }}>
        Already registered?{' '}
        <Link href="/login" className="inline-link">
          Login
        </Link>
      </p>
    </PageSection>
  );
}
