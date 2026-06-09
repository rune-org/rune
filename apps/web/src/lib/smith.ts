const SMITH_PENDING_PROMPT_KEY = "smith_pending_prompt";

export function startSmithWithPrompt(prompt: string): void {
  const trimmed = prompt.trim();
  if (!trimmed) return;
  localStorage.setItem(SMITH_PENDING_PROMPT_KEY, trimmed);
  window.location.href = "/create/app?smith=pending";
}
