(function(root) {

if (typeof exports === 'undefined') {
  var util = root.Substance.util;
  var errors = root.Substance.errors;
  var _ = root._;
} else {
  throw "Node.js support not implemented";
}

var ChronicleError = errors.define("ChronicleError", -1);

var ChangeError = errors.define("ChangeError", -1);

var MergeError = function(message, data) {
  errors.SubstanceError.call(this, "MergeError", -1, message);
  this.data = data;
};
errors.MergeError = MergeError;

// A change recorded in the chronicle
// ========
// Each change has an unique id (equivalent to git SHA).
// A change can have multiple parents (merge).
//
var Change = function(options) {
  options = options || {};
  this.id = options.id || util.uuid();
  this.parents = options.parents || [];
  this.data = options.data || {};
};

Change.prototype = {
  toJSON: function() {
    return {
      id: this.id,
      parents: this.parents,
      data: this.data
    };
  }
};

// A dedicated Change for merging multiple Chronicle histories.
// ======
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

var Merge = function(diff, options) {
  Change.call(this, options);
  this.parents = _.keys(diff);
  this.diff = diff;
};

Merge.__prototype__ = function() {
  this.toJSON = function() {
    return {
      id: this.id,
      parents: this.parents,
      diff: this.diff
    };
  };
};
Merge.__prototype__.prototype = Change.prototype;
Merge.prototype = new Merge.__prototype__();

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

  // Provides the changes that will be reverted
  // ----

  reverts: function() {
    throw new errors.SubstanceError("Not implemented.");
  },

  // Provides the changes that will applied
  // ----

  applies: function() {
    throw new errors.SubstanceError("Not implemented.");
  },

  // Provides the sequence of states visited by this diff.
  // ----

  sequence: function() {
    throw new errors.SubstanceError("Not implemented.");
  },

  // Provides the version this diff has to be applied on.
  // ----

  start: function() {
    throw new errors.SubstanceError("Not implemented.");
  },

  // Provides the version which is generated by applying this diff.
  // ----

  end: function() {
    throw new errors.SubstanceError("Not implemented.");
  },

  // Provides a copy that represents the inversion of this diff.
  // ----

  inverted: function() {
    throw new errors.SubstanceError("Not implemented.");
  },

};

// Creates a new diff for the given reverts and applies
// ----
// Note this factory is provided when loading index_impl.js

Diff.create = function(reverts, applies) {
  throw new errors.SubstanceError("Not implemented.");
}


// A Chronicle contains the history of a versioned object.
// ========
//
var Chronicle = function(index) {

  // an instance implementing the 'Index' interface
  this.index = index;

  // the versioned object which must implement the 'Versioned' interface.
  this.versioned = null;

};

Chronicle.__prototype__ = function() {

  // Records a change
  // ----
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

  // Reset to a specific version.
  // ----
  // Brings the versioned object as well as the index to the state
  // of the given change.
  //
  // Note: this corresponds to a 'git reset --hard' in git.

  this.reset = function(changeId) {
    throw new errors.SubstanceError("Not implemented.");
  };

  // Imports all commits from another index
  // ----
  //
  // Note: this corresponds to a 'git fetch', which only adds commits without
  // applying any changes.

  this.import = function(otherIndex) {
    throw new errors.SubstanceError("Not implemented.");
  };

  // Create a commit that merges a history specified by its last commit.
  // ----
  // The strategy specifies how the merge should be generated.
  //
  //  'mine':   reject the changes of the other branch
  //  'theirs': reject the changes of this branch
  //  'manual': compute a merge that leads to the given sequence.
  //
  // throws a MergeError if the merge can not be applied.

  this.merge = function(sha, strategy, sequence) {
    throw new errors.SubstanceError("Not implemented.");
  };

  // Making this instance the chronicler of the given Versioned instance.
  // ----
  //

  this.manage = function(versioned) {
    this.versioned = versioned;
  };

};

Chronicle.prototype = new Chronicle.__prototype__();

// enables early failing sanity checks
Chronicle.HYSTERICAL = false;

Chronicle.create = function(index, versioned) {
  throw new errors.SubstanceError("Not implemented.");
};

Chronicle.uuid = function() {
  return util.uuid();
}

// A directed acyclic graph of Commit instances.
// ========
//
var Index = function() {
  this.changes = {}
  this.changes[Chronicle.Index.ROOT_ID] = Chronicle.Index.ROOT;
};

Index.__prototype__ = function() {

  // Adds a change to the index.
  // ----
  //

  this.add = function(change) {
    throw new errors.SubstanceError("Not implemented.");
  }

  // Checks if a given changeId has been added to the index.
  // ----
  //

  this.contains = function(changeId) {
    throw new errors.SubstanceError("Not implemented.");
  }

  // Retrieves a change by id
  // ----
  //

  this.get = function(id) {
    throw new errors.SubstanceError("Not implemented.");
  }

  // Lists the ids of all contained changes
  // ----
  //

  this.list = function() {
    throw new errors.SubstanceError("Not implemented.");
  };

  // Computes the difference betweend two changes
  // ----
  //
  // The computed diff is not necessarily the shortest one.
  // For sake of simplicity, revert sequences follow the first parent (see merge).
  // This may be optimized later.

  this.diff = function(start, end) {
    throw new errors.SubstanceError("Not implemented.");
  }

};

Index.prototype = new Index.__prototype__();

Index.ROOT_ID = "ROOT";
Index.ROOT = new Change({
    id: Index.ROOT_ID
});

Index.create = function() {
  throw new errors.SubstanceError("Not implemented.");
};


// A interface that must be implemented by objects that should be versioned.
var Versioned = function() {};

Versioned.__prototype__ = function() {

  // Applies a change.
  // -----
  // throws a ChangeError if the commit could not be applied
  this.apply = function(change) {
    throw new errors.SubstanceError("Not implemented.");
  };

  // Reverts the last applied change
  // -----
  // For reverting a Merge a the id of the parent change has to be given.
  this.revert = function(parentId) {
    throw new errors.SubstanceError("Not implemented.");
  }

  // Provides the id of the last applied change.
  // ----
  //
  this.getHead = function() {
    throw new errors.SubstanceError("Not implemented.");
  }

  // Stores an updated head
  // -----
  // this gets called by this.record() after a change has been recorded.

  this.setHead = function(head) {
    throw new errors.SubstanceError("Not implemented.");
  }

  // Resets the versioned object to a clean state.
  // -----
  // This is only used as a last-resort when incremental applications fail
  // to reach a state by applying from scratch.

  this.reset = function() {
    throw new errors.SubstanceError("Not implemented.");
  }
};

Versioned.prototype = new Versioned.__prototype__();

Chronicle.Change = Change;
Chronicle.Merge = Merge;
Chronicle.Diff = Diff;
Chronicle.Index = Index;
Chronicle.Versioned = Versioned;

if (typeof exports === 'undefined') {
  root.Substance.Chronicle = Chronicle
} else {
  module.exports = Chronicle;
}

})(this);