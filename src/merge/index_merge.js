var Substance = require('substance');

var Diff = require('./diff');
var ROOT = require('../constants').ROOT;

function IndexMerge() {}

IndexMerge.Prototype = function() {
  // Computes the difference betweend two changes
  // --------
  //
  // In contrast to `path` is a diff a special path that consists
  // of a sequence of reverts followed by a sequence of applies.
  //

  this.diff = function(start, end) {

    // takes the path from both ends to the root
    // and finds the first common change

    var path1 = this.__getPathToRoot(start);
    var path2 = this.__getPathToRoot(end);

    var reverts = [];
    var applies = [];

    // create a lookup table for changes contained in the second path
    var tmp = {},
        id, idx;
    for (idx=0; idx < path2.length; idx++) {
      tmp[path2[idx]] = true;
    }

    // Traverses all changes from the first path until a common change is found
    // These changes constitute the reverting part
    for (idx=0; idx < path1.length; idx++) {
      id = path1[idx];
      // The first change is not included in the revert list
      // The common root
      if(idx > 0) reverts.push(id);
      if(tmp[id]) break;
    }

    var root = id;

    // Traverses the second path to the common change
    // These changes constitute the apply part
    for (idx=0; idx < path2.length; idx++) {
      id = path2[idx];
      if (id === root || id === ROOT) break;
      // Note: we are traversing from head to root
      // the applies need to be in reverse order
      applies.unshift(id);
    }

    return Diff.create(start, reverts, applies);
  };
};

Substance.initClass(IndexMerge);

module.exports = IndexMerge;
