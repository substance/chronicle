(function(root) {

// Imports
// ====

var util, errors, _, Chronicle;

if (root.exports) {
  throw "Node.js support not implemented";
} else {
  util = root.Substance.util;
  errors = root.Substance.errors;
  _ = root._;
  Chronicle = root.Substance.Chronicle;
}

// Module
// ====

var IndexImpl = function() {
  Chronicle.Index.call(this);
};

IndexImpl.__prototype__ = function() {

  var __private__ = new IndexImpl.__private__();
  var ROOT = Chronicle.Index.ROOT;

  this.add = function(change) {
    var id = change.id;

    // sanity check: parents must
    if (!change.parent) throw new errors.ChronicleError("Change does not have a parent.");

    if (!this.changes[change.parent])
      throw new errors.ChronicleError("Illegal change: parent is unknown - change=" + id + ", parent=" + change.parent);

    this.changes[id] = change;
    this.children[change.parent].push(id);
    this.children[id] = [];
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
      if (id === root || id === ROOT.id) break;
      // Note: we are traversing from head to root
      // the applies need to be in reverse order
      applies.unshift(id);
    }

    return Chronicle.Diff.create(start, reverts, applies);
  };

  this.shortestPath = function(start, end) {

    // trivial cases
    if (start === end) return [];
    if (end === ROOT) return __private__.getPathToRoot(start);
    if (start === ROOT) return __private__.getPathToRoot(end).reverse();

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

};

IndexImpl.__private__ = function() {

  var ROOT = Chronicle.Index.ROOT;

  this.getPathToRoot = function(id) {
    var result = [];

    if (id === ROOT.id) return result;

    var current = this.get(id);
    if(!current) throw new errors.ChronicleError("Unknown change: "+id);

    var parent;
    while(true) {
      result.push(current.id);
      if(current.id === ROOT.id) break;

      parent = current.parent;
      current = this.get(parent);
    }

    return result;
  };

};

IndexImpl.__prototype__.prototype = Chronicle.Index.prototype;
IndexImpl.prototype = new IndexImpl.__prototype__();

Chronicle.Index.create = function() {
  return new IndexImpl();
};

var DiffImpl = function(data) {
  this.data = data;
};

DiffImpl.__prototype__ = function() {

  this.reverts = function() {
    return this.data[1].slice(1, this.data[0]+1);
  };

  this.applies = function() {
    return this.data[1].slice(this.data[0]+1);
  };

  this.hasReverts = function() {
    return this.data[0]>0;
  };

  this.hasApplies = function() {
    return this.data[1].length-1-this.data[0] > 0;
  };

  this.start = function() {
    return this.data[1][0];
  };

  this.end = function() {
    return _.last(this.data[1]);
  };

  this.sequence = function() {
    return this.data[1].slice(0);
  };

  this.inverted = function() {
    return new DiffImpl([this.data[1].length-1-this.data[0], this.data[1].slice(0).reverse()]);
  };

  this.toJSON = function() {
    return {
      data: this.data
    };
  };
};

DiffImpl.__prototype__.prototype = Chronicle.Diff.prototype;
DiffImpl.prototype = new DiffImpl.__prototype__();

TmpIndex = function(index) {
  IndexImpl.call(this);
  this.index = index;
};

TmpIndex.__prototype__ = function() {

  var __super__ = util.prototype(this);

  this.get = function(id) {
    if (__super__.contains.call(this, id)) {
      return __super__.get.call(this, id);
    }
    return this.index.get(id);
  };

  this.contains = function(id) {
    return __super__.contains.call(this, id) || this.index.contains(id); 
  };

  this.children = function(id) {
    if (__super__.contains.call(this, id)) {
      return __super__.children.call(this, id);
    }
    return this.index.getChildren(this);
  };

  this.list = function() {
    return __super__.list.call(this).concat(this.index.list());
  };

  this.save = function(id, recurse) {
    if (recurse) {
      var queue = [id];
      var nextId, next;
      while(queue.length > 0) {
        nextId = queue.shift();
        if (!this.changes[nextId]) throw new errors.ChronicleError("Illegal State: temporary index does not contain change with id "+nextId);
        next = this.changes[nextId];
        this.index.add(next);
        for (var idx=0; idx < next.children; idx++) {
        }
      }
    } else {
      if (!this.changes[id]) throw new errors.ChronicleError("Illegal State: temporary index does not contain change with id "+id);
      this.index.add(this.changes[id]);
    }
  };
};
TmpIndex.__prototype__.prototype = IndexImpl.prototype;
TmpIndex.prototype = new TmpIndex.__prototype__();



// Export
// ====

Chronicle.Diff.create = function(id, reverts, applies) {
  return new DiffImpl([reverts.length, [id].concat(reverts).concat(applies)]);
};

Chronicle.TmpIndex = TmpIndex;

})(this);
