export default function Spinner({ text }: { text?: string }) {
  return (
    <div className="loader-container">
      <div className="spinner" />
      {text && <p>{text}</p>}
    </div>
  );
}
