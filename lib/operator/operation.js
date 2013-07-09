(function(root) { "use strict";

// Import
// ========

var _,
    errors,
    util;

if (typeof exports !== 'undefined') {
  _ = require('underscore');
  util   = require('substance-util');
  errors   = require('substance-util/errors');
} else {
  _ = root._;
  util = root.Substance.util;
  errors = root.Substance.errors;
}

errors.define("OperationError", -1);
errors.define("Conflict", -1);

var Operation = function() {};

Operation.Prototype = function() {

  this.clone = function() {
    throw new Error("Not implemented.");
  };

  this.apply = function() {
    throw new Error("Not implemented.");
  };

  this.invert = function() {
    throw new Error("Not implemented.");
  };

  this.hasConflict = function() {
    throw new Error("Not implemented.");
  };

};

Operation.prototype = new Operation.Prototype();

Operation.conflict = function(a, b) {
  var conflict = new errors.Conflict("Conflict: " + JSON.stringify(a) +" vs " + JSON.stringify(b));
  conflict.a = a;
  conflict.b = b;
  return conflict;
};

// Export
// ========

if (typeof exports !== 'undefined') {
  module.exports = Operation;
} else {
  root.Substance.Operator = {};
  root.Substance.Operator.Operation = Operation;
}


})(this);