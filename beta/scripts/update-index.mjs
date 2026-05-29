import fs from "fs";

let html = fs.readFileSync("index.html", "utf8");
html = html.replace(
    /<script src="https:\/\/cdnjs\.cloudflare\.com[^<]+<\/script>\s*<style>[\s\S]*?<\/style>/,
    `<link rel="stylesheet" href="./css/style.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.4.3/pixi.min.js"></script>`
);
html = html.replace(
    '<script src="./main.js?1"></script>',
    '<script type="module" src="./js/main.js"></script>'
);
fs.writeFileSync("index.html", html);
console.log("index.html updated");
