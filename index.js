'use strict';

const fs = require('fs');
const stream = require('stream');
const process = require('process');
const path = require('path');

const MODE_HTML = 0;
const MODE_CONSOLE = 1;

class TreeLevel {
  constructor(num) {
    this.num = num;
  }

  toJSON() {
    return this.num;
  }

  toString() {
    return this.num;
  }
}

class DebugTree {
  constructor(writeStream) {
    this.writeStream = writeStream;
    this.indentation = -1;

    this.writeStream.write('<html><head><script>');
    this.writeStream.write(
      fs.readFileSync(path.resolve(__dirname, './req/CollapsibleLists.compressed.js')).toString()
    );
    this.writeStream.write('</script><style>');
    this.writeStream.write(
      fs.readFileSync(path.resolve(__dirname, './req/style.css')).toString()
    );
    this.writeStream.write('</style></head><body>');
  }

  close() {
    return new Promise(resolve => {
      while (this.indentation >= 0)
        this._outdent();
      this.writeStream.write('<script>CollapsibleLists.apply();</script></body></html>');
      this.writeStream.end(resolve);
    });
  }

  _write(text) {
    //this.writeStream.write(' '.repeat(this.indentation * 2));
    this.writeStream.write(text);
  }

  _indent() {
    this._write('<ul' + (this.indentation === -1 ? ' class="collapsibleList"' : '') + '><li>');
    this.indentation += 1;
  }

  _outdent() {
    this.indentation -= 1;
    this._write('</li></ul>');
  }

  _process(type, depth) {
    if (depth instanceof TreeLevel) {
      const args = Array.prototype.slice.apply(arguments, [2]);
      const level = depth.num;
      const text = level + '::' + args.join(' | ');
      if (level > this.indentation) {
        while (level > this.indentation) this._indent();
        this._write(text);
      } else if (level < this.indentation) {
        while (level < this.indentation) this._outdent();
        this._write('</li><li>');
        this._write(text);
      } else {
        this._write('</li><li>');
        this._write(text);
      }
    } else {
      const args = Array.prototype.slice.apply(arguments, [1]);
      originalConsole[type].apply(console, args);
    }
  }

  log() {
    this._process.apply(this, [0, ...arguments]);
  }

  error() {
    this._process.apply(this, [1, ...arguments]);
  }

  info() {
    this._process.apply(this, [2, ...arguments]);
  }

  warn() {
    this._process.apply(this, [3, ...arguments]);
  }
}

const consoleMethods = ['log', 'error', 'info', 'warn'];
const originalConsole = consoleMethods.map(method => console[method]);

let defaultTree = null;

DebugTree.start = function (filename) {
  if (process.env.NODE_ENV !== 'production') {
    // Create the tree
    defaultTree = new DebugTree(fs.createWriteStream(filename));

    // Hook up the console methods (log, error, info, warn)
    consoleMethods.forEach(method => {
      console[method] = defaultTree[method].bind(defaultTree);
    });

    return defaultTree;
  }
};

DebugTree.end = function () {
  if (process.env.NODE_ENV !== 'production') {
    if (defaultTree !== null) {
      // Restore the console back
      consoleMethods.forEach((method, idx) => {
        console[method] = originalConsole[idx];
      });

      return defaultTree.close().then(() => {
        defaultTree = null;
      });
    }
  }
};

DebugTree.Level = function(num) {
  return new TreeLevel(num);
};

module.exports = DebugTree;
