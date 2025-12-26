import { useMemo, useState } from "react";

export default function PicksTable({ picks = [] }) {
  // Visible columns (keep it tight)
  const columns = [
    { key: "Timestamp", label: "Date", hide: "" }, // always show
    { key: "__matchup", label: "Matchup", hide: "" }, // always show
    { key: "Tier", label: "Tier", hide: "hidden sm:table-cell" },
    { key: "Market", label: "Market", hide: "hidden md:table-cell" },
    { key: "Direction", label: "Side", hide: "hidden md:table-cell" },
    { key: "Predicted", label: "Prediction", hide: "hidden lg:table-cell" },
    { key: "Prediction Result", label: "Result", hide: "hidden xl:table-cell" },
  ];

  // Default: newest first by Timestamp
  const [sortConfig, setSortConfig] = useState({ key: "Timestamp", direction: "desc" });

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  // Parse date safely for sorting
  const parseDate = (v) => {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : v;

    const s = String(v).trim().replace(" ", "T"); // handle "YYYY-MM-DD HH:mm:ss+00:00"
    const d = new Date(s);
    return isNaN(d) ? null : d;
  };

  const sorted = useMemo(() => {
    const arr = Array.isArray(picks) ? [...picks] : [];
    const { key, direction } = sortConfig;

    return arr.sort((a, b) => {
      // Special computed column
      if (key === "__matchup") {
        const aVal = `${a["Away Team"] || a.Away || ""} @ ${a["Home Team"] || a.Home || ""}`.toLowerCase();
        const bVal = `${b["Away Team"] || b.Away || ""} @ ${b["Home Team"] || b.Home || ""}`.toLowerCase();
        if (aVal < bVal) return direction === "asc" ? -1 : 1;
        if (aVal > bVal) return direction === "asc" ? 1 : -1;
        return 0;
      }

      // Date-aware sort for Timestamp / Game Time
      if (key === "Timestamp" || key === "Game Time") {
        const ad = parseDate(a[key]);
        const bd = parseDate(b[key]);
        const at = ad ? ad.getTime() : -Infinity;
        const bt = bd ? bd.getTime() : -Infinity;
        return direction === "asc" ? at - bt : bt - at;
      }

      // String sort fallback
      const aVal = (a[key] ?? "").toString().toLowerCase();
      const bVal = (b[key] ?? "").toString().toLowerCase();
      if (aVal < bVal) return direction === "asc" ? -1 : 1;
      if (aVal > bVal) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [picks, sortConfig]);

  const formatDate = (v) => {
    const d = parseDate(v);
    if (!d) return "-";
    // nice compact local display
    return new Intl.DateTimeFormat("en-US", {
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  };

  const renderCell = (pick, key) => {
	  
	if (key === "Tier") {
	  const t = (pick.Tier ?? "-").toString();
	  const isA = t === "A";
	  const isB = t === "B";
	  const isC = t === "C";

	  const cls =
		isA ? "bg-green-100 text-green-700" :
		isB ? "bg-yellow-100 text-yellow-700" :
		isC ? "bg-gray-100 text-gray-700" :
		"bg-gray-50 text-gray-600";

	  return (
		<span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
		  {t}
		</span>
	  );
	}
		  
	  
	  
    if (key === "__matchup") {
      const away = pick["Away Team"] || pick.Away || "-";
      const home = pick["Home Team"] || pick.Home || "-";
      const sport = pick.Sport || "-";
      const market = pick.Market || "-";
      const side = pick.Direction || pick.Predicted || "-";

      return (
        <div className="min-w-0">
          <div className="font-medium truncate">{away} @ {home}</div>
          <div className="text-xs text-gray-500 truncate">
            {sport} • {market} • {side}
          </div>
        </div>
      );
    }

    if (key === "Timestamp") return formatDate(pick[key]);

    const val = pick[key];
    if (val === null || val === undefined || val === "") return "-";
    return String(val);
  };

  return (
    <div className="w-full">
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => requestSort(col.key)}
                  className={`text-left px-3 py-2 border-b font-semibold cursor-pointer select-none ${col.hide}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortConfig.key === col.key ? (
                      <span className="text-xs text-gray-500">
                        {sortConfig.direction === "asc" ? "▲" : "▼"}
                      </span>
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sorted.map((pick, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 align-top ${col.hide}`}
                  >
                    {/* Truncate most cells to avoid width blowouts */}
                    <div className={col.key === "__matchup" ? "" : "truncate"}>
                      {renderCell(pick, col.key)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}

            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-gray-500">
                  No picks match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500 mt-2">
        Tip: click a column header to sort.
      </div>
    </div>
  );
}
