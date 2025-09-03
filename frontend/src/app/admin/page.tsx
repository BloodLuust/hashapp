"use client";
import { useState } from "react";

interface User {
  id: number;
  email: string;
}

const users: User[] = [
  { id: 1, email: "user@example.com" },
];

export default function AdminPage() {
  const [filter, setFilter] = useState("");

  return (
    <div className="p-6 space-y-6">
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter users"
        className="border p-2"
      />

      <div>
        <h2 className="text-lg font-semibold">Users</h2>
        <ul>
          {users
            .filter((u) => u.email.includes(filter))
            .map((u) => (
              <li key={u.id} className="border-b py-1">
                {u.email}
              </li>
            ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded border p-4">
          <h3 className="font-medium">API Error Rate</h3>
          <p className="text-2xl">0%</p>
        </div>
        <div className="rounded border p-4">
          <h3 className="font-medium">Provider Failover</h3>
          <p className="text-2xl">OK</p>
        </div>
        <div className="rounded border p-4">
          <h3 className="font-medium">Circuit Breaker</h3>
          <p className="text-2xl">Closed</p>
        </div>
      </div>
    </div>
  );
}
