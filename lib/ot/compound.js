(function(root) {

// Import
// ========

var _,
   util;

if (typeof exports !== 'undefined') {
  _    = require('underscore');
  util   = require('../util/util');
} else {
  _ = root._;
  util = root.Substance.util;
}

var Compound = function(ops) {
  this.type = Compound.TYPE;
  this.ops = ops;
};

Compound.__prototype__ = function() {

  this.apply = function(obj) {
    for (var idx = 0; idx < this.ops.length; idx++) {
      obj = this.ops[idx].apply(obj);
    }
    return obj;
  };

  this.invert = function() {
    var ops = [];
    for (var idx = 0; idx < this.ops.length; idx++) {
      // reverse the order of the inverted atomic commands
      ops.unshift(this.ops[idx].invert());
    }

    return new Compound(ops);
  };

  this.toJSON = function() {
    return {
      type: Compound.TYPE,
      ops: this.ops
    };
  };

};
Compound.prototype = new Compound.__prototype__();

Compound.TYPE = 10;

// Transforms a compound and another given change inplace.
// --------
//

var compound_transform = function(a, b, first, check, transform0) {
  var idx;

  if (b instanceof Compound) {
    for (idx = 0; idx < b.ops.length; idx++) {
      compound_transform(a, b.ops[idx], first, check, transform0);
    }
  }

  else {
    for (idx = 0; idx < a.ops.length; idx++) {
      var _a, _b;
      if (first) {
        _a = a.ops[idx];
        _b = b;
      } else {
        _a = b;
        _b = a.ops[idx];
      }
      transform0(_a, _b, {inplace: true, check: check});
    }
  }
};

// A helper to create a transform method that supports Compounds.
// --------
//

Compound.createTransform = function(primitive_transform) {
  return function(a, b, options) {
    options = options || {};
    if(a instanceof Compound || b instanceof Compound) {
      if (!options.inplace) {
        a = a.copy();
        b = b.copy();
      }
      if (a instanceof Compound) {
        compound_transform(a, b, true, options.check, primitive_transform);
      } else if (b instanceof Compound) {
        compound_transform(b, a, false, options.check, primitive_transform);
      }
      return [a, b];
    } else {
      return primitive_transform(a, b, options);
    }

  };
};

// Export
// ========

if (typeof exports !== 'undefined') {
  module.exports = Compound;
} else {
  root.Substance.Chronicle.OT = root.Substance.Chronicle.OT || {};
  root.Substance.Chronicle.OT.Compound = Compound;
}

})(this);
