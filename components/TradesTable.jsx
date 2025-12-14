import { useState } from "react";

export default function TradesTable({ trades }) {
  const columns = [
    { key: "Timestamp", label: "Date" },
    { key: "Symbol", label: "Symbol" },
    { key: "Trade Direction", label: "Side" },
    { key: "Entry Price", label: "Entry" },
    { key: "Exit Price", label: "Exit" },
    { key: "SL", label: "Stop Loss" },
    { key: "TP", label: "Take Profit" },
    { key: "RR", label: "R:R" },
    { key: "Result", label: "Result" },
    { key: "Confidence", label: "Confidence" },
    { key: "Posted?", label: "Plan" }
  ];

  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const sorted = [...trades].sort((a, b) => {
    const key = sortConfig.key;
    if (!key) return 0;
    const aVal = a[key] || '';
    const bVal = b[key] || '';
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const requestSort = key => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="overflow-x-auto w-full">
      <table className="min-w-full bg-white border text-sm">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                onClick={() => requestSort(col.key)}
                className="text-left p-2 border-b font-medium cursor-pointer hover:underline"
              >
                {col.label}
                {sortConfig.key === col.key ? (sortConfig.direction === "asc" ? " ▲" : " ▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((trade, i) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              {columns.map(col => (
                <td key={col.key} className="p-2 whitespace-nowrap">
                  {trade[col.key] || "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
