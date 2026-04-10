const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

function walk(dir, exceptionFiles) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file, exceptionFiles));
        } else {
            if (file.endsWith('.js') && !exceptionFiles.some(ex => file.endsWith(ex))) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(directoryPath, ['Home.js', 'App.js', 'index.js']);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Remove imports
    content = content.replace(/import AOS from 'aos';\r?\n?/g, '');
    content = content.replace(/import 'aos\/dist\/aos\.css';\r?\n?/g, '');
    
    // Remove AOS.init blocks
    content = content.replace(/AOS\.init\(\{\s*.*?\s*\}\);\r?\n?/gs, '');
    // Or if it was AOS.init();
    content = content.replace(/AOS\.init\(\);\r?\n?/g, '');
    
    // Sometimes people wrap AOS.init inside useEffect(() => { ... }, []);
    // The previous regex might leave empty useEffects, let's try to just remove data-aos attributes first, 
    // which is the most important part.
    
    content = content.replace(/\sdata-aos="[^"]*"/g, '');
    content = content.replace(/\sdata-aos-delay="[^"]*"/g, '');
    content = content.replace(/\sdata-aos-delay=\{[^}]*\}/g, '');
    content = content.replace(/\sdata-aos-duration="[^"]*"/g, '');
    content = content.replace(/\sdata-aos-duration=\{[^}]*\}/g, '');
    content = content.replace(/\sdata-aos-offset="[^"]*"/g, '');
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
