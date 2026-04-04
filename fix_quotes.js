const fs = require('fs');
const path = require('path');

const destDir = path.join(__dirname, 'insight-demo-external');
const files = fs.readdirSync(destDir);

for (const file of files) {
  if (file.endsWith('.html')) {
    const destPath = path.join(destDir, file);
    let content = fs.readFileSync(destPath, 'utf8');
    
    // Replace href='/demo/...' with href='/...' (fixing single quotes!)
    content = content.replace(/href='\/demo\//g, "href='/");
    // Just in case, replace double quotes properly too
    content = content.replace(/href="\/demo\//g, 'href="/');
    
    fs.writeFileSync(destPath, content, 'utf8');
    console.log(`Fixed single-quote href links in: ${file}`);
  }
}
