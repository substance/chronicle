
var Substance = require('substance');
var Change = require('../change');
var ChronicleError = require('../chronicle_error');
var Transformed = require('./transformed');

// A dedicated Change for merging multiple Chronicle histories.
// ========
//
// A merge is described by a command containing a diff for each of the parents (see Index.diff()).
//
// Example: Consider two sequences of changes [c0, c11, c12] and [c0, c21, c22, c23].
//
//  A merge taking all commits of the second ('theirs') branch and
//  rejecting those of the first ('mine') would be:
//
//    merge = {
//      "c12": ["-", "c11", "c0" "+", "c21", "c22", "c23"],
//      "c23": []
//    }
//
// A manually selected merge with [c11, c21, c23] would look like:
//
//    merge = {
//      "c12": ["-", "c11", "+", "c21", "c23"],
//      "c23": ["-", "c22", "c21", "c0", "+", "c11", "c21", "c23"]
//    }
//

var Merge = function(id, main, branches) {
  Change.call(this, id, main);
  this.type = Merge.TYPE;

  if (!branches) {
    throw new ChronicleError("Missing branches.");
  }
  this.branches = branches;
};

Merge.Prototype = function() {

  this.toJSON = function() {
    var result = this._super.toJSON.call(this);
    result.type = Merge.TYPE;
    result.branches = this.branches;
    return result;
  };

};
Substance.inherit(Merge, Change);

Merge.TYPE =  "merge";

Merge.fromJSON = function(data) {
  if (data.type !== Merge.TYPE) throw new ChronicleError("Illegal data for deserializing a Merge node.");
  return new Merge(data.parent, data.branches, data);
};

// HACK: override the default factory, this needs to be implemented where all three features are required
Change.fromJSON = function(json) {
  if (json.type === Merge.TYPE) return new Merge(json);
  if (json.type === Transformed.TYPE) return new Transformed(json);
  return new Change(json.parent, json.data, json);
};

module.exports = Merge;
