const fs = require('fs');
const { createCanvas } = require('canvas');

const images = [
  { name: 'app-preview.png', width: 600, height: 400, color: '#3C6E71', text: 'Pomodoro App Preview' },
  { name: 'spotify-integration.png', width: 600, height: 400, color: '#3C6E71', text: 'Spotify Integration' },
  { name: 'journey-tracking.png', width: 600, height: 400, color: '#284B63', text: 'Journey Tracking' },
  { name: 'streak-counter.png', width: 600, height: 400, color: '#3C6E71', text: 'Streak Counter' },
  { name: 'desktop-app.png', width: 600, height: 400, color: '#284B63', text: 'Desktop App' },
  { name: 'mobile-app.png', width: 300, height: 600, color: '#3C6E71', text: 'Mobile App' },
  { name: 'productivity-science.png', width: 600, height: 400, color: '#284B63', text: 'Productivity Science' }
];

// Create fallback images if canvas module is not available
images.forEach(image => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${image.text}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background-color: ${image.color};
    }
    .container {
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      text-align: center;
      padding: 20px;
    }
    h1 {
      font-size: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${image.text}</h1>
  </div>
</body>
</html>`;

  fs.writeFileSync(`${__dirname}/${image.name}.html`, html);
  console.log(`Created ${image.name}.html`);
});

// Check if we have the canvas module
try {
  // If canvas module is available, create PNG images
  images.forEach(image => {
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = image.color;
    ctx.fillRect(0, 0, image.width, image.height);
    
    // Add text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(image.text, image.width / 2, image.height / 2);
    
    // Save image
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(`${__dirname}/${image.name}`, buffer);
    console.log(`Created ${image.name}`);
  });
} catch (err) {
  console.log("Canvas module not available, using HTML fallbacks instead.");
  console.log("To use PNGs, install: npm install canvas");
  
  // Create simple HTML files with instructions
  fs.writeFileSync(`${__dirname}/README.md`, `
# Image Placeholders

This directory contains HTML placeholders for the required images.
To view the landing page with proper images, you can:

1. Install the Canvas library: \`npm install canvas\`
2. Run this script again: \`node create-mock-images.js\`

Or manually create images with the following names:
${images.map(img => `- ${img.name}: ${img.width}x${img.height}`).join('\n')}
`);
} 