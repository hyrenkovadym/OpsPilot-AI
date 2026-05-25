'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageSection } from '@/components/page-section';
import {
  analyzeTicket,
  ApiError,
  assignTicketTo,
  getAccessToken,
  getTicketAiSuggestion,
  getCurrentUser,
  getTicket,
  type TicketDetail,
  type TicketStatus,
  updateTicketStatus,
} from '@/lib/api';

export default function TicketDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  async function loadTicket() {
    const token = getAccessToken();
    if (!token) {
      setError('Please login first.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getTicket(token, params.id);
      setTicket(response);
    } catch (fetchError) {
      if (fetchError instanceof ApiError) {
        setError(fetchError.message);
      } else {
        setError('Failed to load ticket.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function changeStatus(status: TicketStatus) {
    const token = getAccessToken();
    if (!token) {
      setError('Please login first.');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const updated = await updateTicketStatus(token, params.id, status);
      setTicket(updated);
    } catch (actionError) {
      if (actionError instanceof ApiError) {
        setError(actionError.message);
      } else {
        setError('Could not update ticket status.');
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function assignToMe() {
    const token = getAccessToken();
    if (!token) {
      setError('Please login first.');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const currentUser = await getCurrentUser(token);
      const updated = await assignTicketTo(token, params.id, currentUser.id);
      setTicket(updated);
    } catch (actionError) {
      if (actionError instanceof ApiError) {
        setError(actionError.message);
      } else {
        setError('Could not assign ticket.');
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function runAiAnalysis() {
    const token = getAccessToken();
    if (!token) {
      setError('Please login first.');
      return;
    }

    setAiLoading(true);
    setError(null);

    try {
      const analysis = await analyzeTicket(token, params.id);
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              category: analysis.category,
              priority: analysis.priority,
              aiSummary: analysis.aiSummary,
              aiConfidence: analysis.aiConfidence,
              aiRecommendedAction: analysis.recommendedAction,
            }
          : prev,
      );
    } catch (actionError) {
      if (actionError instanceof ApiError) {
        setError(actionError.message);
      } else {
        setError('Could not run AI analysis.');
      }
    } finally {
      setAiLoading(false);
    }
  }

  async function refreshAiSuggestion() {
    const token = getAccessToken();
    if (!token) {
      setError('Please login first.');
      return;
    }

    setAiLoading(true);
    setError(null);

    try {
      const suggestion = await getTicketAiSuggestion(token, params.id);
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              category: suggestion.category,
              priority: suggestion.priority,
              aiSummary: suggestion.aiSummary,
              aiConfidence: suggestion.aiConfidence,
              aiRecommendedAction: suggestion.recommendedAction,
            }
          : prev,
      );
    } catch (actionError) {
      if (actionError instanceof ApiError) {
        setError(actionError.message);
      } else {
        setError('Could not refresh AI suggestion.');
      }
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <PageSection title="Ticket Details" subtitle="Review and update ticket workflow">
      <div className="inline-links" style={{ marginBottom: '0.8rem' }}>
        <Link href="/tickets" className="inline-link">
          Back to tickets
        </Link>
      </div>
      {loading ? <p className="helper-text">Loading ticket...</p> : null}
      {error ? <p className="warning">{error}</p> : null}
      {!loading && !error && !ticket ? (
        <p className="helper-text">Ticket not found.</p>
      ) : null}
      {!loading && ticket ? (
        <div className="info-list">
          <article className="info-item">
            <h3>{ticket.title}</h3>
            <p className="helper-text">{ticket.description}</p>
          </article>
          <article className="info-item">
            <p>
              <strong>Status:</strong> {ticket.status}
            </p>
            <p>
              <strong>Priority:</strong> {ticket.priority}
            </p>
            <p>
              <strong>Category:</strong> {ticket.category}
            </p>
            <p>
              <strong>Created By:</strong> {ticket.createdBy.fullName} (
              {ticket.createdBy.email})
            </p>
            <p>
              <strong>Assigned To:</strong>{' '}
              {ticket.assignedTo
                ? `${ticket.assignedTo.fullName} (${ticket.assignedTo.email})`
                : 'Unassigned'}
            </p>
            <p>
              <strong>Created:</strong> {new Date(ticket.createdAt).toLocaleString()}
            </p>
            <p>
              <strong>Updated:</strong> {new Date(ticket.updatedAt).toLocaleString()}
            </p>
            <p>
              <strong>AI Summary:</strong>{' '}
              {ticket.aiSummary ?? 'No AI summary available yet.'}
            </p>
            <p>
              <strong>AI Confidence:</strong>{' '}
              {ticket.aiConfidence !== null
                ? `${Math.round(ticket.aiConfidence * 100)}%`
                : 'Not available'}
            </p>
            <p>
              <strong>Recommended Action:</strong>{' '}
              {ticket.aiRecommendedAction ?? 'Run AI analysis to generate a suggestion.'}
            </p>
            {ticket.aiConfidence !== null && ticket.aiConfidence < 0.6 ? (
              <p className="warning">
                AI confidence is low. Please review this recommendation manually.
              </p>
            ) : null}
          </article>
          <article className="info-item">
            <div className="inline-links">
              <button
                type="button"
                className="btn subtle-btn"
                disabled={actionLoading}
                onClick={() => void assignToMe()}
              >
                Assign to me
              </button>
              <button
                type="button"
                className="btn subtle-btn"
                disabled={actionLoading}
                onClick={() => void changeStatus('IN_PROGRESS')}
              >
                Mark in progress
              </button>
              <button
                type="button"
                className="btn subtle-btn"
                disabled={actionLoading}
                onClick={() => void changeStatus('RESOLVED')}
              >
                Resolve
              </button>
              <button
                type="button"
                className="btn subtle-btn"
                disabled={actionLoading}
                onClick={() => void changeStatus('REJECTED')}
              >
                Reject
              </button>
              <button
                type="button"
                className="btn subtle-btn"
                disabled={aiLoading}
                onClick={() => void runAiAnalysis()}
              >
                {aiLoading ? 'Running AI...' : 'Run AI analysis'}
              </button>
              <button
                type="button"
                className="btn subtle-btn"
                disabled={aiLoading}
                onClick={() => void refreshAiSuggestion()}
              >
                Refresh AI suggestion
              </button>
            </div>
          </article>
        </div>
      ) : null}
      <div style={{ marginTop: '0.8rem' }}>
        <button
          type="button"
          className="btn subtle-btn"
          onClick={() => {
            router.refresh();
            void loadTicket();
          }}
        >
          Refresh
        </button>
      </div>
    </PageSection>
  );
}
