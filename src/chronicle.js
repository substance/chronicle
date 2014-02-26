"use strict";

/*jshint unused: false*/ // deactivating this, as we define abstract interfaces here

var _ = require('underscore');
var util = require('substance-util');
var errors = util.errors;

errors.define("ChronicleError", -1);
errors.define("ChangeError", -1);

// A change recorded in the chronicle
// ========
//
// Each change has an unique id (equivalent to git SHA).
// A change can have multiple parents (merge).
//
// options:
//   - id: a custom id for the change

var Change = function(id, parent, data) {

  this.type = 'change';

  if (!id) {
    throw new errors.ChangeError("Every change needs a unique id.");
  }
  this.id = id;

  if (!parent) {
    throw new errors.ChangeError("Every change needs a parent.");
  }

  this.parent = parent;

  // Application specific data
  // --------
  //
  // This needs to contain all information to be able to apply and revert
  // a change.

  this.data = data;

  this.uuid = util.uuid;

};

Change.prototype = {

  toJSON: function() {
    return {
      type: this.type,
      id: this.id,
      parent: this.parent,
      data: this.data
    };
  }

};

Change.fromJSON = function(json) {
  if (json.type === Merge.TYPE) return new Merge(json);
  if (json.type === Transformed.TYPE) return new Transformed(json);

  return new Change(json.parent, json.data, json);
};

// a dedicated global root node
var ROOT = "ROOT";
var ROOT_NODE = new Change(ROOT, true, null);
ROOT_NODE.parent = ROOT;

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
    throw new errors.ChangeError("Missing branches.");
  }
  this.branches = branches;
};

Merge.Prototype = function() {

  var __super__ = util.prototype(this);

  this.toJSON = function() {
    var result = __super__.toJSON.call(this);
    result.type = Merge.TYPE;
    result.branches = this.branches;
    return result;
  };

};
Merge.Prototype.prototype = Change.prototype;
Merge.prototype = new Merge.Prototype();

Merge.TYPE =  "merge";

Merge.fromJSON = function(data) {
  if (data.type !== Merge.TYPE) throw new errors.ChangeError("Illegal data for deserializing a Merge node.");
  return new Merge(data.parent, data.branches, data);
};

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

  var __super__ = util.prototype(this);

  this.toJSON = function() {
    var result = __super__.toJSON.call(this);
    result.type = Transformed.TYPE;
    result.original = this.original;
    return result;
  };

};

Transformed.TYPE = "transformed";

Transformed.fromJSON = function(json) {
  if (json.type !== Transformed.TYPE) throw new errors.ChangeError("Illegal data for deserializing a Transformed node.");
  return new Transformed(json.parent, json.data, json.original, json);
};


Transformed.Prototype.prototype = Change.prototype;
Transformed.prototype = new Transformed.Prototype();

// A class that describes the difference of two states by
// a sequence of changes (reverts and applies).
// =======
//
// The difference is a sequence of commands that forms a transition from
// one state to another.
//
// A diff is specified using the following syntax:
//    [- sha [shas ...]] [+ sha [shas ...]]
// where '-' preceeds a sequence reverts and '+' a sequence of applies.
// Any diff can be described in that order (reverts followed by applies)
//
// Example: Consider an index containing the following changes
//
//        , - c11 - c12
//      c0
//        ` - c21 - c22 - c23
//
// Diffs for possible transitions look like:
// "c21" -> "c23" : ["+", "c22", "c23"]
// "c12" -> "c0" :  ["-", "c11", "c0" ]
// "c21" -> "c11" : ["-", "c0", "+", "c11"]

var Diff = function() {};

Diff.prototype = {

  hasReverts: function() {
    throw new errors.SubstanceError("Not implemented.");
  },

  // Provides the changes that will be reverted
  // --------

  reverts: function() {
    throw new errors.SubstanceError("Not implemented.");
  },

  hasApplies: function() {
    throw new errors.SubstanceError("Not implemented.");
  },

  // Provides the changes that will applied
  // --------

  applies: function() {
    throw new errors.SubstanceError("Not implemented.");
  },

  // Provides the sequence of states visited by this diff.
  // --------

  sequence: function() {
    throw new errors.SubstanceError("Not implemented.");
  },

  // Provides the path from the root to the first change
  // --------
  //
  // The naming refers to a typical diff situation where
  // two branches are compared. The first branch containing the own
  // changes, the second one the others.

  mine: function() {
    throw new errors.SubstanceError("Not implemented.");
  },

  // Provides the path from the root to the second change
  // --------
  //

  theirs: function() {
    throw new errors.SubstanceError("Not implemented.");
  },

  // Provides the common root of the compared branches.
  // --------
  //

  root: function() {
    throw new errors.SubstanceError("Not implemented.");
  },

  // Provides the version this diff has to be applied on.
  // --------

  start: function() {
    throw new errors.SubstanceError("Not implemented.");
  },

  // Provides the version which is generated by applying this diff.
  // --------

  end: function() {
    throw new errors.SubstanceError("Not implemented.");
  },

  // Provides a copy that represents the inversion of this diff.
  // --------

  inverted: function() {
    throw new errors.SubstanceError("Not implemented.");
  },

};

// Creates a new diff for the given reverts and applies
// --------
// Note this factory is provided when loading index_impl.js

Diff.create = function(reverts, applies) {
  /*jshint unused: false*/
  throw new errors.SubstanceError("Not implemented.");
};


// A Chronicle contains the history of a versioned object.
// ========
//

var Chronicle = function(index, options) {
  options = options || {};

  // an instance implementing the 'Index' interface
  this.index = index;

  // the versioned object which must implement the 'Versioned' interface.
  this.versioned = null;

  // flags to control the chronicle's behaviour
  this.__mode__ = options.mode || Chronicle.DEFAULT_MODE;
};

Chronicle.Prototype = function() {

  // Records a change
  // --------
  //
  // Creates a commit and inserts it into the index at the current position.
  //
  // An application should call this after having applied the change to the model successfully.
  // The provided 'change' should contain every information that is necessary to
  // apply the change in both directions (apply and revert).
  //
  // Note: this corresponds to a 'git commit' in git.

  this.record = function(change) {
    throw new errors.SubstanceError("Not implemented.");
  };

  // Opens a specific version.
  // --------
  //
  // Brings the versioned object as well as the index to the state
  // of the given state.
  //

  this.open = function(version) {
    throw new errors.SubstanceError("Not implemented.");
  };

  // Performs an incremental transformation.
  // --------
  //
  // The given state must be a direct neighbor of the current state.
  // For convenience a sequence of consecutive states can be given.
  //
  // Call this if you already know path between two states
  // or if you want to apply or revert a single change.
  //
  // Returns the change applied by the step.
  //

  this.step = function(next) {
    throw new errors.SubstanceError("Not implemented.");
  };

  this.forward = function(toward) {
    var state = this.versioned.getState();
    if (state === toward) return;

    var children = this.index.children[state];

    if (children.length === 0) return;

    var next;

    if (children.length === 1) {
      next = children[0];
    }
    else if (toward) {
      var path = this.index.shortestPath(state, toward);
      path.shift();
      next = path.shift();
    }
    else {
      next = children[children.length-1];
    }

    if (next) {
      return this.step(next);
    } else {
      return;
    }
  };

  this.rewind = function() {
    var current = this.index.get(this.versioned.getState());
    var previous;
    if (current.id === ROOT) return null;

    previous = current.parent;
    return this.step(previous);
  };

  // Create a commit that merges a history specified by its last commit.
  // --------
  //
  // The strategy specifies how the merge should be generated.
  //
  //  'mine':   reject the changes of the other branch
  //  'theirs': reject the changes of this branch
  //  'manual': compute a merge that leads to the given sequence.
  //
  // Returns the id of the new state.
  //

  this.merge = function(state, strategy, sequence) {
    throw new errors.SubstanceError("Not implemented.");
  };

  // Making this instance the chronicler of the given Versioned instance.
  // --------
  //

  this.manage = function(versioned) {
    this.versioned = versioned;
  };

  // Marks the current version.
  // --------
  //

  this.mark = function(name) {
    this.index.setRef(name, this.versioned.getState());
  };

  // Provides the id of a previously marked version.
  // --------
  //

  this.find = function(name) {
    return this.index.getRef(name);
  };

  // Get the current version.
  // --------
  //

  this.getState = function() {
    return this.versioned.getState();
  };

  // Retrieve changes.
  // --------
  //
  // If no range is given a full path is returned.

  this.getChanges = function(start, end) {
    var changes = [];
    var path = this.path(start, end);

    _.each(path, function(id) {
      changes.push(this.index.get(id));
    }, this);

    return changes;
  };

};

Chronicle.prototype = new Chronicle.Prototype();

// only allow changes that have been checked via instant apply+revert
Chronicle.PEDANTIC_RECORD = 1 << 1;

// performs a reset for all imported changes
Chronicle.PEDANTIC_IMPORT = 1 << 2;

Chronicle.HYSTERICAL = Chronicle.PEDANTIC_RECORD | Chronicle.PEDANTIC_IMPORT;
Chronicle.DEFAULT_MODE = Chronicle.PEDANTIC_IMPORT;

// The factory method to create a Chronicle instance
// --------
// options:
//  store: a Substance Store used to persist the index
Chronicle.create = function(options) {
  throw new errors.SubstanceError("Not implemented.");
};

// A directed acyclic graph of Commit instances.
// ========
//
var Index = function() {
  this.__id__ = util.uuid();

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
    throw new errors.SubstanceError("Not implemented.");
  };

  // Removes a change from the index
  // --------
  // All children must be removed first, otherwise throws an error.
  //

  this.remove = function(id) {
    throw new errors.SubstanceError("Not implemented.");
  };

  // Checks if a given changeId has been added to the index.
  // --------
  //

  this.contains = function(changeId) {
    throw new errors.SubstanceError("Not implemented.");
  };

  // Retrieves a (shortest) path between two versions
  // --------
  //
  // If no end change is given it returns the path starting
  // from ROOT to the start change.
  // path() returns the path from ROOT to the current state.
  //

  this.path = function(start, end) {
    throw new errors.SubstanceError("Not implemented.");
  };

  // Retrieves a change by id
  // --------
  //

  this.get = function(id) {
    throw new errors.SubstanceError("Not implemented.");
  };

  // Provides all changes that are direct successors of this change.
  // --------
  //

  this.getChildren = function(id) {
    throw new errors.SubstanceError("Not implemented.");
  };

  // Lists the ids of all contained changes
  // --------
  //

  this.list = function() {
    throw new errors.SubstanceError("Not implemented.");
  };

  // Computes the difference betweend two changes
  // --------
  //
  // In contrast to `path` is a diff a special path that consists
  // of a sequence of reverts followed by a sequence of applies.
  //

  this.diff = function(start, end) {
    throw new errors.SubstanceError("Not implemented.");
  };

  // Sets a reference to look up a change via name.
  // ---------
  //

  this.setRef = function(name, id) {
    if (this.changes[id] === undefined) {
      throw new errors.ChronicleError("Unknown change: " + id);
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

  // Imports all commits from another index
  // --------
  //
  // Note: this corresponds to a 'git fetch', which only adds commits without
  // applying any changes.
  //

  this.import = function(otherIndex) {
    throw new errors.SubstanceError("Not implemented.");
  };

};

Index.prototype = new Index.Prototype();

Index.INVALID = "INVALID";
Index.ROOT = ROOT_NODE;

Index.create = function() {
  throw new errors.SubstanceError("Not implemented.");
};

// Creates an adapter for Changes given as plain hash.
// The adapter can be used together with Index.import
Index.adapt = function(changes) {
  return {
    list: function() {
      return _.keys(changes);
    },
    get: function(id) {
      return changes[id];
    }
  };
};

// A interface that must be implemented by objects that should be versioned.
var Versioned = function(chronicle) {
  this.chronicle = chronicle;
  this.state = ROOT;
  chronicle.manage(this);
};

Versioned.Prototype = function() {

  // Applies the given change.
  // --------
  //

  this.apply = function(change) {
    throw new errors.SubstanceError("Not implemented.");
  };

  // Reverts the given change.
  // --------
  //

  this.revert = function(change) {
    change = this.invert(change);
    this.apply(change);
  };

  // Inverts a given change
  // --------
  //

  this.invert = function(change) {
    throw new errors.SubstanceError("Not implemented.");
  };

  // Transforms two sibling changes.
  // --------
  //
  // This is the `transform` operator provided by Operational Transformation.
  //
  //       / - a            / - a - b' \
  //      o          ~ >   o             p
  //       \ - b            \ - b - a' /
  //
  // I.e., the result of applying `a - b'` must lead to the same result as
  // applying `b - a'`.
  //
  // options:
  //
  //  - check:    enables conflict checking. A MergeConflict is thrown as an error
  //              when a conflict is found during transformation.
  //  - inplace:  transforms the given instances a and b directly, without copying.
  //
  // returns: [a', b']

  this.transform = function(a, b, options) {
    throw new errors.SubstanceError("Not implemented.");
  };

  // Provides the current state.
  // --------
  //

  this.getState = function() {
    return this.state;
  };

  // Sets the state.
  // --------
  //
  // Note: this is necessary for implementing merges.
  //

  this.setState = function(state) {
    this.state = state;
  };

  // Resets the versioned object to a clean state.
  // --------
  //

  this.reset = function() {
    this.state = ROOT;
  };
};

Versioned.prototype = new Versioned.Prototype();

Chronicle.Change = Change;
Chronicle.Merge = Merge;
Chronicle.Transformed = Transformed;
Chronicle.Diff = Diff;
Chronicle.Index = Index;
Chronicle.Versioned = Versioned;
Chronicle.ROOT = ROOT;

Chronicle.mergeConflict = function(a, b) {
  var conflict = new errors.MergeConflict("Merge conflict: " + JSON.stringify(a) +" vs " + JSON.stringify(b));
  conflict.a = a;
  conflict.b = b;
  return conflict;
};

module.exports = Chronicle;
