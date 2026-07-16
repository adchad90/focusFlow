import { useAuth } from '../context/AuthContext';
import CurationCard from '../components/CurationCard';
import EmptyState from '../components/EmptyState';

export default function LikedPage() {
  const { curations } = useAuth();
  const liked = curations.filter((c) => c.feedback && c.feedback.rating === 10);

  return (
    <section className="page-panel">
      <div className="feed-header-section">
        <div>
          <h2 className="page-title">Previously Liked</h2>
          <p className="section-help">Articles you marked as high value.</p>
        </div>
      </div>

      <div className="feed-grid">
        {liked.length === 0 ? (
          <EmptyState message="No liked articles yet." />
        ) : (
          liked.map((c) => <CurationCard key={c.id} curation={c} />)
        )}
      </div>
    </section>
  );
}
