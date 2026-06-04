export class DataManager {
  constructor() {
    this.desks = [];
    this.items = [];
    this.desksMap = new Map();
    this.itemsMap = new Map();
  }

  async loadData() {
    try {
      const response = await fetch('./assets/data.json');
      const data = await response.json();

      // Ensure URLs are relative so they work seamlessly in the native browser
      const fixUrl = (url) => url.startsWith('./') ? url : './' + url.replace(/^\//, '');
      
      this.desks = data.desks.map(d => ({ ...d, url: fixUrl(d.url) }));
      this.items = data.items.map(i => ({ ...i, url: fixUrl(i.url) }));

      this.desks.forEach(desk => this.desksMap.set(desk.id, desk));
      this.items.forEach(item => this.itemsMap.set(item.id, item));

      // Preload images
      await this.preloadImages([...this.desks, ...this.items]);
    } catch (e) {
      console.error('Failed to load assets data', e);
    }
  }

  preloadImages(assets) {
    return Promise.all(assets.map(asset => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          asset.image = img;
          resolve();
        };
        img.onerror = () => {
           console.error(`Failed to load ${asset.url}`);
           resolve(); // Resolve anyway to not break the whole flow
        };
        img.src = asset.url;
      });
    }));
  }

  getDesk(id) {
    return this.desksMap.get(id);
  }

  getItem(id) {
    return this.itemsMap.get(id);
  }
}
