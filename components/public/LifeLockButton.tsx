"use client";

import { useState } from "react";

export function LifeLockButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function lock() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/life/lock", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("lock failed");
      window.location.replace("/life");
    } catch {
      setError("暂时无法锁定，请重试。");
      setLoading(false);
    }
  }

  return <div className="life-lock-control"><button className="life-lock-button" type="button" onClick={lock} disabled={loading}>{loading ? "正在锁定…" : "锁定生活"}</button>{error && <span className="life-gate-error" role="alert">{error}</span>}</div>;
}
