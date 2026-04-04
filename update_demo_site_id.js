const fs = require('fs');
const path = require('path');

const destDir = path.join(__dirname, 'insight-demo-external');
const files = fs.readdirSync(destDir);

for (const file of files) {
  if (file.endsWith('.html')) {
    const destPath = path.join(destDir, file);
    let content = fs.readFileSync(destPath, 'utf8');
    
    // Completely wipe any <script> tag that references tracker.js and its closing tag, handling any newlines/spaces
    content = content.replace(
      /<script[\s\S]*?tracker\.js[\s\S]*?<\/script>/gi,
      '<script defer data-site="cmnjoenvi000004jp2ge44k3j" src="https://insight0.vercel.app/tracker.js"></script>'
    );
    
    fs.writeFileSync(destPath, content, 'utf8');
    console.log(`Force updated tracker in: ${file}`);
  }
}
console.log('Successfully injected the live database Site ID everywhere!');
