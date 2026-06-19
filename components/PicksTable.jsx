import { useEffect, useMemo, useState } from "react";

export default function PicksTable({ picks = [] }) {
  const pageSize = 25;
  // Visible columns (keep it tight)
  const columns = [
    { key: "Timestamp", label: "Date", hide: "" }, // always show
    { key: "__matchup", label: "Matchup", hide: "" }, // always show
    { key: "Tier", label: "Tier", hide: "hidden sm:table-cell" },
    { key: "Market", label: "Market", hide: "hidden md:table-cell" },
    { key: "Predicted", label: "Pick", hide: "hidden md:table-cell" },
    { key: "Odds (Am)", label: "Odds", hide: "hidden lg:table-cell" },
    { key: "Prediction Result", label: "Result", hide: "" },
    { key: "__pnl", label: "P&L", hide: "hidden xl:table-cell" },
  ];

  // Default: newest first by Timestamp
  const [sortConfig, setSortConfig] = useState({ key: "Timestamp", direction: "desc" });
  const [page, setPage] = useState(1);

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

      if (key === "__pnl") {
        const aVal = Number(String(a.PnL ?? a["P&L"] ?? a.pnl ?? a.Profit ?? "").replace(/[^0-9.-]/g, ""));
        const bVal = Number(String(b.PnL ?? b["P&L"] ?? b.pnl ?? b.Profit ?? "").replace(/[^0-9.-]/g, ""));
        const av = Number.isFinite(aVal) ? aVal : -Infinity;
        const bv = Number.isFinite(bVal) ? bVal : -Infinity;
        return direction === "asc" ? av - bv : bv - av;
      }

      // String sort fallback
      const aVal = (a[key] ?? "").toString().toLowerCase();
      const bVal = (b[key] ?? "").toString().toLowerCase();
      if (aVal < bVal) return direction === "asc" ? -1 : 1;
      if (aVal > bVal) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [picks, sortConfig]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage]);

  useEffect(() => {
    setPage(1);
  }, [picks]);

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

    if (key === "Timestamp") return formatDate(pick[key] || pick["Game Time"] || pick.ts_iso || pick.ts_local);

    if (key === "Odds (Am)") {
      const raw = pick[key] ?? pick["American Odds"] ?? pick.american_odds ?? pick.odds_american;
      const n = Number(String(raw ?? "").replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(n)) return "-";
      return n > 0 ? `+${Math.round(n)}` : String(Math.round(n));
    }

    if (key === "Prediction Result") {
      const raw = pick[key] ?? pick.Result ?? pick.Winner ?? pick.result;
      const s = String(raw ?? "").trim().toLowerCase();
      const label =
        ["win", "won", "w", "1", "true"].includes(s) ? "Win" :
        ["loss", "lose", "lost", "l", "0", "false"].includes(s) ? "Loss" :
        ["push", "p", "void", "refund"].includes(s) ? "Push" :
        raw ? String(raw) : "-";
      const cls =
        label === "Win" ? "bg-emerald-100 text-emerald-700" :
        label === "Loss" ? "bg-rose-100 text-rose-700" :
        label === "Push" ? "bg-amber-100 text-amber-700" :
        "bg-gray-100 text-gray-600";
      return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}>{label}</span>;
    }

    if (key === "__pnl") {
      const raw = pick.PnL ?? pick["P&L"] ?? pick.pnl ?? pick.Profit;
      const n = Number(String(raw ?? "").replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(n)) return "-";
      const cls = n >= 0 ? "text-emerald-700" : "text-rose-700";
      const sign = n < 0 ? "-" : "";
      return <span className={`font-semibold ${cls}`}>{`${sign}$${Math.abs(n).toFixed(2)}`}</span>;
    }

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
            {visibleRows.map((pick, i) => (
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
                  No CLV-graded picks match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-col gap-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <div>
          Showing {sorted.length ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, sorted.length)} of {sorted.length} CLV-graded picks. Click a column header to sort.
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="rounded border bg-white px-3 py-1 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="font-semibold text-slate-600">Page {currentPage} of {pageCount}</span>
          <button
            type="button"
            disabled={currentPage >= pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            className="rounded border bg-white px-3 py-1 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
