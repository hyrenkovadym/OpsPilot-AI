'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { PageSection } from '@/components/page-section';
import {
  ApiError,
  getAccessToken,
  listKnowledgeArticles,
  type KnowledgeArticle,
  type KnowledgeArticleStatus,
  type TicketCategory,
} from '@/lib/api';

interface FilterState {
  search: string;
  category: '' | TicketCategory;
  status: '' | KnowledgeArticleStatus;
}

const initialFilters: FilterState = {
  search: '',
  category: '',
  status: '',
};

export default function KnowledgeBasePage() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadArticles(nextPage: number, nextFilters: FilterState) {
    const token = getAccessToken();
    if (!token) {
      setError('Please login to view knowledge base.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await listKnowledgeArticles(token, {
        page: nextPage,
        limit,
        search: nextFilters.search || undefined,
        category: nextFilters.category || undefined,
        status: nextFilters.status || undefined,
      });
      setArticles(response.data);
      setPage(response.meta.page);
      setTotalPages(response.meta.totalPages);
    } catch (fetchError) {
      if (fetchError instanceof ApiError) {
        setError(fetchError.message);
      } else {
        setError('Could not load knowledge base articles.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadArticles(1, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadArticles(1, filters);
  }

  return (
    <PageSection
      title="Knowledge Base"
      subtitle="Manage internal support knowledge articles"
    >
      <form className="filters-grid" onSubmit={onSubmit}>
        <label>
          Search
          <input
            type="text"
            value={filters.search}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, search: event.target.value }))
            }
            placeholder="Search title or content"
          />
        </label>
        <label>
          Category
          <select
            value={filters.category}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                category: event.target.value as FilterState['category'],
              }))
            }
          >
            <option value="">Any</option>
            <option value="HR">HR</option>
            <option value="IT">IT</option>
            <option value="FINANCE">FINANCE</option>
            <option value="OPERATIONS">OPERATIONS</option>
            <option value="CUSTOMER_SUPPORT">CUSTOMER_SUPPORT</option>
            <option value="OTHER">OTHER</option>
          </select>
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
            <option value="DRAFT">DRAFT</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </label>
        <button type="submit" className="btn">
          Apply Filters
        </button>
      </form>

      <div className="inline-links" style={{ marginTop: '0.9rem' }}>
        <Link href="/knowledge-base/new" className="inline-link">
          Create article
        </Link>
      </div>

      {loading ? <p className="helper-text">Loading articles...</p> : null}
      {error ? <p className="warning">{error}</p> : null}
      {!loading && !error && articles.length === 0 ? (
        <p className="helper-text">No articles found for current filters.</p>
      ) : null}

      {!loading && !error && articles.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Chunks</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => (
                  <tr key={article.id}>
                    <td>
                      <Link
                        href={`/knowledge-base/${article.id}`}
                        className="inline-link"
                      >
                        {article.title}
                      </Link>
                    </td>
                    <td>{article.category}</td>
                    <td>{article.status}</td>
                    <td>{article.chunksCount}</td>
                    <td>{new Date(article.updatedAt).toLocaleString()}</td>
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
              onClick={() => void loadArticles(page - 1, filters)}
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
              onClick={() => void loadArticles(page + 1, filters)}
            >
              Next
            </button>
          </div>
        </>
      ) : null}
    </PageSection>
  );
}

