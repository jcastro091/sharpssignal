import { useState, useEffect } from "react";
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import PicksTable from "../components/PicksTable";
import { calculateROI } from "../utils/roi";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import DatePicker from "react-datepicker";
import TradesTable from "../components/TradesTable";
import "react-datepicker/dist/react-datepicker.css";


export default function PicksPage({ picks = [], trades = [] }) {

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
    drawdown
  } = calculateROI(filtered);
  
  const [viewMode, setViewMode] = useState('picks'); // default to picks view


  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen p-4 sm:p-8">
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
              <option key={i} value={sport}>{sport}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Kelly / Bankroll */}
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

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 mb-10">
        <StatCard label="ROI" value={`${roiPercent >= 0 ? "+" : ""}${roiPercent.toFixed(2)}%`} color={roiPercent >= 0 ? "text-green-500" : "text-red-500"} />
        <StatCard label="Win Rate" value={`${winRate.toFixed(2)}%`} color="text-blue-500" />
        <StatCard label="Profit" value={`$${profit.toLocaleString()}`} color="text-green-600" />
        <StatCard label="Max Drawdown" value={`-$${drawdown.toLocaleString()}`} color="text-orange-500" />
      </div>

      {/* ROI Chart */}
      <div className="bg-white p-4 rounded-xl shadow border mb-10">
        <h3 className="text-lg font-semibold mb-3">ROI Simulator</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={roiData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" hide />
            <YAxis domain={["auto", "auto"]} />
            <Tooltip />
            <Line type="monotone" dataKey="bankroll" stroke="#8884d8" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
	  
	  <div className="flex space-x-2 mb-4">
	    <button onClick={() => setViewMode('picks')} className={`px-4 py-2 rounded ${viewMode === 'picks' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>Picks</button>
	    <button onClick={() => setViewMode('trades')} className={`px-4 py-2 rounded ${viewMode === 'trades' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>Trades</button>
	  </div>


      {/* Picks Table */}
	  {mounted && viewMode === 'picks' && <PicksTable picks={filtered} />}
	  {mounted && viewMode === 'trades' && <TradesTable trades={trades} />}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow border">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const supabase = createServerSupabaseClient(ctx);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return {
      redirect: { destination: '/signin', permanent: false },
    };
  }

  const protocol = ctx.req.headers['x-forwarded-proto'] || 'http';
  const host = ctx.req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  
  
  const [picksRes, tradesRes] = await Promise.all([
    fetch(`${baseUrl}/api/picks`, { headers: { cookie: ctx.req.headers.cookie || '' } }),
    fetch(`${baseUrl}/api/trades`, { headers: { cookie: ctx.req.headers.cookie || '' } }),
  ]);
    
  let picks = [], trades = [];
  try {
    const picksData = await picksRes.json();
    picks = Array.isArray(picksData.picks) ? picksData.picks.map(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v ?? null]))) : [];
    
    let tradesData = {};
	try {
	  tradesData = await tradesRes.json();
	  console.log("✅ Trades JSON parsed:", tradesData);
	} catch (err) {
	  console.error("❌ Failed to parse trades JSON:", err);
	}

    trades = Array.isArray(tradesData.trades) ? tradesData.trades.map(t => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v ?? null]))) : [];
  } catch (err) {
    console.error("❌ Error parsing picks/trades:", err);
  }

  return { props: { picks, trades } };

}
