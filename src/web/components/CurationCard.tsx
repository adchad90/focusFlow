import { useState } from 'react';
import type { Curation } from '../types';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

interface Props {
  curation: Curation;
}

export default function CurationCard({ curation }: Props) {
  const { setCurations } = useAuth();
  const [rating, setRating] = useState<number | null>(curation.feedback?.rating ?? null);

  const handleRate = async (score: number) => {
    try {
      await api.rateCuration(curation.id, score);
      setRating(score);
      setCurations((prev) =>
        prev.map((c) =>
          c.id === curation.id ? { ...c, feedback: { id: '', curationId: c.id, userId: '', rating: score } } : c
        )
      );
    } catch (err) {
      console.error('Failed to rate curation:', err);
    }
  };

  return (
    <div className="curation-card">
      <div className="curation-header">
        <a href={curation.url} target="_blank" rel="noreferrer" className="curation-title-link">
          {curation.title}
        </a>
      </div>

      <div className="curation-meta">
        <span>{curation.source}</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span>{new Date(curation.createdAt).toLocaleString()}</span>
      </div>

      <div className="curation-body">{curation.summary}</div>

      <div className="curation-feedback">
        <span className="feedback-label">Was this useful?</span>
        <div className="thumbs-bar">
          <button
            className={`thumb-btn${rating === 10 ? ' selected' : ''}`}
            title="Relevant"
            onClick={() => handleRate(10)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
          </button>
          <button
            className={`thumb-btn${rating === 0 ? ' selected' : ''}`}
            title="Noise"
            onClick={() => handleRate(0)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
