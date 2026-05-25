'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { PageSection } from '@/components/page-section';
import {
  ApiError,
  createTicket,
  getAccessToken,
  type TicketCategory,
  type TicketPriority,
} from '@/lib/api';

export default function NewTicketPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('IT');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setError('Please login first.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await createTicket(token, {
        title,
        description,
        category,
        priority,
      });
      setSuccessMessage('Ticket created successfully.');
      router.push('/tickets');
      router.refresh();
    } catch (submissionError) {
      if (submissionError instanceof ApiError) {
        setError(submissionError.message);
      } else {
        setError('Could not create ticket.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageSection title="New Ticket" subtitle="Submit a support request to operations">
      <form className="form-grid" onSubmit={onSubmit}>
        <label>
          Title
          <input
            type="text"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Need access to quarterly reporting dashboard"
            minLength={3}
            required
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Please describe your request with enough context for support review."
            minLength={5}
            required
          />
        </label>
        <label>
          Category
          <select
            name="category"
            value={category}
            onChange={(event) => setCategory(event.target.value as TicketCategory)}
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
          Priority
          <select
            name="priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value as TicketPriority)}
          >
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
        </label>
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit Ticket'}
        </button>
      </form>
      {error ? <p className="warning" style={{ marginTop: '0.7rem' }}>{error}</p> : null}
      {successMessage ? (
        <p className="helper-text" style={{ marginTop: '0.7rem' }}>
          {successMessage}
        </p>
      ) : null}
    </PageSection>
  );
}
