import { useMemo, useState } from "react";

export default function Picker({
  items,
  labelOf,
  onPick,
  placeholder,
  renderEmpty,
}) {
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

  const pick = (item) => {
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
