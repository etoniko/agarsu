const Quad = {
  init(args) {
    const maxChildren = args.maxChildren || 2;
    const maxDepth = args.maxDepth || 4;
    function Node(x, y, w, h, depth) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.depth = depth;
      this.items = [];
      this.nodes = [];
    }
    Node.prototype = {
      exists(selector) {
        for (let i = 0; i < this.items.length; ++i) {
          const item = this.items[i];
          if (item.x >= selector.x && item.y >= selector.y && item.x < selector.x + selector.w && item.y < selector.y + selector.h) {
            return true;
          }
        }
        if (this.nodes.length) {
          const self = this;
          return this.findOverlappingNodes(selector, (dir) => self.nodes[dir].exists(selector));
        }
        return false;
      },
      retrieve(item, callback) {
        for (let i = 0; i < this.items.length; ++i) callback(this.items[i]);
        if (this.nodes.length) {
          const self = this;
          this.findOverlappingNodes(item, (dir) => {
            self.nodes[dir].retrieve(item, callback);
          });
        }
      },
      insert(a) {
        if (this.nodes.length) {
          this.nodes[this.findInsertNode(a)].insert(a);
        } else if (this.items.length >= maxChildren && this.depth < maxDepth) {
          this.devide();
          this.nodes[this.findInsertNode(a)].insert(a);
        } else {
          this.items.push(a);
        }
      },
      findInsertNode(a) {
        return a.x < this.x + this.w / 2 ? a.y < this.y + this.h / 2 ? 0 : 2 : a.y < this.y + this.h / 2 ? 1 : 3;
      },
      findOverlappingNodes(a, b) {
        return a.x < this.x + this.w / 2 && (a.y < this.y + this.h / 2 && b(0) || a.y >= this.y + this.h / 2 && b(2)) || a.x >= this.x + this.w / 2 && (a.y < this.y + this.h / 2 && b(1) || a.y >= this.y + this.h / 2 && b(3));
      },
      devide() {
        const depth = this.depth + 1;
        const hw = this.w / 2;
        const hh = this.h / 2;
        this.nodes.push(new Node(this.x, this.y, hw, hh, depth));
        this.nodes.push(new Node(this.x + hw, this.y, hw, hh, depth));
        this.nodes.push(new Node(this.x, this.y + hh, hw, hh, depth));
        this.nodes.push(new Node(this.x + hw, this.y + hh, hw, hh, depth));
        const items = this.items;
        this.items = [];
        for (let i = 0; i < items.length; i++) this.insert(items[i]);
      },
      clear() {
        for (let i = 0; i < this.nodes.length; i++) this.nodes[i].clear();
        this.items.length = 0;
        this.nodes.length = 0;
      }
    };
    const internalSelector = { x: 0, y: 0, w: 0, h: 0 };
    return {
      root: new Node(args.minX, args.minY, args.maxX - args.minX, args.maxY - args.minY, 0),
      insert(a) {
        this.root.insert(a);
      },
      retrieve(a, b) {
        this.root.retrieve(a, b);
      },
      retrieve2(a, b, c, d, callback) {
        internalSelector.x = a;
        internalSelector.y = b;
        internalSelector.w = c;
        internalSelector.h = d;
        this.root.retrieve(internalSelector, callback);
      },
      exists(a) {
        return this.root.exists(a);
      },
      clear() {
        this.root.clear();
      }
    };
  }
};
export {
  Quad
};