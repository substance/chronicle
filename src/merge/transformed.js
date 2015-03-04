
var Substance = require('substance');
var Change = require('./change');
var ChronicleError = require('./chronicle_error');

// Transformed changes are those which have been
// created by transforming (rebasing) another existing change.
// For the time being, the data is persisted redundantly.
// To be able to track the original source of the change,
// this type is introduced.
var Transformed = function(id, parent, data, original) {
  Change.call(this, id, parent, data);
  this.type = Transformed.TYPE;
  this.original = original;
};

Transformed.Prototype = function() {

  this.toJSON = function() {
    var result = this._super.toJSON.call(this);
    result.type = Transformed.TYPE;
    result.original = this.original;
    return result;
  };

};

Transformed.TYPE = "transformed";

Transformed.fromJSON = function(json) {
  if (json.type !== Transformed.TYPE) throw new ChronicleError("Illegal data for deserializing a Transformed node.");
  return new Transformed(json.parent, json.data, json.original, json);
};

Substance.inherit(Transformed, Change);

module.exports = Transformed;
