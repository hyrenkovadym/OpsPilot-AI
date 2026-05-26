# OpsPilot AI Simple RAG Notes (v1.0.0)

## What "Simple RAG" Means Here
This project uses a lightweight retrieval-augmented approach without a vector database yet.

Flow:
1. ticket text becomes retrieval query
2. relevant published KB chunks are selected deterministically
3. chunks are passed to AI provider analysis
4. AI result and source references are returned/stored on ticket

## Knowledge Base Lifecycle
- `DRAFT`
- `PUBLISHED`
- `ARCHIVED`

Only `PUBLISHED` articles are used in ticket AI retrieval context.

## Chunking
- ordered chunks by `chunkIndex`
- target size around ~800 chars
- empty chunks are ignored
- optional token estimate stored

## Retrieval Strategy
Deterministic scoring signals:
- keyword overlap with chunk content
- title match boost
- category boost
- content overlap

Top-N result fields:
- `articleId`
- `articleTitle`
- `chunkContent`
- `score`

## AI Provider Behavior with Context
### Mock provider
- default mode (`AI_PROVIDER=mock`)
- deterministic and test-safe
- includes context-aware recommendation language

### OpenAI-compatible provider
- optional (`AI_PROVIDER=openai`)
- includes context chunks in prompt
- validated structured JSON output required

## Security and Observability Notes (Phase 7)
- secrets/API keys are never logged
- requestId is attached to related audit metadata where applicable
- logs avoid full prompt/full KB raw content dumping

## Current Limitations
- no embeddings/vector similarity yet
- no reranker layer
- no advanced citation calibration

## Planned Upgrade Path
Future phase can add:
1. pgvector or external vector DB
2. embedding generation
3. reranking and citation quality scoring
