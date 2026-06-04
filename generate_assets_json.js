const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'public', 'assets', 'images');
const deskDir = path.join(assetsDir, 'desk');
const accDir = path.join(assetsDir, 'accesories');

const desks = fs.readdirSync(deskDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png')).map((f, i) => ({
  id: `desk_${i+1}`,
  name: f,
  url: `./assets/images/desk/${f}`
}));

const items = fs.readdirSync(accDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png')).map((f, i) => ({
  id: `item_${i+1}`,
  name: f,
  url: `./assets/images/accesories/${f}`
}));

const data = { desks, items };
fs.writeFileSync(path.join(__dirname, 'public', 'assets', 'data.json'), JSON.stringify(data, null, 2));
console.log('Assets JSON generated.');
