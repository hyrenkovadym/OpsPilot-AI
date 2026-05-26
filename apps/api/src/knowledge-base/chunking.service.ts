import { Injectable } from '@nestjs/common';

export interface ChunkedContent {
  chunkIndex: number;
  content: string;
  tokensEstimate?: number;
}

@Injectable()
export class ChunkingService {
  chunkText(content: string, maxChunkChars = 800): ChunkedContent[] {
    const normalized = content.replace(/\r\n/g, '\n').trim();
    if (normalized.length === 0) {
      return [];
    }

    const paragraphs = normalized
      .split('\n')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    const chunks: string[] = [];
    let current = '';

    for (const paragraph of paragraphs) {
      if (paragraph.length > maxChunkChars) {
        if (current.length > 0) {
          chunks.push(current.trim());
          current = '';
        }

        for (let index = 0; index < paragraph.length; index += maxChunkChars) {
          const piece = paragraph.slice(index, index + maxChunkChars).trim();
          if (piece.length > 0) {
            chunks.push(piece);
          }
        }
        continue;
      }

      const candidate =
        current.length > 0 ? `${current}\n${paragraph}` : paragraph;
      if (candidate.length > maxChunkChars) {
        chunks.push(current.trim());
        current = paragraph;
      } else {
        current = candidate;
      }
    }

    if (current.length > 0) {
      chunks.push(current.trim());
    }

    return chunks
      .map((chunk, chunkIndex) => ({
        chunkIndex,
        content: chunk,
        tokensEstimate: Math.max(1, Math.round(chunk.length / 4)),
      }))
      .filter((chunk) => chunk.content.length > 0);
  }
}
