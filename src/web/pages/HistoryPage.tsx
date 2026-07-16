import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import CurationCard from '../components/CurationCard';
import EmptyState from '../components/EmptyState';
import { api } from '../api';

export default function HistoryPage() {
  const { curations, refreshCurations } = useAuth();
  const [clearing, setClearing] = useState(false);

  const unrated = curations.filter((c) => !c.feedback);
  const history = unrated.slice(5);

  const handleClear = async () => {
    setClearing(true);
    try {
      await api.clearHistory();
      await refreshCurations();
    } catch (err: any) {
      console.error('Failed to clear history:', err);
    } finally {
      setClearing(false);
    }
  };

  return (
    <section className="page-panel">
      <div className="feed-header-section">
        <div className="header-align">
          <div>
            <h2 className="page-title">Feed History</h2>
            <p className="section-help">Older unrated curation history.</p>
          </div>
          <button onClick={handleClear} disabled={clearing} className="btn btn-danger btn-sm">
            {clearing ? 'Clearing...' : 'Clear History'}
          </button>
        </div>
      </div>

      <div className="feed-grid">
        {history.length === 0 ? (
          <EmptyState message="No historical signals." />
        ) : (
          history.map((c) => <CurationCard key={c.id} curation={c} />)
        )}
      </div>
    </section>
  );
}
