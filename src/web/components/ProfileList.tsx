import { useState, type FormEvent } from 'react';
import type { Profile } from '../types';
import { api } from '../api';

interface Props {
  profiles: Profile[];
  onProfilesChange: (profiles: Profile[]) => void;
}

export default function ProfileList({ profiles, onProfilesChange }: Props) {
  const [platform, setPlatform] = useState('github');
  const [handle, setHandle] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const newProfile = await api.linkProfile(platform, handle);
      const updated = profiles.filter((p) => p.platform !== platform).concat(newProfile);
      onProfilesChange(updated);
      setHandle('');
    } catch (err: any) {
      setError(err.message || 'Connection failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteProfile(id);
      onProfilesChange(profiles.filter((p) => p.id !== id));
    } catch (err: any) {
      console.error('Failed to unlink profile:', err);
    }
  };

  return (
    <div className="card">
      <h3>Connected Profiles</h3>
      <p className="section-help" style={{ marginBottom: 16 }}>GitHub, LeetCode, LinkedIn, Twitter</p>
      <ul className="profile-links-list">
        {profiles.length === 0 ? (
          <li style={{ color: 'var(--text-tertiary)', justifyContent: 'center' }}>No external profiles linked.</li>
        ) : (
          profiles.map((p) => (
            <li key={p.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`platform-tag tag-${p.platform}`}>{p.platform}</span>
                <a href={p.url} target="_blank" rel="noreferrer" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                  {p.handle}
                </a>
              </div>
              <button className="btn-delete" onClick={() => handleDelete(p.id)}>Remove</button>
            </li>
          ))
        )}
      </ul>

      <form onSubmit={handleSubmit} className="add-item-form">
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} required>
          <option value="github">GitHub</option>
          <option value="leetcode">LeetCode</option>
          <option value="linkedin">LinkedIn</option>
          <option value="twitter">Twitter</option>
        </select>
        <input type="text" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Handle / Username" required />
        <button type="submit" className="btn btn-sm">Connect</button>
      </form>
      {error && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
