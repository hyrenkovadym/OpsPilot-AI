'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { PageSection } from '@/components/page-section';
import {
  ApiError,
  getAccessToken,
  listTickets,
  type TicketPriority,
  type TicketStatus,
  type TicketsListResponse,
} from '@/lib/api';
import { connectRealtime, onRealtimeEvent } from '@/lib/realtime';

interface FilterState {
  search: string;
  status: '' | TicketStatus;
  priority: '' | TicketPriority;
}

const initialFilters: FilterState = {
  search: '',
  status: '',
  priority: '',
};

export default function TicketsPage() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [tickets, setTickets] = useState<TicketsListResponse['data']>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeHint, setRealtimeHint] = useState<string | null>(null);

  async function loadTickets(nextPage: number, nextFilters: FilterState) {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      setError('Please login to view tickets.');
      return;
    }
    const accessToken = token;

    setLoading(true);
    setError(null);

    try {
      const response = await listTickets(accessToken, {
        page: nextPage,
        limit,
        search: nextFilters.search || undefined,
        status: nextFilters.status || undefined,
        priority: nextFilters.priority || undefined,
      });
      setTickets(response.data);
      setPage(response.meta.page);
      setTotalPages(response.meta.totalPages);
      setRealtimeHint(null);
    } catch (fetchError) {
      if (fetchError instanceof ApiError) {
        setError(formatApiError(fetchError));
      } else {
        setError('Could not fetch tickets.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTickets(1, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      return;
    }

    const socket = connectRealtime(token);
    if (!socket) {
      return;
    }

    const unsubscribers = [
      onRealtimeEvent<Record<string, unknown>>(socket, 'ticket.created', () => {
        setRealtimeHint('New ticket activity received. Refresh to see latest data.');
      }),
      onRealtimeEvent<Record<string, unknown>>(socket, 'ticket.updated', () => {
        setRealtimeHint('Ticket updates available. Refresh to sync current view.');
      }),
    ];

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, []);

  function onFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadTickets(1, filters);
  }

  return (
    <PageSection title="Tickets" subtitle="Internal support requests">
      <form className="filters-grid" onSubmit={onFilterSubmit}>
        <label>
          Search
          <input
            type="text"
            value={filters.search}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, search: event.target.value }))
            }
            placeholder="Search title or description"
          />
        </label>
        <label>
          Status
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                status: event.target.value as FilterState['status'],
              }))
            }
          >
            <option value="">Any</option>
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="NEEDS_HUMAN_REVIEW">NEEDS_HUMAN_REVIEW</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </label>
        <label>
          Priority
          <select
            value={filters.priority}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                priority: event.target.value as FilterState['priority'],
              }))
            }
          >
            <option value="">Any</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
        </label>
        <button type="submit" className="btn">
          Apply Filters
        </button>
      </form>

      <div className="inline-links" style={{ marginTop: '0.9rem' }}>
        <Link href="/tickets/new" className="inline-link">
          Create new ticket
        </Link>
      </div>

      {realtimeHint ? (
        <div style={{ marginTop: '0.8rem' }}>
          <p className="helper-text">{realtimeHint}</p>
          <button
            type="button"
            className="btn subtle-btn"
            onClick={() => void loadTickets(page, filters)}
          >
            Refresh tickets
          </button>
        </div>
      ) : null}

      {loading ? <p className="helper-text">Loading tickets...</p> : null}
      {error ? <p className="warning">{error}</p> : null}
      {!loading && !error && tickets.length === 0 ? (
        <p className="helper-text">No tickets found for current filters.</p>
      ) : null}

      {!loading && !error && tickets.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="tickets-table" data-testid="tickets-list">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Category</th>
                  <th>AI Confidence</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id} data-testid="ticket-row">
                    <td>
                      <Link href={`/tickets/${ticket.id}`} className="inline-link">
                        {ticket.title}
                      </Link>
                    </td>
                    <td>{ticket.status}</td>
                    <td>{ticket.priority}</td>
                    <td>{ticket.category}</td>
                    <td>
                      {ticket.aiConfidence !== null
                        ? `${Math.round(ticket.aiConfidence * 100)}%`
                        : 'N/A'}
                    </td>
                    <td>{new Date(ticket.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <button
              type="button"
              className="btn subtle-btn"
              disabled={page <= 1}
              onClick={() => void loadTickets(page - 1, filters)}
            >
              Previous
            </button>
            <span className="helper-text">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn subtle-btn"
              disabled={page >= totalPages}
              onClick={() => void loadTickets(page + 1, filters)}
            >
              Next
            </button>
          </div>
        </>
      ) : null}
    </PageSection>
  );
}

function formatApiError(error: ApiError): string {
  if (error.requestId && !error.message.includes('requestId:')) {
    return `${error.message} (requestId: ${error.requestId})`;
  }
  return error.message;
}
