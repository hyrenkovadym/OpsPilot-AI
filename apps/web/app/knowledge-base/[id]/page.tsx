'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { PageSection } from '@/components/page-section';
import {
  ApiError,
  archiveKnowledgeArticle,
  deleteKnowledgeArticle,
  getAccessToken,
  getJob,
  getKnowledgeArticle,
  isQueuedJobResponse,
  publishKnowledgeArticle,
  rechunkKnowledgeArticle,
  updateKnowledgeArticle,
  type KnowledgeArticle,
  type TicketCategory,
} from '@/lib/api';
import {
  connectRealtime,
  onRealtimeEvent,
  subscribeJobRoom,
  unsubscribeJobRoom,
} from '@/lib/realtime';

interface FormState {
  title: string;
  category: TicketCategory;
  content: string;
}

function toFormState(article: KnowledgeArticle): FormState {
  return {
    title: article.title,
    category: article.category,
    content: article.content,
  };
}

export default function KnowledgeArticleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [article, setArticle] = useState<KnowledgeArticle | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [jobMessage, setJobMessage] = useState<string | null>(null);

  const socketRef = useRef<ReturnType<typeof connectRealtime>>(null);
  const terminalJobStatesRef = useRef<Map<string, 'COMPLETED' | 'FAILED'>>(
    new Map(),
  );

  async function loadArticle() {
    const token = getAccessToken();
    if (!token) {
      setError('Please login first.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await getKnowledgeArticle(token, params.id);
      setArticle(response);
      setForm(toFormState(response));
    } catch (fetchError) {
      if (fetchError instanceof ApiError) {
        setError(fetchError.message);
      } else {
        setError('Could not load article.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadArticle();
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

    const unsubscribers = [
      onRealtimeEvent<Record<string, unknown>>(
        socket,
        'knowledge.rechunk.processing',
        (payload) => {
          if (payload.articleId === params.id) {
            setJobMessage('Rechunk job processing...');
          }
        },
      ),
      onRealtimeEvent<Record<string, unknown>>(
        socket,
        'knowledge.rechunk.completed',
        (payload) => {
          if (payload.articleId === params.id) {
            if (typeof payload.jobId === 'string') {
              terminalJobStatesRef.current.set(payload.jobId, 'COMPLETED');
            }
            setJobMessage('Rechunk job completed.');
            void loadArticle();
          }
        },
      ),
      onRealtimeEvent<Record<string, unknown>>(
        socket,
        'knowledge.rechunk.failed',
        (payload) => {
          if (payload.articleId === params.id) {
            if (typeof payload.jobId === 'string') {
              terminalJobStatesRef.current.set(payload.jobId, 'FAILED');
            }
            const reason =
              typeof payload.reason === 'string'
                ? payload.reason
                : 'Rechunk job failed.';
            setError(reason);
            setJobMessage('Rechunk job failed.');
          }
        },
      ),
      onRealtimeEvent<Record<string, unknown>>(socket, 'job.completed', (payload) => {
        if (typeof payload.jobId === 'string') {
          terminalJobStatesRef.current.set(payload.jobId, 'COMPLETED');
        }
      }),
      onRealtimeEvent<Record<string, unknown>>(socket, 'job.failed', (payload) => {
        if (typeof payload.jobId === 'string') {
          terminalJobStatesRef.current.set(payload.jobId, 'FAILED');
        }
      }),
    ];

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function saveArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token || !form) {
      setError('Please login first.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    setJobMessage(null);

    try {
      const updated = await updateKnowledgeArticle(token, params.id, form);
      setArticle(updated);
      setForm(toFormState(updated));
      setSuccess('Article updated.');
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setError(submitError.message);
      } else {
        setError('Could not update article.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function runAction(
    action: () => Promise<KnowledgeArticle | void>,
    successMessage: string,
  ) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await action();
      if (result) {
        setArticle(result);
        setForm(toFormState(result));
      }
      setSuccess(successMessage);
    } catch (actionError) {
      if (actionError instanceof ApiError) {
        setError(actionError.message);
      } else {
        setError('Request failed.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRechunk(): Promise<void> {
    const token = getAccessToken();
    if (!token) {
      setError('Please login first.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    setJobMessage(null);

    try {
      const result = await rechunkKnowledgeArticle(token, params.id);
      if (isQueuedJobResponse(result)) {
        setJobMessage('Rechunk job queued. Waiting for worker...');
        if (socketRef.current) {
          subscribeJobRoom(socketRef.current, result.jobId);
        }
        await pollJobUntilDone(token, result.jobId);
        await loadArticle();
        if (socketRef.current) {
          unsubscribeJobRoom(socketRef.current, result.jobId);
        }
        setSuccess('Article chunks rebuilt asynchronously.');
      } else {
        setArticle(result);
        setForm(toFormState(result));
        setSuccess('Article chunks rebuilt.');
      }
    } catch (actionError) {
      if (actionError instanceof ApiError) {
        setError(actionError.message);
      } else {
        setError('Could not rechunk article.');
      }
    } finally {
      setSaving(false);
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
        throw new ApiError('Rechunk job failed.', 500, { jobId, status: realtimeStatus });
      }

      const job = await getJob(token, jobId);
      if (job.status === 'COMPLETED') {
        terminalJobStatesRef.current.set(jobId, 'COMPLETED');
        return;
      }
      if (job.status === 'FAILED') {
        terminalJobStatesRef.current.set(jobId, 'FAILED');
        throw new ApiError(job.lastError ?? 'Background job failed.', 500, {
          jobId,
          status: job.status,
        });
      }
      setJobMessage(`Rechunk job ${job.status.toLowerCase()}...`);
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
    }

    throw new ApiError(
      'Rechunk job is still running. Please refresh in a moment.',
      408,
      { jobId },
    );
  }

  return (
    <PageSection
      title="Knowledge Article Detail"
      subtitle="Edit, publish, archive, and rechunk article content"
    >
      <div className="inline-links" style={{ marginBottom: '0.8rem' }}>
        <Link href="/knowledge-base" className="inline-link">
          Back to knowledge base
        </Link>
      </div>

      {loading ? <p className="helper-text">Loading article...</p> : null}
      {error ? <p className="warning">{error}</p> : null}
      {success ? <p className="helper-text">{success}</p> : null}
      {jobMessage ? <p className="helper-text">{jobMessage}</p> : null}

      {!loading && !error && article && form ? (
        <>
          <article className="info-item" style={{ marginBottom: '0.8rem' }}>
            <p>
              <strong>Status:</strong> {article.status}
            </p>
            <p>
              <strong>Chunks:</strong> {article.chunksCount}
            </p>
            <p>
              <strong>Updated:</strong> {new Date(article.updatedAt).toLocaleString()}
            </p>
          </article>

          <form className="form-grid" onSubmit={saveArticle}>
            <label>
              Title
              <input
                type="text"
                value={form.title}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, title: event.target.value } : prev,
                  )
                }
                required
                maxLength={180}
              />
            </label>
            <label>
              Category
              <select
                value={form.category}
                onChange={(event) =>
                  setForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          category: event.target.value as TicketCategory,
                        }
                      : prev,
                  )
                }
              >
                <option value="HR">HR</option>
                <option value="IT">IT</option>
                <option value="FINANCE">FINANCE</option>
                <option value="OPERATIONS">OPERATIONS</option>
                <option value="CUSTOMER_SUPPORT">CUSTOMER_SUPPORT</option>
                <option value="OTHER">OTHER</option>
              </select>
            </label>
            <label>
              Content
              <textarea
                value={form.content}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, content: event.target.value } : prev,
                  )
                }
                rows={14}
                required
              />
            </label>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>

          <div className="inline-links" style={{ marginTop: '0.9rem' }}>
            <button
              type="button"
              className="btn subtle-btn"
              disabled={saving}
              onClick={() =>
                void runAction(async () => {
                  const token = getAccessToken();
                  if (!token) {
                    throw new Error('Please login first.');
                  }
                  return publishKnowledgeArticle(token, params.id);
                }, 'Article published.')
              }
            >
              Publish
            </button>
            <button
              type="button"
              className="btn subtle-btn"
              disabled={saving}
              onClick={() =>
                void runAction(async () => {
                  const token = getAccessToken();
                  if (!token) {
                    throw new Error('Please login first.');
                  }
                  return archiveKnowledgeArticle(token, params.id);
                }, 'Article archived.')
              }
            >
              Archive
            </button>
            <button
              type="button"
              className="btn subtle-btn"
              disabled={saving}
              onClick={() => void handleRechunk()}
            >
              Rechunk
            </button>
            <button
              type="button"
              className="btn subtle-btn"
              disabled={saving}
              onClick={() =>
                void runAction(async () => {
                  const token = getAccessToken();
                  if (!token) {
                    throw new Error('Please login first.');
                  }
                  await deleteKnowledgeArticle(token, params.id);
                }, 'Article deleted.')
              }
            >
              Delete
            </button>
            <button
              type="button"
              className="btn subtle-btn"
              onClick={() => {
                router.refresh();
                void loadArticle();
              }}
            >
              Refresh
            </button>
          </div>
        </>
      ) : null}
    </PageSection>
  );
}
