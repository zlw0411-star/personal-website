"use client";

import { useState, type FormEvent } from "react";

export function LifeGate({ returnTo = "/life" }: { returnTo?: string }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !password) return;
    setLoading(true);
    setError("");
    let response: Response;
    try {
      response = await fetch("/api/life/unlock", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
    } catch {
      setError("暂时无法验证，请稍后再试。");
      setLoading(false);
      return;
    }
    const result = await response.json().catch(() => null) as { error?: unknown } | null;
    const serverSaysUnconfigured = typeof result?.error === "string" && /not configured|未设置/i.test(result.error);
    if (response.ok) {
      const target = returnTo === "/life" || /^\/entries\/[0-9a-f-]{36}$/i.test(returnTo) ? returnTo : "/life";
      window.location.replace(target);
      return;
    }
    if (response.status === 401) setError("密码不正确，请重试。");
    else if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : 0;
      setError(seconds > 0 ? `尝试次数较多，请在 ${seconds} 秒后重试。` : "尝试次数较多，请稍后重试。");
    } else if (response.status === 503 || serverSaysUnconfigured) setError("生活密码尚未设置，请稍后再试。");
    else setError("暂时无法验证，请稍后再试。");
    setLoading(false);
  }

  return <form className="life-gate-form" onSubmit={unlock}>
    <label htmlFor="life-password">生活密码</label>
    <div className="life-gate-controls">
      <input id="life-password" name="password" type="password" autoComplete="current-password" maxLength={256} value={password} onChange={event => setPassword(event.target.value)} required disabled={loading} />
      <button type="submit" disabled={loading || !password}>{loading ? "正在验证…" : "解锁"}</button>
    </div>
    {error && <p className="life-gate-error" role="alert">{error}</p>}
  </form>;
}
