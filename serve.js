// Simple HTTP server for Pomodoro App
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types for different file extensions
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.eot': 'font/eot',
};

// Create HTTP server
const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  // Handle favicon requests
  if (req.url === '/favicon.ico') {
    res.statusCode = 204; // No content
    res.end();
    return;
  }
  
  // Normalize URL to remove query parameters and hash
  let url = req.url.split('?')[0].split('#')[0];
  
  // If URL is /, serve index.html
  if (url === '/') {
    url = '/index.html';
  }
  
  // Construct file path
  const filePath = path.join(PUBLIC_DIR, url);
  
  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err) {
      // File not found, serve 404.html if it exists, otherwise simple message
      console.error(`404 Not Found: ${filePath}`);
      const notFoundPath = path.join(PUBLIC_DIR, '404.html');
      
      fs.stat(notFoundPath, (err, stats) => {
        if (err) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain');
          res.end('404 Not Found');
        } else {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/html');
          fs.createReadStream(notFoundPath).pipe(res);
        }
      });
      return;
    }
    
    // If it's a directory, try to serve index.html from that directory
    if (stats.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      fs.stat(indexPath, (err, stats) => {
        if (err) {
          res.statusCode = 403; // Forbidden
          res.setHeader('Content-Type', 'text/plain');
          res.end('403 Forbidden: Directory listing not allowed');
        } else {
          const contentType = MIME_TYPES['.html'] || 'application/octet-stream';
          res.statusCode = 200;
          res.setHeader('Content-Type', contentType);
          fs.createReadStream(indexPath).pipe(res);
        }
      });
      return;
    }
    
    // Get file extension and set content type
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    // Read and serve the file
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filePath).pipe(res);
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`
===============================================
  Pomodoro App Server Running
===============================================
  Local:    http://localhost:${PORT}
  Network:  http://${getLocalIP()}:${PORT}
===============================================
  Press Ctrl+C to stop the server
===============================================
`);
});

// Helper function to get local IP address
function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  
  return '127.0.0.1'; // Fallback to localhost
} 