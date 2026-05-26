# OpsPilot AI Simple RAG Notes (Phase 4)

## What "Simple RAG" Means Here
This phase adds retrieval-augmented behavior without introducing heavy vector infrastructure.

The flow is:
1. ticket text is used as retrieval query
2. relevant knowledge chunks are fetched deterministically
3. chunks are passed into AI provider analysis
4. AI result and source references are returned/stored

## Knowledge Base Lifecycle
- Articles start as `DRAFT`
- Published via `POST /knowledge-base/articles/:id/publish`
- Archived via `POST /knowledge-base/articles/:id/archive`
- Only `PUBLISHED` articles are used for ticket AI context retrieval

## Chunking
- Content is split into ordered chunks (`chunkIndex`)
- Chunk size is lightweight (~800 chars default)
- Empty chunks are ignored
- Optional token estimate is stored

## Retrieval Strategy
`RetrievalService` computes deterministic score from:
- keyword overlap with chunk content
- title match boost
- article content match
- category boost

Top-N results are returned with:
- `articleId`
- `articleTitle`
- `chunkContent`
- `score`

## AI Provider Behavior with Context

### Mock Provider
- default mode (`AI_PROVIDER=mock`)
- deterministic and test-safe
- context-aware summary/recommendation when retrieved chunks exist

### OpenAI-Compatible Provider
- optional (`AI_PROVIDER=openai`)
- includes retrieved chunks in prompt
- instructed to avoid inventing missing policy details
- validated structured JSON output required

## Safety and Logging
- Secrets/API keys are never logged
- Audit captures safe metadata:
  - retrieval count
  - source article IDs
  - provider used
  - confidence and category/priority changes

## Current Limitations
- No semantic embeddings/vector similarity yet
- No async/background indexing pipeline
- No citation confidence calibration beyond deterministic scoring

## Planned Upgrade Path
Future phases can introduce:
1. pgvector or external vector DB
2. embedding generation pipeline
3. async chunk indexing with BullMQ
4. stronger retrieval/reranking strategies
