import fs from 'node:fs';
import path from 'node:path';

export default function cloudflarePagesAssets({ apiBaseUrl }) {
  let outDir = 'dist';

  return {
    name: 'cloudflare-pages-assets',
    configResolved(config) {
      outDir = config.build.outDir || 'dist';
    },
    closeBundle() {
      const destination = path.resolve(process.cwd(), outDir);
      if (!fs.existsSync(destination)) {
        return;
      }

      // 1. Generate robots.txt
      const robotsContent = `User-agent: *\nDisallow: /\n`;
      fs.writeFileSync(path.join(destination, 'robots.txt'), robotsContent, 'utf8');

      // 2. Generate _redirects (SPA fallback)
      const redirectsContent = `/*    /index.html   200\n`;
      fs.writeFileSync(path.join(destination, '_redirects'), redirectsContent, 'utf8');

      // 3. Derive connect-src from apiBaseUrl
      let connectSrc = "'self'";
      if (apiBaseUrl) {
        try {
          const parsed = new URL(apiBaseUrl);
          connectSrc = `'self' ${parsed.origin}`;
        } catch {
          connectSrc = `'self' ${apiBaseUrl}`;
        }
      }

      // 4. Generate _headers
      const headersContent = `/*
  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src ${connectSrc}; frame-ancestors 'none';
`;
      fs.writeFileSync(path.join(destination, '_headers'), headersContent, 'utf8');
    },
  };
}
