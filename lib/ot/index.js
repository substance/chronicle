(function(root) { "use strict";

if (typeof exports !== 'undefined') {

  var Compound = require('./compound');
  var ArrayOperation = require('./array_operation');
  var TextOperation = require('./text_operation');
  var ObjectOperation = require('./object_operation');

  module.exports = {
    Compound: Compound,
    ArrayOperation: ArrayOperation,
    TextOperation: TextOperation,
    ObjectOperation: ObjectOperation
  };
}

})(this);
