export class DeskEditor {
  constructor(canvasElement, dataManager) {
    this.canvasElement = canvasElement;
    this.dataManager = dataManager;

    this.width = 800;
    this.height = 600;

    // Initialize Fabric.js Canvas
    this.canvas = new fabric.Canvas(canvasElement, {
      width: this.width,
      height: this.height,
      backgroundColor: '#fff',
      preserveObjectStacking: true
    });

    this.deskId = null;
    this.maxItems = 7;

    this.bindEvents();
  }

  setDesk(deskId) {
    this.deskId = deskId;
    const deskData = this.dataManager.getDesk(deskId);

    if (deskData && deskData.image) {
      const imgInstance = new fabric.Image(deskData.image);

      // Calculate scale to cover canvas
      const imgRatio = imgInstance.width / imgInstance.height;
      const canvasRatio = this.width / this.height;
      let scale;

      if (imgRatio > canvasRatio) {
         scale = this.height / imgInstance.height;
      } else {
         scale = this.width / imgInstance.width;
      }

      this.canvas.setBackgroundImage(imgInstance, this.canvas.renderAll.bind(this.canvas), {
         scaleX: scale,
         scaleY: scale,
         originX: 'center',
         originY: 'center',
         left: this.width / 2,
         top: this.height / 2
      });
    }
  }

  addItem(itemId) {
    const currentItemCount = this.canvas.getObjects('image').length;
    if (currentItemCount >= this.maxItems) {
        alert("Maximum 7 items allowed!");
        return false;
    }

    const itemData = this.dataManager.getItem(itemId);
    if (!itemData || !itemData.image) return false;

    const imgInstance = new fabric.Image(itemData.image);

    // Initial scale to make it roughly 65x65 pixels
    const targetSize = 65;
    const scale = targetSize / Math.max(imgInstance.width, imgInstance.height);

    imgInstance.set({
        id: itemId, // Store the custom ID
        left: this.width / 2,
        top: this.height / 2,
        scaleX: scale,
        scaleY: scale,
        originX: 'center',
        originY: 'center',
        transparentCorners: false,
        cornerColor: '#ff5722',
        borderColor: '#333',
        cornerSize: 10,
        minScaleLimit: 0.1 // Allows them to shrink it a bit more
    });

    // Disable stretching controls so it maintains aspect ratio
    imgInstance.setControlsVisibility({
        mt: false,
        mb: false,
        ml: false,
        mr: false
    });

    this.canvas.add(imgInstance);
    this.canvas.setActiveObject(imgInstance);
    this.updateCounter();

    return true;
  }

  removeItem() {
     const activeObjects = this.canvas.getActiveObjects();
     if (activeObjects.length) {
         activeObjects.forEach(obj => this.canvas.remove(obj));
         this.canvas.discardActiveObject();
         this.updateCounter();
     }
  }

  updateCounter() {
    const currentCount = this.canvas.getObjects('image').length;
    const remaining = Math.max(0, this.maxItems - currentCount);
    const itemsRem = document.getElementById('items-remaining');
    const repItemsRem = document.getElementById('replicating-items-remaining');
    
    if (itemsRem) itemsRem.textContent = remaining;
    if (repItemsRem) repItemsRem.textContent = remaining;
  }

  bindEvents() {
    // Listen for keyboard delete/backspace to remove items
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            // Ensure the user isn't typing in an input field somewhere
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                this.removeItem();
            }
        }
    });

    // Double-click to remove an item
    this.canvas.on('mouse:dblclick', (e) => {
        if (e.target && e.target.id) {
            this.canvas.remove(e.target);
            this.canvas.discardActiveObject();
            this.updateCounter();
        }
    });

    // Add a visual remove button that appears when an item is selected
    this.removeBtn = document.createElement('button');
    this.removeBtn.innerHTML = '🗑️ Remove';
    this.removeBtn.style.position = 'absolute';
    this.removeBtn.style.top = '10px';
    this.removeBtn.style.right = '10px';
    this.removeBtn.style.display = 'none';
    this.removeBtn.style.backgroundColor = '#ef4444'; // Red color
    this.removeBtn.style.color = '#fff';
    this.removeBtn.style.padding = '8px 16px';
    this.removeBtn.style.borderRadius = '8px';
    this.removeBtn.style.border = 'none';
    this.removeBtn.style.cursor = 'pointer';
    this.removeBtn.style.zIndex = '100';
    this.removeBtn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    this.removeBtn.style.fontWeight = 'bold';
    
    const container = this.canvas.wrapperEl || this.canvasElement.parentNode;
    if (container) container.appendChild(this.removeBtn);

    const handleRemove = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.removeItem();
    };
    this.removeBtn.addEventListener('mousedown', handleRemove);
    this.removeBtn.addEventListener('touchstart', handleRemove);

    this.canvas.on('selection:created', () => this.removeBtn.style.display = 'block');
    this.canvas.on('selection:updated', () => this.removeBtn.style.display = 'block');
    this.canvas.on('selection:cleared', () => this.removeBtn.style.display = 'none');
  }

  getScreenshot() {
    return this.canvas.toDataURL({
        format: 'jpeg',
        quality: 0.7
    });
  }

  getState() {
    return {
      deskId: this.deskId,
      items: this.canvas.getObjects('image').map(obj => ({
        id: obj.id,
        x: obj.left,
        y: obj.top,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        angle: obj.angle
      }))
    };
  }

  setState(state) {
    this.clear();
    this.setDesk(state.deskId);
    
    state.items.forEach(iState => {
      const itemData = this.dataManager.getItem(iState.id);
      if (itemData && itemData.image) {
          const imgInstance = new fabric.Image(itemData.image);
          imgInstance.set({
              id: iState.id,
              left: iState.x,
              top: iState.y,
              scaleX: iState.scaleX,
              scaleY: iState.scaleY,
              angle: iState.angle || 0,
              originX: 'center',
              originY: 'center',
              transparentCorners: false,
              cornerColor: '#ff5722',
              borderColor: '#333',
              cornerSize: 10,
              minScaleLimit: 0.2
          });
          imgInstance.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
          this.canvas.add(imgInstance);
      }
    });
    
    this.updateCounter();
  }

  clear() {
      this.deskId = null;
      this.canvas.clear();
      this.canvas.backgroundColor = '#fff';
      if (this.removeBtn) this.removeBtn.style.display = 'none';
      this.updateCounter();
  }

  recalcOffset() {
      if (this.canvas) {
          this.canvas.calcOffset();
          this.canvas.renderAll();
      }
  }
}
