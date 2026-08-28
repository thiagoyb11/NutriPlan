import { useMemo, useState, type ReactNode } from "react";

interface PickerProps<T extends { id: number }> {
  items: T[];
  labelOf: (item: T) => string;
  onPick: (item: T) => void;
  placeholder: string;
  renderEmpty?: (query: string, clear: () => void) => ReactNode;
}

export default function Picker<T extends { id: number }>({
  items,
  labelOf,
  onPick,
  placeholder,
  renderEmpty,
}: PickerProps<T>) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("es");
    return value
      ? items
          .filter((item) =>
            labelOf(item).toLocaleLowerCase("es").includes(value),
          )
          .slice(0, 12)
      : [];
  }, [items, labelOf, query]);

  const pick = (item: T) => {
    onPick(item);
    setQuery("");
  };

  return (
    <>
      <input
        value={query}
        placeholder={placeholder}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="picker-results">
        {matches.map((item) => (
          <button
            type="button"
            className="choice"
            key={item.id}
            onClick={() => pick(item)}
          >
            {labelOf(item)}
          </button>
        ))}
        {query.trim() &&
          !matches.length &&
          renderEmpty?.(query.trim(), () => setQuery(""))}
      </div>
    </>
  );
}
