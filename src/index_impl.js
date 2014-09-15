"use strict";

// Imports
// ====

var util = require('substance-util');
var errors = util.errors;
var Chronicle = require('./chronicle');

// Module
// ====

var IndexImpl = function() {
  Chronicle.Index.call(this);
};

IndexImpl.Prototype = function() {

  var __private__ = new IndexImpl.__private__();
  var ROOT = Chronicle.ROOT;

  this.add = function(change) {
    // making the change data read-only
    change.data = util.freeze(change.data);

    var id = change.id;

    // sanity check: parents must
    if (!change.parent) throw new errors.ChronicleError("Change does not have a parent.");

    if (!this.contains(change.parent))
      throw new errors.ChronicleError("Illegal change: parent is unknown - change=" + id + ", parent=" + change.parent);

    this.changes[id] = change;
    this.children[id] = [];

    if (!this.children[change.parent]) this.children[change.parent] = [];
    this.children[change.parent].push(id);
  };

  this.remove = function(id) {
    if (this.children[id].length > 0)
      throw new errors.ChronicleError("Can not remove: other changes depend on it.");

    var change = this.changes[id];

    delete this.changes[id];
    delete this.children[id];
    this.children[change.parent] = _.without(this.children[change.parent], id);
  };

  this.contains = function(id) {
    return !!this.changes[id];
  };

  this.get = function(id) {
    return this.changes[id];
  };

  this.list = function() {
    return _.keys(this.changes);
  };

  this.getChildren = function(id) {
    return this.children[id];
  };

  this.diff = function(start, end) {

    // takes the path from both ends to the root
    // and finds the first common change

    var path1 = __private__.getPathToRoot.call(this, start);
    var path2 = __private__.getPathToRoot.call(this, end);

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

    return Chronicle.Diff.create(start, reverts, applies);
  };

  // Computes the shortest path from start to end (without start)
  // --------
  //

  this.shortestPath = function(start, end) {

    // trivial cases
    if (start === end) return [];
    if (end === ROOT) return __private__.getPathToRoot.call(this, start).slice(1);
    if (start === ROOT) return __private__.getPathToRoot.call(this, end).reverse().slice(1);

    // performs a BFS for end.
    var visited = {};
    var queue = [[start, start]];
    var item, origin, pos, current,
        idx, id, children;

    // Note: it is important to

    while(queue.length > 0) {
      item = queue.shift();
      origin = item[0];
      pos = item[1];
      current = this.get(pos);

      if (!visited[pos]) {
        // store the origin to be able to reconstruct the path later
        visited[pos] = origin;

        if (pos === end) {
          // reconstruct the path
          var path = [];
          var tmp;
          while (pos !== start) {
            path.unshift(pos);
            tmp = visited[pos];
            visited[pos] = null;
            pos = tmp;
            if (!pos) throw new errors.SubstanceError("Illegal state: bug in implementation of Index.shortestPath.");
          }
          return path;
        }

        // TODO: we could optimize this a bit if we would check
        // if a parent or a child are the searched node and stop
        // instead of iterating .

        // adding unvisited parent
        if (!visited[current.parent]) queue.push([pos, current.parent]);

        // and all unvisited children
        children = this.getChildren(pos);

        for (idx = 0; idx < children.length; idx++) {
          id = children[idx];
          if(!visited[id]) queue.push([pos, id]);
        }
      }
    }

    throw new errors.SubstanceError("Illegal state: no path found.");
  };

  this.import = function(otherIndex) {
    // 1. index difference (only ids)
    var newIds = _.difference(otherIndex.list(), this.list());
    if (newIds.length === 0) return;

    // 2. compute correct order
    // Note: changes have to added according to their dependencies.
    // I.e., a change can only be added after all parents have been added.
    // OTOH, changes have to be removed in reverse order.
    var order = __private__.computeDependencyOrder.call(this, otherIndex, newIds);

    // now they are topologically sorted
    newIds.sort(function(a,b){ return (order[a] - order[b]); });

    // 2. add changes to the index
    for (var idx = 0; idx < newIds.length; idx++) {
      this.add(otherIndex.get(newIds[idx]));
    }

    return newIds;
  };

  this.foreach = function(iterator, start) {
    start = start || "ROOT";
    var queue = [start];
    var nextId, next;
    while (queue.length > 0) {
      nextId = queue.shift();
      next = this.get(nextId);
      iterator(next);

      var children = this.children[nextId];
      for (var i = 0; i < children.length; i++) {
        queue.push(children[i]);
      }
    }
  };
};

IndexImpl.__private__ = function() {

  var ROOT = Chronicle.ROOT;

  this.getPathToRoot = function(id) {
    var result = [];

    if (id === ROOT) return result;

    var current = this.get(id);
    if(!current) throw new errors.ChronicleError("Unknown change: "+id);

    var parent;
    while(true) {
      result.push(current.id);
      if(current.id === ROOT) break;

      parent = current.parent;
      current = this.get(parent);
    }

    return result;
  };

  // Import helpers
  // =======

  // computes an order on a set of changes
  // so that they can be added to the index,
  // without violating the integrity of the index at any time.
  this.computeDependencyOrder = function(other, newIds) {
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

IndexImpl.Prototype.prototype = Chronicle.Index.prototype;
IndexImpl.prototype = new IndexImpl.Prototype();



// Extensions
// --------

var makePersistent = function(index, store) {

  index.store = store;
  index.__changes__ = store.hash("changes");
  index.__refs__ = store.hash("refs");

  // Initialize the index with the content loaded from the store

  // Trick: let the changes hash mimic an Index (duck-type)
  // and use Index.import
  index.__changes__.list = index.__changes__.keys;

  // Overrides
  // --------

  var __add__ = index.add;
  index.add = function(change) {
    __add__.call(this, change);
    this.__changes__.set(change.id, change);
  };

  var __remove__ = index.remove;
  index.remove = function(id) {
    __remove__.call(this, id);
    this.__changes__.delete(id);
  };

  var __setRef__ = index.setRef;
  index.setRef = function(name, id) {
    __setRef__.call(this, name, id);
    this.__refs__.set(name, id);
  };

  // Extensions
  // --------

  index.load = function() {
    this.import(this.__changes__);

    _.each(this.__refs__.keys(), function(ref) {
      this.setRef(ref, this.__refs__.get(ref));
    }, this);
  };

  // load automatically?
  index.load();
};

// Export
// ========

IndexImpl.create = function(options) {
  options = options || {};
  var index = new IndexImpl();

  if (options.store) {
    makePersistent(index, options.store);
  }

  return index;
};

module.exports = IndexImpl;
