#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('\n🚀 MailSweep AI Setup\n');

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// Backend .env
const backendEnvPath = path.join(__dirname, '..', 'backend', '.env');
if (!fs.existsSync(backendEnvPath)) {
  const sessionSecret = generateSecret(32);
  const encryptionKey = generateSecret(16); // 32 chars
  
  const content = `PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/mailsweep
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
SESSION_SECRET=${sessionSecret}
ENCRYPTION_KEY=${encryptionKey.slice(0, 32)}!!!
FRONTEND_URL=http://localhost:3000
ANTHROPIC_API_KEY=your_anthropic_api_key_here
LOG_LEVEL=info
`;
  fs.writeFileSync(backendEnvPath, content);
  console.log('✅ Created backend/.env with generated secrets');
} else {
  console.log('⚠️  backend/.env already exists, skipping');
}

// Frontend .env.local
const frontendEnvPath = path.join(__dirname, '..', 'frontend', '.env.local');
if (!fs.existsSync(frontendEnvPath)) {
  const content = `NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_APP_NAME=MailSweep AI
`;
  fs.writeFileSync(frontendEnvPath, content);
  console.log('✅ Created frontend/.env.local');
} else {
  console.log('⚠️  frontend/.env.local already exists, skipping');
}

console.log('\n📋 Next steps:');
console.log('1. Edit backend/.env and add your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
console.log('   → Get them from: https://console.cloud.google.com/apis/credentials');
console.log('   → Enable Gmail API and OAuth 2.0');
console.log('2. (Optional) Add ANTHROPIC_API_KEY to backend/.env for AI Copilot features');
console.log('3. Make sure MongoDB is running: mongod');
console.log('4. Install dependencies: npm run install:all');
console.log('5. Start dev servers: npm run dev');
console.log('\n📖 Full setup guide in README.md\n');
