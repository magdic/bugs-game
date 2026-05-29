export class DeskEditor {
  constructor(canvasElement, dataManager) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.dataManager = dataManager;

    this.width = 800;
    this.height = 600;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.deskId = null;
    this.placedItems = []; // { id, x, y, image }
    this.maxItems = 7;

    this.isDragging = false;
    this.draggedItemIndex = -1;
    this.offsetX = 0;
    this.offsetY = 0;

    this.bindEvents();
    this.render();
  }

  setDesk(deskId) {
    this.deskId = deskId;
    this.render();
  }

  addItem(itemId) {
    if (this.placedItems.length >= this.maxItems) return false;

    const itemData = this.dataManager.getItem(itemId);
    if (!itemData || !itemData.image) return false;

    // Place in center initially
    this.placedItems.push({
      id: itemId,
      x: this.width / 2 - itemData.image.width / 2,
      y: this.height / 2 - itemData.image.height / 2,
      image: itemData.image
    });

    this.render();
    return true;
  }

  removeItem(index) {
    if (index >= 0 && index < this.placedItems.length) {
      this.placedItems.splice(index, 1);
      this.render();
    }
  }

  bindEvents() {
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.onMouseUp.bind(this));

    // Support for touch devices
    this.canvas.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.onMouseDown(mouseEvent);
        e.preventDefault();
    }, {passive: false});

    this.canvas.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.onMouseMove(mouseEvent);
        e.preventDefault();
    }, {passive: false});

    this.canvas.addEventListener('touchend', (e) => {
        const mouseEvent = new MouseEvent('mouseup', {});
        this.onMouseUp(mouseEvent);
        e.preventDefault();
    }, {passive: false});
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  onMouseDown(e) {
    const pos = this.getMousePos(e);

    // Check backwards to select top-most item
    for (let i = this.placedItems.length - 1; i >= 0; i--) {
      const item = this.placedItems[i];
      if (pos.x >= item.x && pos.x <= item.x + item.image.width &&
          pos.y >= item.y && pos.y <= item.y + item.image.height) {

        this.isDragging = true;
        this.draggedItemIndex = i;
        this.offsetX = pos.x - item.x;
        this.offsetY = pos.y - item.y;

        // Move item to end of array so it renders on top
        const draggedItem = this.placedItems.splice(i, 1)[0];
        this.placedItems.push(draggedItem);
        this.draggedItemIndex = this.placedItems.length - 1;

        break;
      }
    }
  }

  onMouseMove(e) {
    if (this.isDragging && this.draggedItemIndex !== -1) {
      const pos = this.getMousePos(e);
      const item = this.placedItems[this.draggedItemIndex];
      item.x = pos.x - this.offsetX;
      item.y = pos.y - this.offsetY;
      this.render();
    }
  }

  onMouseUp(e) {
    this.isDragging = false;
    this.draggedItemIndex = -1;
  }

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Fill background
    this.ctx.fillStyle = '#222';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw desk
    if (this.deskId) {
      const deskData = this.dataManager.getDesk(this.deskId);
      if (deskData && deskData.image) {
        // Draw centered and cover
        const imgRatio = deskData.image.width / deskData.image.height;
        const canvasRatio = this.width / this.height;
        let dw, dh, dx, dy;

        if (imgRatio > canvasRatio) {
           dh = this.height;
           dw = dh * imgRatio;
           dy = 0;
           dx = (this.width - dw) / 2;
        } else {
           dw = this.width;
           dh = dw / imgRatio;
           dx = 0;
           dy = (this.height - dh) / 2;
        }

        this.ctx.drawImage(deskData.image, dx, dy, dw, dh);
      }
    }

    // Draw items
    this.placedItems.forEach(item => {
      if (item.image) {
        this.ctx.drawImage(item.image, item.x, item.y);
      }
    });
  }

  getScreenshot() {
    return this.canvas.toDataURL('image/png');
  }

  getState() {
    return {
      deskId: this.deskId,
      items: this.placedItems.map(item => ({
        id: item.id,
        x: item.x,
        y: item.y
      }))
    };
  }

  setState(state) {
    this.deskId = state.deskId;
    this.placedItems = state.items.map(iState => {
      const itemData = this.dataManager.getItem(iState.id);
      return {
        id: iState.id,
        x: iState.x,
        y: iState.y,
        image: itemData ? itemData.image : null
      };
    }).filter(i => i.image !== null);
    this.render();
  }

  clear() {
      this.deskId = null;
      this.placedItems = [];
      this.render();
  }
}
