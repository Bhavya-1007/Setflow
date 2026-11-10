export async function sendRequest(url, method = 'GET', data) {
  const response = await fetch(url, {
    method,
    cache: 'no-store',
    ...(data === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The request couldn’t finish. Please try again.');
  return result;
}
