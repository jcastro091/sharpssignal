import { useState, useEffect } from "react";
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import PicksTable from "../components/PicksTable";
import { calculateROI } from "../utils/roi";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from "recharts";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const COLORS = ["#ef4444", "#22c55e"];

export default function PicksPage({ picks = [] }) {
  const [mounted, setMounted] = useState(false);
  const [bankroll, setBankroll] = useState(1000);
  const [kellyFraction, setKellyFraction] = useState(1);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [sportFilter, setSportFilter] = useState("All");

  useEffect(() => setMounted(true), []);

  const uniqueSports = ["All", ...new Set(picks.map(p => p.Sport || "Unknown"))];

  const filtered = picks.filter(pick => {
    const gameTime = new Date(pick["Game Time"]);
    const matchDate =
      (!startDate || gameTime >= startDate) &&
      (!endDate || gameTime <= endDate);
    const matchSport = sportFilter === "All" || pick.Sport === sportFilter;
    return matchDate && matchSport;
  });

  const {
    history: roiData,
    roiPercent,
    winRate,
    profit,
    drawdown,
    winCount,
    lossCount
  } = calculateROI(filtered);

  const pieData = [
    { name: "Losses", value: lossCount },
    { name: "Wins", value: winCount }
  ];

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">Your Confirmed Picks</h1>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <DatePicker
            selected={startDate}
            onChange={date => setStartDate(date)}
            className="w-full px-4 py-2 border rounded bg-white"
            placeholderText="Select start date"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <DatePicker
            selected={endDate}
            onChange={date => setEndDate(date)}
            className="w-full px-4 py-2 border rounded bg-white"
            placeholderText="Select end date"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Sport</label>
          <select
            value={sportFilter}
            onChange={e => setSportFilter(e.target.value)}
            className="w-full px-4 py-2 border rounded bg-white"
          >
            {uniqueSports.map((sport, i) => (
              <option key={i} value={sport}>
                {sport}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bankroll / Kelly */}
      <div className="bg-white p-6 rounded-xl shadow border mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">Bankroll ($)</label>
            <input
              type="number"
              className="w-full px-4 py-2 border rounded-lg bg-gray-50"
              value={bankroll}
              onChange={e => setBankroll(parseFloat(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Kelly Fraction (0–1)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              className="w-full px-4 py-2 border rounded-lg bg-gray-50"
              value={kellyFraction}
              onChange={e => setKellyFraction(parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 mb-10">
        <StatCard label="ROI" value={`${roiPercent >= 0 ? "+" : ""}${roiPercent.toFixed(2)}%`} color={roiPercent >= 0 ? "text-green-500" : "text-red-500"} />
        <StatCard label="Win Rate" value={`${winRate.toFixed(2)}%`} color="text-blue-500" />
        <StatCard label="Profit" value={`$${profit.toLocaleString()}`} color="text-green-600" />
        <StatCard label="Max Drawdown" value={`-$${drawdown.toLocaleString()}`} color="text-orange-500" />
      </div>

      {/* Chart Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <ChartCard title="ROI Simulator">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={roiData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" hide />
              <YAxis domain={["auto", "auto"]} />
              <Tooltip />
              <Line type="monotone" dataKey="bankroll" stroke="#8884d8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Win vs Loss Distribution">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} label dataKey="value">
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Table */}
      {mounted && <PicksTable picks={filtered} />}
    </div>
  );
}

// ── Components ─────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow border">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white p-4 rounded-xl shadow border">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}

// ── Supabase Loader ──────────────────────────
export async function getServerSideProps(ctx) {
  const supabase = createServerSupabaseClient(ctx)
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return {
      redirect: { destination: '/signin', permanent: false },
    }
  }

  const { GoogleAuth } = await import("google-auth-library");
  const { google } = await import("googleapis");

  const rawUrl = process.env.SPREADSHEET_URL;
  const m = rawUrl.match(/\/d\/([^\/]+)/);
  if (!m) throw new Error("Invalid SPREADSHEET_URL");
  const spreadsheetId = m[1];

  const auth = new GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "AllBets!A:Z",
  });

  if (!data || !data.values || data.values.length === 0) {
    return { props: { picks: [] } };
  }

  const [header, ...rows] = data.values;
  const picks = rows
    .map(row => Object.fromEntries(row.map((cell, i) => [header[i], cell])))
    .filter(pick => {
      const gt = pick["Game Time"];
      return gt && !isNaN(new Date(gt));
    });

  return { props: { picks } };
}
