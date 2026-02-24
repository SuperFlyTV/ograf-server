const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        if (filePath.includes('node_modules')) return;
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(filePath));
        } else if (file.endsWith('.ograf.json')) {
            results.push(filePath);
        }
    });
    return results;
}

const files = walkDir(process.cwd());
let errors = 0;

files.forEach(file => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        JSON.parse(content);
    } catch (e) {
        console.error(`Invalid JSON in ${file}:`, e.message);
        errors++;
    }
});

if (errors === 0) console.log("All .ograf.json files are valid JSON.");
