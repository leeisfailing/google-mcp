import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const keyPath = path.join(PROJECT_ROOT, 'key.json');
const tokenPath = path.join(PROJECT_ROOT, 'token.json');

async function testOAuthRefresh() {
  try {
    // Load credentials
    if (!fs.existsSync(keyPath)) {
      console.error('❌ key.json not found');
      process.exit(1);
    }
    const keyData = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
    const { client_secret, client_id } = keyData.installed || keyData.web;

    // Load token
    if (!fs.existsSync(tokenPath)) {
      console.error('❌ token.json not found. Run "npm start" first to authenticate.');
      process.exit(1);
    }
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));

    console.log('📋 Token info:');
    console.log(`   - Has refresh_token: ${!!tokenData.refresh_token}`);
    console.log(`   - Has access_token: ${!!tokenData.access_token}`);
    console.log(`   - Expiry_date: ${tokenData.expiry_date ? new Date(tokenData.expiry_date).toISOString() : 'N/A'}`);

    // Check if token is expired
    const now = Date.now();
    const isExpired = tokenData.expiry_date ? tokenData.expiry_date <= now : true;
    console.log(`   - Status: ${isExpired ? 'EXPIRED (needs refresh)' : 'VALID (still active)'}`);

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      'http://localhost:3000/oauth2callback'
    );
    oauth2Client.setCredentials(tokenData);

    // Attempt to refresh
    console.log('\n🔄 Attempting token refresh...');
    const { credentials } = await oauth2Client.refreshAccessToken();

    // Save new token
    fs.writeFileSync(tokenPath, JSON.stringify(credentials, null, 2));

    console.log('✅ Token refresh SUCCESSFUL');
    console.log(`   - New access_token: ${credentials.access_token?.substring(0, 20)}...`);
    console.log(`   - New expiry: ${credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : 'N/A'}`);
    console.log(`   - Refresh token preserved: ${!!credentials.refresh_token}`);

    // Test the token works with an actual API call
    console.log('\n🔍 Testing API call with refreshed token...');
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    try {
      const res = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.form' and trashed=false",
        pageSize: 1,
      });
      console.log(`✅ API authentication working - found ${res.data.files?.length || 0} form(s)`);
    } catch (apiError: any) {
      console.error(`⚠️ API call failed: ${apiError.message}`);
    }

  } catch (error: any) {
    console.error('\n❌ Token refresh FAILED');
    console.error(`   Error: ${error.message}`);
    if (error.message.includes('invalid_grant')) {
      console.error('\n🔑 The refresh token is invalid or revoked.');
      console.error('   Run "npm start" to re-authenticate.');
    }
    process.exit(1);
  }
}

testOAuthRefresh();