(function(root) { "use strict";

// Import
// ========

var _,
   util,
   Operation;

if (typeof exports !== 'undefined') {
  _    = require('underscore');
  util   = require('substance-util');
  Operation = require('./operation');
} else {
  _ = root._;
  util = root.Substance.util;
  Operation = root.Substance.Operator.Operation;
}

var COMPOUND = "compound";

var Compound = function(ops) {
  this.type = COMPOUND;
  this.ops = ops;
  this.alias = undefined;
};

Compound.__prototype__ = function() {

  this.clone = function() {
    var ops = [];
    for (var idx = 0; idx < this.ops.length; idx++) {
      ops.push(util.clone(this.ops[idx]));
    }
    return new Compound(ops);
  };

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
    var result = {
      type: COMPOUND,
      ops: this.ops,
    };
    if (this.alias) result.alias = this.alias;
    return result;
  };

};
Compound.__prototype__.prototype = Operation.prototype;
Compound.prototype = new Compound.__prototype__();

Compound.TYPE = COMPOUND;

// Transforms a compound and another given change inplace.
// --------
//

var compound_transform = function(a, b, first, check, transform0) {
  var idx;

  if (b.type === COMPOUND) {
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
    if(a.type === COMPOUND || b.type === COMPOUND) {
      if (!options.inplace) {
        a = util.clone(a);
        b = util.clone(b);
      }
      if (a.type === COMPOUND) {
        compound_transform(a, b, true, options.check, primitive_transform);
      } else if (b.type === COMPOUND) {
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
  root.Substance.Operator.Compound = Compound;
}

})(this);
