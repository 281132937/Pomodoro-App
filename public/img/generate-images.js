const fs = require('fs');

// Define images needed for the landing page
const images = [
  { name: 'app-preview.svg', width: 600, height: 400, color: '#3C6E71', text: 'Pomodoro App Preview' },
  { name: 'spotify-integration.svg', width: 600, height: 400, color: '#3C6E71', text: 'Spotify Integration' },
  { name: 'journey-tracking.svg', width: 600, height: 400, color: '#284B63', text: 'Journey Tracking' },
  { name: 'streak-counter.svg', width: 600, height: 400, color: '#3C6E71', text: 'Streak Counter' },
  { name: 'desktop-app.svg', width: 600, height: 400, color: '#284B63', text: 'Desktop App' },
  { name: 'mobile-app.svg', width: 300, height: 600, color: '#3C6E71', text: 'Mobile App' },
  { name: 'productivity-science.svg', width: 600, height: 400, color: '#284B63', text: 'Productivity Science' }
];

// Create SVG images
images.forEach(image => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${image.width}" height="${image.height}" viewBox="0 0 ${image.width} ${image.height}">
  <rect width="${image.width}" height="${image.height}" fill="${image.color}" />
  <text x="${image.width/2}" y="${image.height/2}" font-family="sans-serif" font-size="${Math.floor(image.width/20)}" fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle">${image.text}</text>
</svg>`;

  fs.writeFileSync(`${__dirname}/${image.name}`, svg);
  console.log(`Created ${image.name}`);
}); 