
import { useState } from "react";

export default function PicksTable({ picks }) {
  const columns = [
    { key: "Timestamp", label: "Date" },
    { key: "Sport", label: "Sport" },
    { key: "Away Team", label: "Away" },
    { key: "Home Team", label: "Home" },
    { key: "Market", label: "Market" },
    { key: "Direction", label: "Side" },
    { key: "Predicted", label: "Prediction" },
    { key: "Game Time", label: "Game Time" },
    { key: "Tags", label: "Tags" },
    { key: "Actual Winner", label: "Winner" },
    { key: "Prediction Result", label: "Result" },
    { key: "Kelly", label: "Kelly %" },
    { key: "Confidence", label: "Confidence" },
    { key: "Plan", label: "Plan" },
    { key: "Odds Taken", label: "Odds" }
  ];

  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const sorted = [...picks].sort((a, b) => {
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
          {sorted.map((pick, i) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              {columns.map(col => (
                <td key={col.key} className="p-2 whitespace-nowrap">
                  {pick[col.key] || "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
