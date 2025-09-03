"use client";
import { useState } from "react";
import { ColumnDef, useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface HistoryEntry {
  id: number;
  mode: string;
  status: string;
}

const historyData: HistoryEntry[] = [
  { id: 1, mode: "Random", status: "Complete" },
  { id: 2, mode: "Range", status: "Running" },
];

const chartData = [
  { month: "Jan", tx: 30, utxo: 12 },
  { month: "Feb", tx: 40, utxo: 15 },
  { month: "Mar", tx: 20, utxo: 8 },
];

export default function DashboardPage() {
  const [mode, setMode] = useState("Random Private Keys");
  const [chain, setChain] = useState("Bitcoin");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [xpub, setXpub] = useState("");

  const columns: ColumnDef<HistoryEntry>[] = [
    { accessorKey: "id", header: "ID" },
    { accessorKey: "mode", header: "Mode" },
    { accessorKey: "status", header: "Status" },
  ];
  const table = useReactTable({ data: historyData, columns, getCoreRowModel: getCoreRowModel() });

  async function startScan() {
    await fetch("/api/scan", { method: "POST" });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-4">
        <select value={mode} onChange={(e) => setMode(e.target.value)} className="border p-2">
          <option>Random Private Keys</option>
          <option>Hex Range</option>
          <option>XPUB/YPUB/ZPUB</option>
        </select>

        {mode === "Hex Range" && (
          <div className="space-x-2">
            <input
              type="text"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              placeholder="Start"
              className="border p-2"
            />
            <input
              type="text"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              placeholder="End"
              className="border p-2"
            />
          </div>
        )}

        {mode === "XPUB/YPUB/ZPUB" && (
          <input
            type="text"
            value={xpub}
            onChange={(e) => setXpub(e.target.value)}
            placeholder="XPUB/YPUB/ZPUB"
            className="w-full border p-2"
          />
        )}

        <select value={chain} onChange={(e) => setChain(e.target.value)} className="border p-2">
          <option>Bitcoin</option>
          <option>Litecoin</option>
          <option>Dogecoin</option>
          <option>Ethereum</option>
        </select>

        <button onClick={startScan} className="bg-blue-600 px-4 py-2 text-white">
          Start Scan
        </button>
      </div>

      <div className="h-48 overflow-y-auto border p-2" id="stream">
        <p className="text-sm text-gray-500">Live stream will appear here...</p>
      </div>

      <table className="w-full border">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="border p-2 text-left">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="border p-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="tx" stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="utxo" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
