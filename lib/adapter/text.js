(function(root) {

var util = root.Substance.util;
var Chronicle = root.Substance.Chronicle;
var TextOperation = root.Substance.Operator.TextOperation;

var TextOperationAdapter = function(chronicle, doc) {
  Chronicle.Versioned.call(this, chronicle);
  this.doc = doc;
};

TextOperationAdapter.__prototype__ = function() {

  var __super__ = util.prototype(this);

  this.apply = function(change) {
    this.doc.setText(change.apply(this.doc.getText()));
  };

  this.invert = function(change) {
    return change.invert();
  };

  this.transform = function(a, b, options) {
    return TextOperation.transform(a, b, options);
  };

  this.reset = function() {
    __super__.reset.call(this);
    this.doc.setText("");
  };

};

TextOperationAdapter.__prototype__.prototype = Chronicle.Versioned.prototype;
TextOperationAdapter.prototype = new TextOperationAdapter.__prototype__();

Chronicle.TextOperationAdapter = TextOperationAdapter;

})(this);
