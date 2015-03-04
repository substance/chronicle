'use strict';

var without = require('lodash/array/without');
var Substance = require('substance');
var ChronicleIndex = require('../chronicle_index');
var ChronicleError = require('../chronicle_error');


var TmpIndex = function(index) {
  ChronicleIndex.call(this);
  this.index = index;
};

TmpIndex.Prototype = function() {

  this.get = function(id) {
    if (this._super.contains.call(this, id)) {
      return this._super.get.call(this, id);
    }
    return this.index.get(id);
  };

  this.contains = function(id) {
    return this._super.contains.call(this, id) || this.index.contains(id);
  };

  this.getChildren = function(id) {
    var result = this._super.getChildren.call(this, id) || [];
    if (this.index.contains(id)) {
      result = result.concat(this.index.getChildren(id));
    }
    return result;
  };

  this.list = function() {
    return this._super.list.call(this).concat(this.index.list());
  };

  this.save = function(id, recurse) {
    if (recurse) {
      var queue = [id];
      var nextId, next;
      while(queue.length > 0) {
        nextId = queue.pop();
        next = this.changes[nextId];

        if (this.changes[nextId]) this.index.add(next);

        for (var idx=0; idx < next.children; idx++) {
          queue.unshift(next.children[idx]);
        }
      }
    } else {
      if (this.changes[id]) this.index.add(this.changes[id]);
    }
  };

  this.reconnect = function(id, newParentId) {
    if (!this.changes[id])
      throw new ChronicleError("Change does not exist to this index.");

    var change = this.get(id);

    if (!this.contains(newParentId)) {
      throw new ChronicleError("Illegal change: parent is unknown parent=" + newParentId);
    }

    if (!this.children[change.parent]) this.children[change.parent] = [];
    this.children[change.parent] = without(this.children[change.parent], change.id);

    change.parent = newParentId;

    if (!this.children[change.parent]) this.children[change.parent] = [];
    this.children[change.parent].push(id);
  };
};
Substance.inherit(TmpIndex, ChronicleIndex);

module.exports = TmpIndex;
