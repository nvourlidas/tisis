// Fire-and-forget calendar sync — never throws, so task operations always succeed
export async function syncCalendar(
  supabaseUrl: string,
  authHeader: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/functions/v1/google-calendar-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify(payload),
    })
  } catch (_) { /* best-effort */ }
}
