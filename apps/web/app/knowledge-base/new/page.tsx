'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { PageSection } from '@/components/page-section';
import {
  ApiError,
  createKnowledgeArticle,
  getAccessToken,
  type TicketCategory,
} from '@/lib/api';

interface ArticleFormState {
  title: string;
  category: TicketCategory;
  content: string;
}

const initialState: ArticleFormState = {
  title: '',
  category: 'IT',
  content: '',
};

export default function NewKnowledgeArticlePage() {
  const router = useRouter();
  const [form, setForm] = useState<ArticleFormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setError('Please login first.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const created = await createKnowledgeArticle(token, form);
      router.push(`/knowledge-base/${created.id}`);
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setError(submitError.message);
      } else {
        setError('Could not create knowledge article.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageSection title="New Knowledge Article" subtitle="Create a draft article">
      <div className="inline-links" style={{ marginBottom: '0.8rem' }}>
        <Link href="/knowledge-base" className="inline-link">
          Back to knowledge base
        </Link>
      </div>
      <form className="form-grid" onSubmit={onSubmit}>
        <label>
          Title
          <input
            type="text"
            value={form.title}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, title: event.target.value }))
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
              setForm((prev) => ({
                ...prev,
                category: event.target.value as TicketCategory,
              }))
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
              setForm((prev) => ({ ...prev, content: event.target.value }))
            }
            rows={12}
            required
          />
        </label>
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Article'}
        </button>
      </form>
      {error ? <p className="warning">{error}</p> : null}
    </PageSection>
  );
}

