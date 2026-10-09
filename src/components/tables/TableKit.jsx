// Shared table controls (reference: sortable th buttons with ↓ ↑ ⇅, and the pager).

// Column header that sorts. sort = { key, dir: "asc" | "desc" }.
export function SortHeader({ label, sortKey, sort, onSort, className = "" }) {
  const active = sort.key === sortKey;
  const arrow = active ? (sort.dir === "asc" ? "↓" : "↑") : "⇅";
  return (
    <th className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="sort-btn" data-active={active} onClick={() => onSort(sortKey)}>
        {label} <span aria-hidden="true">{arrow}</span>
      </button>
    </th>
  );
}

// Clicking the active column flips the direction; a new column starts ascending.
export function nextSort(sort, key) {
  return sort.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" };
}

export function Pager({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pager">
      <span>Page {Math.min(page + 1, pages)} of {pages}</span>
      <span className="flex gap-1.5">
        <button type="button" disabled={page <= 0} onClick={() => onPage(page - 1)}>Previous</button>
        <button type="button" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Next</button>
      </span>
    </div>
  );
}
