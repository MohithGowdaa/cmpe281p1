const fs = require('fs');
const ejs = require('ejs');
const path = require('path');

// Directory paths

const viewsDirectory = path.join(__dirname, 'views');
const outputDirectory = path.join(__dirname, 'public');

// Read and render each .ejs file
fs.readdirSync(viewsDirectory).forEach((filename) => {
  if (filename.endsWith('.ejs')) {
    const templatePath = path.join(viewsDirectory, filename);
    const outputFileName = filename.replace('.ejs', '.html');
    const outputPath = path.join(outputDirectory, outputFileName);

    const template = fs.readFileSync(templatePath, 'utf-8');
    const renderedHtml = ejs.render(template);

    fs.writeFileSync(outputPath, renderedHtml);
  }
});

console.log('Pre-rendering complete.');
