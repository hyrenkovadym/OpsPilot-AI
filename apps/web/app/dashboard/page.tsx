'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PageSection } from '@/components/page-section';
import {
  ApiError,
  clearAccessToken,
  getAccessToken,
  listTickets,
  type TicketDetail,
} from '@/lib/api';

export default function DashboardPage() {
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setError('Please login to view dashboard metrics.');
      setLoading(false);
      return;
    }
    const accessToken = token;

    async function run() {
      try {
        const response = await listTickets(accessToken, { page: 1, limit: 100 });
        setTickets(response.data);
      } catch (fetchError) {
        if (fetchError instanceof ApiError) {
          setError(fetchError.message);
        } else {
          setError('Could not load dashboard data.');
        }
      } finally {
        setLoading(false);
      }
    }

    void run();
  }, []);

  const metrics = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((ticket) => ticket.status === 'OPEN').length;
    const inProgress = tickets.filter(
      (ticket) =>
        ticket.status === 'IN_PROGRESS' ||
        ticket.status === 'NEEDS_HUMAN_REVIEW',
    ).length;
    const resolved = tickets.filter((ticket) => ticket.status === 'RESOLVED').length;

    return { total, open, inProgress, resolved };
  }, [tickets]);

  return (
    <PageSection title="Dashboard" subtitle="Live support ticket overview">
      <div className="inline-links" style={{ marginBottom: '0.8rem' }}>
        <Link href="/tickets" className="inline-link">
          View tickets
        </Link>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            clearAccessToken();
            window.location.href = '/login';
          }}
        >
          Logout
        </button>
      </div>
      {loading ? <p className="helper-text">Loading dashboard metrics...</p> : null}
      {error ? <p className="warning">{error}</p> : null}
      {!loading && !error ? (
        <div className="card-grid">
          <article className="card">
            <h3>Total Tickets</h3>
            <p className="metric">{metrics.total}</p>
          </article>
          <article className="card">
            <h3>Open</h3>
            <p className="metric">{metrics.open}</p>
          </article>
          <article className="card">
            <h3>In Progress</h3>
            <p className="metric">{metrics.inProgress}</p>
          </article>
          <article className="card">
            <h3>Resolved</h3>
            <p className="metric">{metrics.resolved}</p>
          </article>
        </div>
      ) : null}
    </PageSection>
  );
}
