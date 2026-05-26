'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { PageSection } from '@/components/page-section';
import {
  analyzeTicket,
  ApiError,
  assignTicketTo,
  getAccessToken,
  getCurrentUser,
  getJob,
  getTicket,
  getTicketAiSuggestion,
  isQueuedJobResponse,
  type TicketDetail,
  type TicketStatus,
  updateTicketStatus,
} from '@/lib/api';
import {
  connectRealtime,
  onRealtimeEvent,
  subscribeJobRoom,
  subscribeTicketRoom,
  unsubscribeJobRoom,
  unsubscribeTicketRoom,
} from '@/lib/realtime';

export default function TicketDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiJobMessage, setAiJobMessage] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<
    'connecting' | 'connected' | 'disconnected'
  >('disconnected');

  const socketRef = useRef<ReturnType<typeof connectRealtime>>(null);
  const terminalJobStatesRef = useRef<Map<string, 'COMPLETED' | 'FAILED'>>(
    new Map(),
  );

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
        setError(formatApiError(fetchError));
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

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      return;
    }

    const socket = connectRealtime(token);
    if (!socket) {
      return;
    }

    socketRef.current = socket;
    setRealtimeStatus(socket.connected ? 'connected' : 'connecting');

    const onConnect = () => setRealtimeStatus('connected');
    const onDisconnect = () => setRealtimeStatus('disconnected');
    const onConnectError = () => setRealtimeStatus('disconnected');
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    subscribeTicketRoom(socket, params.id);

    const unsubscribers = [
      onRealtimeEvent<Record<string, unknown>>(
        socket,
        'ticket.updated',
        (payload) => {
          if (payload.ticketId === params.id) {
            void loadTicket();
          }
        },
      ),
      onRealtimeEvent<Record<string, unknown>>(socket, 'job.processing', (payload) => {
        if (typeof payload.jobId === 'string') {
          setAiJobMessage('AI analysis processing...');
        }
      }),
      onRealtimeEvent<Record<string, unknown>>(socket, 'job.completed', (payload) => {
        if (typeof payload.jobId === 'string') {
          terminalJobStatesRef.current.set(payload.jobId, 'COMPLETED');
          setAiJobMessage('AI analysis completed.');
          void loadTicket();
        }
      }),
      onRealtimeEvent<Record<string, unknown>>(socket, 'job.failed', (payload) => {
        if (typeof payload.jobId === 'string') {
          terminalJobStatesRef.current.set(payload.jobId, 'FAILED');
          const reason =
            typeof payload.reason === 'string'
              ? payload.reason
              : 'AI analysis job failed.';
          setError(reason);
          setAiJobMessage('AI analysis failed.');
        }
      }),
      onRealtimeEvent<Record<string, unknown>>(
        socket,
        'ticket.ai.processing',
        (payload) => {
          if (payload.ticketId === params.id) {
            setAiJobMessage('AI analysis processing...');
          }
        },
      ),
      onRealtimeEvent<Record<string, unknown>>(socket, 'ticket.ai.completed', (payload) => {
        if (payload.ticketId === params.id) {
          setAiJobMessage('AI analysis completed.');
          void loadTicket();
        }
      }),
      onRealtimeEvent<Record<string, unknown>>(socket, 'ticket.ai.failed', (payload) => {
        if (payload.ticketId === params.id) {
          const reason =
            typeof payload.reason === 'string'
              ? payload.reason
              : 'AI analysis failed.';
          setError(reason);
          setAiJobMessage('AI analysis failed.');
        }
      }),
    ];

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      unsubscribeTicketRoom(socket, params.id);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
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
        setError(formatApiError(actionError));
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
        setError(formatApiError(actionError));
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
    setAiJobMessage(null);

    try {
      const analysis = await analyzeTicket(token, params.id);
      if (isQueuedJobResponse(analysis)) {
        setAiJobMessage('AI analysis queued. Waiting for worker...');
        if (socketRef.current) {
          subscribeJobRoom(socketRef.current, analysis.jobId);
        }

        await pollJobUntilDone(token, analysis.jobId);
        await loadTicket();

        if (socketRef.current) {
          unsubscribeJobRoom(socketRef.current, analysis.jobId);
        }

        setAiJobMessage('AI analysis completed.');
        return;
      }

      setTicket((prev) =>
        prev
          ? {
              ...prev,
              category: analysis.category,
              priority: analysis.priority,
              aiSummary: analysis.aiSummary,
              aiConfidence: analysis.aiConfidence,
              aiRecommendedAction: analysis.recommendedAction,
              aiContextSourcesJson: analysis.contextSources ?? null,
            }
          : prev,
      );
    } catch (actionError) {
      if (actionError instanceof ApiError) {
        setError(formatApiError(actionError));
      } else {
        setError('Could not run AI analysis.');
      }
    } finally {
      setAiLoading(false);
    }
  }

  async function pollJobUntilDone(token: string, jobId: string): Promise<void> {
    const maxChecks = 30;
    for (let attempt = 0; attempt < maxChecks; attempt += 1) {
      const realtimeStatus = terminalJobStatesRef.current.get(jobId);
      if (realtimeStatus === 'COMPLETED') {
        return;
      }
      if (realtimeStatus === 'FAILED') {
        throw new ApiError('AI analysis job failed.', 500, {
          jobId,
          status: realtimeStatus,
        });
      }

      const job = await getJob(token, jobId);
      if (job.status === 'COMPLETED') {
        terminalJobStatesRef.current.set(jobId, 'COMPLETED');
        return;
      }
      if (job.status === 'FAILED') {
        terminalJobStatesRef.current.set(jobId, 'FAILED');
        throw new ApiError(job.lastError ?? 'AI analysis job failed.', 500, {
          jobId,
          status: job.status,
        });
      }
      setAiJobMessage(`AI analysis ${job.status.toLowerCase()}...`);
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
    }

    throw new ApiError(
      'AI analysis job is still running. Please refresh in a moment.',
      408,
      { jobId },
    );
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
              aiContextSourcesJson: suggestion.contextSources ?? null,
            }
          : prev,
      );
    } catch (actionError) {
      if (actionError instanceof ApiError) {
        setError(formatApiError(actionError));
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
      {aiJobMessage ? <p className="helper-text">{aiJobMessage}</p> : null}
      <p className="helper-text">Realtime: {realtimeStatus}</p>
      {!loading && !error && !ticket ? (
        <p className="helper-text">Ticket not found.</p>
      ) : null}
      {!loading && ticket ? (
        <div className="info-list">
          <article className="info-item">
            <h3 data-testid="ticket-detail-title">{ticket.title}</h3>
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
            <p data-testid="ai-summary">
              <strong>AI Summary:</strong>{' '}
              {ticket.aiSummary ?? 'No AI summary available yet.'}
            </p>
            <p data-testid="ai-confidence">
              <strong>AI Confidence:</strong>{' '}
              {ticket.aiConfidence !== null
                ? `${Math.round(ticket.aiConfidence * 100)}%`
                : 'Not available'}
            </p>
            <p data-testid="ai-recommended-action">
              <strong>Recommended Action:</strong>{' '}
              {ticket.aiRecommendedAction ?? 'Run AI analysis to generate a suggestion.'}
            </p>
            <div>
              <strong>AI Context Sources:</strong>{' '}
              {ticket.aiContextSourcesJson && ticket.aiContextSourcesJson.length > 0 ? (
                <ul>
                  {ticket.aiContextSourcesJson.map((source) => (
                    <li key={`${source.articleId}-${source.title}`}>
                      {source.title} (score: {source.score})
                    </li>
                  ))}
                </ul>
              ) : (
                <span>No knowledge context found for this ticket.</span>
              )}
            </div>
            {ticket.aiConfidence !== null && ticket.aiConfidence < 0.6 ? (
              <p className="warning" data-testid="ai-low-confidence-warning">
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
                data-testid="run-ai-analysis-button"
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

function formatApiError(error: ApiError): string {
  if (error.requestId && !error.message.includes('requestId:')) {
    return `${error.message} (requestId: ${error.requestId})`;
  }
  return error.message;
}
