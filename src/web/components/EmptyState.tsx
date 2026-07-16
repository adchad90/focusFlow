export default function EmptyState({ message }: { message: string }) {
  return (
    <div className="empty-feed">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: 12 }}>
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12h8" />
      </svg>
      <p>{message}</p>
    </div>
  );
}
