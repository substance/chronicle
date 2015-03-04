'use strict';

var Substance = require('substance');
var difference = require('lodash/array/difference');

// a dedicated global root node
var ROOT = require('../constants').ROOT;

function IndexImport() {}

IndexImport.Prototype = function() {

  // Imports all commits from another index
  // --------
  //
  // Note: this corresponds to a 'git fetch', which only adds commits without
  // applying any changes.
  //

  this.import = function(otherIndex) {
    // 1. index difference (only ids)
    var newIds = difference(otherIndex.list(), this.list());
    if (newIds.length === 0) return;

    // 2. compute correct order
    // Note: changes have to added according to their dependencies.
    // I.e., a change can only be added after all parents have been added.
    // OTOH, changes have to be removed in reverse order.
    var order = this.__computeDependencyOrder.call(this, otherIndex, newIds);

    // now they are topologically sorted
    newIds.sort(function(a,b){ return (order[a] - order[b]); });

    // 2. add changes to the index
    for (var idx = 0; idx < newIds.length; idx++) {
      this.add(otherIndex.get(newIds[idx]));
    }

    return newIds;
  };

  // Import helpers
  // =======

  // computes an order on a set of changes
  // so that they can be added to the index,
  // without violating the integrity of the index at any time.
  this.__computeDependencyOrder = function(other, newIds) {
    var order = {};

    function _order(id) {
      if (order[id]) return order[id];
      if (id === ROOT) return 0;

      var change = other.get(id);
      var o = _order(change.parent) + 1;
      order[id] = o;

      return o;
    }

    for (var idx = 0; idx < newIds.length; idx++) {
      _order(newIds[idx]);
    }

    return order;
  };

};

Substance.initClass(IndexImport);

module.exports = IndexImport;
