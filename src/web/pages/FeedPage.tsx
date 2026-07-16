import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import CurationCard from '../components/CurationCard';
import EmptyState from '../components/EmptyState';
import { api } from '../api';

export default function FeedPage() {
  const { curations, refreshCurations } = useAuth();
  const [loading, setLoading] = useState(false);

  const unrated = curations.filter((c) => !c.feedback);
  const feed = unrated.slice(0, 5);

  const handleTrigger = async () => {
    setLoading(true);
    try {
      await api.triggerCuration();
      await refreshCurations();
    } catch (err: any) {
      console.error('Curation trigger failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page-panel">
      <div className="feed-header-section">
        <div className="header-align">
          <div>
            <h2 className="page-title">Curated Signals</h2>
            <p className="section-help">Real-time synthesized results filtered through Gemini AI.</p>
          </div>
          <button onClick={handleTrigger} disabled={loading} className="btn btn-primary btn-sm">
            {loading ? 'Processing...' : 'Run Curation'}
          </button>
        </div>
      </div>

      <div className="feed-grid">
        {feed.length === 0 ? (
          <EmptyState message="No new signals available." />
        ) : (
          feed.map((c) => <CurationCard key={c.id} curation={c} />)
        )}
      </div>
    </section>
  );
}
