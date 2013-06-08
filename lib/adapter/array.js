(function(root) {

var util = root.Substance.util;
var Chronicle = root.Substance.Chronicle;
var ArrayOperation = Chronicle.OT.ArrayOperation;

var ArrayOperationAdapter = function(chronicle, array) {
  Chronicle.Versioned.call(this, chronicle);
  this.array = array;
};

ArrayOperationAdapter.__prototype__ = function() {

  var __super__ = util.prototype(this);

  this.apply = function(change) {
    change.apply(this.array);
  };

  this.invert = function(change) {
    return change.invert();
  };

  this.transform = function(a, b) {
    return ArrayOperation.transform(a, b);
  };

  this.hasConflict = function(a, b) {
    return ArrayOperation.hasConflict(a, b);
  };

  this.reset = function() {
    __super__.reset.call(this);
    while(this.array.length > 0) {
      this.array.shift();
    }
  };

};

ArrayOperationAdapter.__prototype__.prototype = Chronicle.Versioned.prototype;
ArrayOperationAdapter.prototype = new ArrayOperationAdapter.__prototype__();

Chronicle.ArrayOperationAdapter = ArrayOperationAdapter;

})(this);