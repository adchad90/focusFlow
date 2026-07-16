import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import InterestTags from '../components/InterestTags';
import { api } from '../api';

export default function InterestsPage() {
  const { user, setUser, refreshCurations } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handleSave = async (interests: string) => {
    setSaving(true);
    try {
      const updated = await api.updateRules({
        interests,
        noise: user.noise || '',
        frequency: user.frequency || 'daily',
      });
      setUser({ ...user, interests: updated.interests });
      navigate('/feed');
      await api.triggerCuration();
      await refreshCurations();
    } catch (err: any) {
      console.error('Failed to save interests:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page-panel">
      <div>
        <h2 className="page-title">Interest Profile</h2>
        <p className="section-help">Select the topics you want FocusFlow to prioritize.</p>
      </div>
      <InterestTags initialInterests={user.interests || ''} onSave={handleSave} saving={saving} />
    </section>
  );
}
