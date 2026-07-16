import { useState } from 'react';

const PREDEFINED_TAGS = [
  'Cybersecurity', 'Crypto', 'AI', 'ML', 'Blockchain',
  'LinkedIn Jobs', 'LinkedIn Profiles',
];

interface Props {
  initialInterests: string;
  onSave: (interests: string) => Promise<void>;
  saving: boolean;
}

export default function InterestTags({ initialInterests, onSave, saving }: Props) {
  const [selectedTags, setSelectedTags] = useState<Set<string>>(() => {
    const tags = new Set<string>();
    const parts = initialInterests.split(',').map((s) => s.trim()).filter(Boolean);
    const othersParts: string[] = [];
    for (const part of parts) {
      const matched = PREDEFINED_TAGS.find((t) => t.toLowerCase() === part.toLowerCase());
      if (matched) tags.add(matched);
      else othersParts.push(part);
    }
    if (othersParts.length > 0) {
      tags.add('Others');
    }
    return tags;
  });

  const [othersText, setOthersText] = useState(() => {
    const parts = initialInterests.split(',').map((s) => s.trim()).filter(Boolean);
    const othersParts = parts.filter((p) => !PREDEFINED_TAGS.some((t) => t.toLowerCase() === p.toLowerCase()));
    return othersParts.join(', ');
  });

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const handleSave = async () => {
    const interestsList: string[] = [];
    for (const tag of selectedTags) {
      if (tag !== 'Others') interestsList.push(tag);
    }
    if (selectedTags.has('Others') && othersText.trim()) {
      interestsList.push(othersText.trim());
    }
    await onSave(interestsList.join(', '));
  };

  return (
    <div className="card select-interests-card">
      <div className="tags-grid">
        {PREDEFINED_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            className={`tag-toggle-btn${selectedTags.has(tag) ? ' selected' : ''}`}
            onClick={() => toggleTag(tag)}
          >
            {tag}
          </button>
        ))}
        <button
          type="button"
          className={`tag-toggle-btn${selectedTags.has('Others') ? ' selected' : ''}`}
          onClick={() => toggleTag('Others')}
        >
          Others
        </button>
      </div>

      {selectedTags.has('Others') && (
        <div className="others-container">
          <label htmlFor="interests-others-text">Specify other custom guidelines</label>
          <textarea
            id="interests-others-text"
            rows={4}
            value={othersText}
            onChange={(e) => setOthersText(e.target.value)}
            placeholder="Enter other topics, technologies, or rules you care about..."
          />
        </div>
      )}

      <div className="panel-actions">
        <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
          {saving ? 'Saving...' : 'Run Curation Now'}
        </button>
      </div>
    </div>
  );
}
