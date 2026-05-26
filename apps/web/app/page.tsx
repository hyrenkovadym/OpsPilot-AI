import Link from 'next/link';
import { PageSection } from '@/components/page-section';

export default function HomePage() {
  return (
    <>
      <PageSection
        title="OpsPilot AI"
        subtitle="AI-powered internal support and operations automation platform"
      >
        <p className="helper-text">
          This frontend is the Phase 1 skeleton for an internal operations platform.
          It includes starter flows for authentication and ticket management while
          backend APIs, RBAC, and audit logging are already active in the NestJS service.
        </p>
        <div className="inline-links" style={{ marginTop: '0.9rem' }}>
          <Link className="inline-link" href="/login">
            Go to Login
          </Link>
          <Link className="inline-link" href="/register">
            Go to Register
          </Link>
          <Link className="inline-link" href="/dashboard">
            Open Dashboard
          </Link>
        </div>
      </PageSection>

      <section className="card-grid">
        <article className="card">
          <h3>Operational Requests</h3>
          <p>Create, track, and triage internal support tickets across departments.</p>
        </article>
        <article className="card">
          <h3>Role-aware Access</h3>
          <p>User and support views are separated by backend role-based controls.</p>
        </article>
        <article className="card">
          <h3>AI-ready Foundation</h3>
          <p>Designed for upcoming AI summaries and knowledge-assisted responses.</p>
        </article>
      </section>
    </>
  );
}

