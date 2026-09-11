import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, '../.env');
const REDIRECT_URI = 'https://localhost:8080';

const clientId = process.env.YAHOO_CLIENT_ID?.trim();
const clientSecret = process.env.YAHOO_CLIENT_SECRET?.trim();

if (!clientId || !clientSecret) {
  console.error('Missing YAHOO_CLIENT_ID or YAHOO_CLIENT_SECRET in backend/.env — fill those in first.');
  process.exit(1);
}

const authUrl = `https://api.login.yahoo.com/oauth2/request_auth?client_id=${encodeURIComponent(
  clientId
)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&language=en-us`;

console.log('\n1. Open this URL in your browser and log into Yahoo:\n');
console.log(authUrl);
console.log(
  '\n2. Approve access. Yahoo will redirect you to a page that fails to load (https://localhost:8080/...) — that\'s expected.'
);
console.log('3. Copy the "code" value from that page\'s URL bar (everything after "code=", before any "&").\n');

const rl = createInterface({ input: process.stdin, output: process.stdout });
const code = (await rl.question('Paste the code here: ')).trim();
rl.close();

const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
const res = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
  method: 'POST',
  headers: {
    Authorization: `Basic ${basicAuth}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
    code,
  }),
});

const body = await res.json();

if (!res.ok) {
  console.error(`\nToken exchange failed (${res.status}):`, body);
  process.exit(1);
}

const refreshToken = body.refresh_token as string;
console.log('\nSuccess. Refresh token:\n');
console.log(refreshToken);

const envContent = readFileSync(ENV_PATH, 'utf-8');
const updated = envContent.includes('YAHOO_REFRESH_TOKEN=')
  ? envContent.replace(/YAHOO_REFRESH_TOKEN=.*/, `YAHOO_REFRESH_TOKEN=${refreshToken}`)
  : envContent + `\nYAHOO_REFRESH_TOKEN=${refreshToken}\n`;
writeFileSync(ENV_PATH, updated);
console.log('\nWritten to backend/.env automatically.');
