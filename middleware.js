// Basic auth for the private renovation dashboard at /mellemvangen.
// Credentials are set as Vercel environment variables:
//   MELLEMVANGEN_USER and MELLEMVANGEN_PASS
// If they are missing, the page stays locked.

export const config = {
  matcher: ['/mellemvangen', '/mellemvangen/:path*'],
};

function deny(message) {
  return new Response(message, {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Mellemvangen", charset="UTF-8"',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default function middleware(request) {
  const user = process.env.MELLEMVANGEN_USER;
  const pass = process.env.MELLEMVANGEN_PASS;
  if (!user || !pass) return deny('Locked.');

  const header = request.headers.get('authorization') || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme !== 'Basic' || !encoded) return deny('Login required.');

  let decoded = '';
  try {
    decoded = atob(encoded);
  } catch {
    return deny('Login required.');
  }
  const i = decoded.indexOf(':');
  const u = decoded.slice(0, i);
  const p = decoded.slice(i + 1);
  if (i < 0 || !safeEqual(u, user) || !safeEqual(p, pass)) return deny('Login required.');

  // Authorized: let the request continue to the static files.
}
