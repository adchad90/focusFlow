import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProfileList from '../components/ProfileList';
import SourceList from '../components/SourceList';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleProfilesChange = (profiles: typeof user.profiles) => {
    setUser({ ...user, profiles });
  };

  const handleSourcesChange = (sources: typeof user.sources) => {
    setUser({ ...user, sources });
  };

  return (
    <section className="page-panel">
      <div>
        <h2 className="page-title">Connected Profiles</h2>
        <p className="section-help">Add your accounts on public platforms to pull and analyze your personal feed updates.</p>
      </div>

      <div className="profile-layout">
        <ProfileList profiles={user.profiles} onProfilesChange={handleProfilesChange} />
        <SourceList sources={user.sources} onSourcesChange={handleSourcesChange} />
      </div>

      <div className="panel-actions">
        <button onClick={() => navigate('/interests')} className="btn btn-primary btn-sm">Next: Interests</button>
      </div>
    </section>
  );
}
