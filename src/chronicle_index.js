'use strict';

var Substance = require('substance');
var freeze = require('./freeze');
var without = require('lodash/array/without');

var Change = require('./change');
var ChronicleError = require('./chronicle_error');

// a dedicated global root node
var ROOT = require('./constants').ROOT;
var ROOT_NODE = new Change(ROOT, true, null);
ROOT_NODE.parent = ROOT;

// A directed acyclic graph of Commit instances.
// ========
//
var Index = function() {
  this.__id__ = Substance.uuid();

  this.changes = {};
  this.refs = {};
  this.children = {};
  this.changes[ROOT] = ROOT_NODE;
  this.children[ROOT] = [];
};

Index.Prototype = function() {

  // Adds a change to the index.
  // --------
  // All parents must be registered first, otherwise throws an error.
  //

  this.add = function(change) {
    // making the change data read-only
    change.data = freeze(change.data);

    var id = change.id;

    // sanity check: parents must
    if (!change.parent) throw new ChronicleError("Change does not have a parent.");

    if (!this.contains(change.parent))
      throw new ChronicleError("Illegal change: parent is unknown - change=" + id + ", parent=" + change.parent);

    this.changes[id] = change;
    this.children[id] = [];

    if (!this.children[change.parent]) this.children[change.parent] = [];
    this.children[change.parent].push(id);
  };

  // Removes a change from the index
  // --------
  // All children must be removed first, otherwise throws an error.
  //

  this.remove = function(id) {
    if (this.children[id].length > 0) {
      throw new ChronicleError("Can not remove: other changes depend on it.");
    }
    var change = this.changes[id];
    delete this.changes[id];
    delete this.children[id];
    this.children[change.parent] = without(this.children[change.parent], id);
  };

  // Checks if a given changeId has been added to the index.
  // --------
  //

  this.contains = function(id) {
    return !!this.changes[id];
  };

  // Retrieves a change by id
  // --------
  //

  this.get = function(id) {
    return this.changes[id];
  };

  // Provides all changes that are direct successors of this change.
  // --------
  //

  this.getChildren = function(id) {
    return this.children[id];
  };

  // Lists the ids of all contained changes
  // --------
  //

  this.list = function() {
    return Object.keys(this.changes);
  };

  // Computes the shortest path from start to end (without start)
  // --------
  //

  this.shortestPath = function(start, end) {

    // trivial cases
    if (start === end) return [];
    if (end === ROOT) return this.__getPathToRoot(start).slice(1);
    if (start === ROOT) return this.__getPathToRoot(end).reverse().slice(1);

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
            if (!pos) throw new Substance.Error("Illegal state: bug in implementation of Index.shortestPath.");
          }
          return path;
        }

        // TODO: we could optimize this a bit if we would check
        // if a parent or a child are the searched node and stop
        // instead of iterating.

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
    throw new Substance.Error("Illegal state: no path found.");
  };

  // Sets a reference to look up a change via name.
  // ---------
  //

  this.setRef = function(name, id) {
    if (this.changes[id] === undefined) {
      throw new ChronicleError("Unknown change: " + id);
    }
    this.refs[name] = id;
  };

  // Looks-up a change via name.
  // ---------
  //

  this.getRef = function(name) {
    return this.refs[name];
  };

  this.listRefs = function() {
    return Object.keys(this.refs);
  };

  this.__getPathToRoot = function(id) {
    var result = [];

    if (id === ROOT) return result;

    var current = this.get(id);
    if(!current) throw new ChronicleError("Unknown change: "+id);

    var parent;
    while(true) {
      result.push(current.id);
      if(current.id === ROOT) break;

      parent = current.parent;
      current = this.get(parent);
    }

    return result;
  };

};

Index.prototype = new Index.Prototype();

Index.INVALID = "INVALID";
Index.ROOT = ROOT_NODE;

Index.create = function() {
  return new Index();
};

// Creates an adapter for Changes given as plain hash.
// The adapter can be used together with Index.import
Index.adapt = function(changes) {
  return {
    list: function() {
      return Object.keys(changes);
    },
    get: function(id) {
      return changes[id];
    }
  };
};

module.exports = Index;
