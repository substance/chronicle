"use strict";

var util = require('substance-util');
var Chronicle = require('./chronicle');
var TextOperation = require('substance-operator').TextOperation;

var TextOperationAdapter = function(chronicle, doc) {
  Chronicle.Versioned.call(this, chronicle);
  this.doc = doc;
};

TextOperationAdapter.Prototype = function() {

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

TextOperationAdapter.Prototype.prototype = Chronicle.Versioned.prototype;
TextOperationAdapter.prototype = new TextOperationAdapter.Prototype();

module.exports = TextOperationAdapter;
