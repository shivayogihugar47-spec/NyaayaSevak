const localtunnel = require('localtunnel');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const tunnel = await localtunnel({ port: 3001 });
    const fullWebhookUrl = `${tunnel.url}/api/voice/webhook`;
    
    console.log(`\n=================================================`);
    console.log(`TUNNEL ACTIVE!`);
    console.log(`Base URL: ${tunnel.url}`);
    console.log(`Webhook URL: ${fullWebhookUrl}`);
    console.log(`=================================================\n`);
    
    fs.writeFileSync(path.join(__dirname, '..', 'tunnel_url.txt'), fullWebhookUrl, 'utf8');
    
    tunnel.on('close', () => {
      console.log('Tunnel closed');
    });
  } catch (err) {
    console.error("Tunnel Error:", err);
  }
})();
