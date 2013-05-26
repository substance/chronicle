(function(root) {

if (typeof exports === 'undefined') {
  var util = root.Substance.util;
  var errors = root.Substance.errors;
  var _ = root._;
  var Chronicle = root.Substance.Chronicle;
} else {
  throw "Node.js support not implemented";
}

var IndexImpl = function() {
  Chronicle.Index.call(this);
};

IndexImpl.__prototype__ = function() {

  var private = new IndexImpl.__private__();
  var ROOT = Chronicle.Index.ROOT;

  this.add = function(change) {
    // sanity check: parents must exist
    for (var idx=0; idx<change.parents.length; idx++) {
      var parent = change.parents[idx];
      if (!this.changes[parent])
        throw new errors.ChronicleError("Illegal change: parent is unknown - change="+change.id+", parent="+parent);
    }
    this.changes[change.id] = change;
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

  this.diff = function(start, end) {

    // for now a naive implemention
    var path1 = private.getPathToRoot.call(this, start);
    var path2 = private.getPathToRoot.call(this, end);

    reverts = [];
    applies = [];

    var tmp = {};
    for (var idx=0; idx < path2.length; idx++) {
      tmp[path2[idx]] = true;
    }

    var id;
    for (var idx=0; idx < path1.length; idx++) {
      id = path1[idx];
      // The first change is not included in the revert list
      // The common root
      if(idx > 0) reverts.push(id);
      if(tmp[id]) break;
    }

    var root = id;

    for (var idx=0; idx < path2.length; idx++) {
      id = path2[idx];
      if (id === root || id === ROOT.id) break;
      // Note: we are traversing from head to root
      // the applies need to be in reverse order
      applies.unshift(id);
    }

    return Chronicle.Diff.create(start, reverts, applies);
  };

};

IndexImpl.__private__ = function() {

  var private = this;
  var ROOT = Chronicle.Index.ROOT;

  this.getPathToRoot = function(id) {
    var result = [];

    if (id === ROOT.id) return result;

    var current = this.changes[id];
    if(!current) throw new errors.ChronicleError("Unknown change: "+id);

    while(true) {
      result.push(current.id);
      if(current.id === ROOT.id) break;
      // Note: for sake of simplicity we take the first parent for traversal
      // This might lead to suboptimal diffs,
      // though, for now it is acceptable.
      // Attention: here is a hidden assumption that if ROOT is parent,
      // it is the only parent.
      current = this.changes[current.parents[0]]
    }

    return result;
  }
}

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
    return new DiffImpl([this.data[0], this.data[1].reverse()]);
  };

  this.toJSON = function() {
    return {
      data: this.data
    };
  };
};
DiffImpl.__prototype__.prototype = Chronicle.Diff.prototype;
DiffImpl.prototype = new DiffImpl.__prototype__();

Chronicle.Diff.create = function(id, reverts, applies) {
  return new DiffImpl([reverts.length, [id].concat(reverts).concat(applies)]);
}


})(this);
