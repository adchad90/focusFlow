import { useState, type FormEvent } from 'react';
import type { Source } from '../types';
import { api } from '../api';

interface Props {
  sources: Source[];
  onSourcesChange: (sources: Source[]) => void;
}

export default function SourceList({ sources, onSourcesChange }: Props) {
  const [type, setType] = useState('subreddit');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const newSource = await api.addSource(type, value);
      onSourcesChange([...sources, newSource]);
      setValue('');
    } catch (err: any) {
      setError(err.message || 'Failed to add source');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteSource(id);
      onSourcesChange(sources.filter((s) => s.id !== id));
    } catch (err: any) {
      console.error('Failed to delete source:', err);
    }
  };

  return (
    <div className="card">
      <h3>Subreddits &amp; RSS Feeds</h3>
      <p className="section-help" style={{ marginBottom: 16 }}>Add the subreddits or RSS feeds FocusFlow will monitor.</p>
      <ul className="sources-list">
        {sources.length === 0 ? (
          <li style={{ color: 'var(--text-tertiary)', justifyContent: 'center' }}>No custom feeds registered.</li>
        ) : (
          sources.map((s) => (
            <li key={s.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="source-tag">{s.type}</span>
                <span style={{ fontWeight: 500 }}>{s.type === 'subreddit' ? `r/${s.value}` : s.value}</span>
              </div>
              <button className="btn-delete" onClick={() => handleDelete(s.id)}>Remove</button>
            </li>
          ))
        )}
      </ul>

      <form onSubmit={handleSubmit} className="add-item-form">
        <select value={type} onChange={(e) => setType(e.target.value)} required>
          <option value="subreddit">Subreddit</option>
          <option value="rss">RSS Feed URL</option>
        </select>
        <input type="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. typescript or feed URL" required />
        <button type="submit" className="btn btn-sm">Add</button>
      </form>
      {error && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
