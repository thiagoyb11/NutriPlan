interface SearchHeaderProps {
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  action: () => void;
  actionLabel: string;
}

export default function SearchHeader({
  query,
  onQuery,
  placeholder,
  action,
  actionLabel,
}: SearchHeaderProps) {
  return (
    <section className="hero">
      <input
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <button type="button" onClick={action}>
        {actionLabel}
      </button>
    </section>
  );
}
