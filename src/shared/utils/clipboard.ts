function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.top = "-1000px";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    el.setSelectionRange(0, el.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  const electron = typeof window !== "undefined" ? window.linerElectron : null;
  if (electron?.writeClipboardText) {
    try {
      const ok = await electron.writeClipboardText(text);
      if (ok) return true;
    } catch {}
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }

  return legacyCopy(text);
}
