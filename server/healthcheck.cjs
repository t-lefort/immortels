const http = require('http');
const req = http.get('http://localhost:3000/api/game/health', (res) => {
  process.exit(res.statusCode >= 200 && res.statusCode < 300 ? 0 : 1);
});
req.on('error', () => process.exit(1));
