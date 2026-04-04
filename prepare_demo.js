const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'insight-os', 'public', 'demo');
const destDir = path.join(__dirname, 'insight-demo-external');

// Create destination directory if it doesn't exist
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir);
}

// Copy and substitute
const files = fs.readdirSync(srcDir);
for (const file of files) {
  if (file.endsWith('.html')) {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    
    let content = fs.readFileSync(srcPath, 'utf8');
    
    // Replace localhost tracker with explicit Vercel tracker
    content = content.replace(
      /http:\/\/localhost:3000\/tracker\.js/g, 
      'https://insight0.vercel.app/tracker.js'
    );
    
    // If it had a hardcoded test-site-id, we can leave it as test-site-id for the demo, 
    // or they can change it later if they register a new site in the dashboard.
    
    fs.writeFileSync(destPath, content, 'utf8');
    console.log(`Prepared: ${file}`);
  }
}
console.log('Demo website successfully prepared in insight-demo-external folder!');
