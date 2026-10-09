// CSV export used by Conversations, Referral Leads and Audiences.

// columns: [{ header, value: (row) => string | number }]
export function toCsv(columns, rows) {
  const quote = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [columns.map((c) => quote(c.header)).join(","), ...rows.map((r) => columns.map((c) => quote(c.value(r))).join(","))].join("\r\n");
}

// Copies text to the clipboard. Resolves true on success, false if the browser blocked it.
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy method
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

// Saves a .csv file. The byte-order mark makes Excel read ₹ and other non-ASCII text correctly.
export function downloadCsv(filename, text) {
  const blob = new Blob(["﻿", text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
