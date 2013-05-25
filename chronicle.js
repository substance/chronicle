(function(root) {

if (typeof exports !== 'undefined') {
  var util = root.Substance.util;
  var errors = root.Substance.errors;
  var _ = root._;
} else {
  throw "Node.js support not yet implemented";
}

var ChronicleError = errors.define("ChronicleError", -1);

var CommitError = errors.define("CommitError", -1);

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
  this.parents = options.parent || [];
  this.data = options.data || ‚{};
}

// A dedicated Change for merging multiple Chronicle histories.
// ======
// A merge is described by a 'diff' command for each merged parent commit.
//
// Diff commands have the following syntax:
//    "( (+ | -) sha+ )+"
// '+' denotes the beginning of a sequence of commits to be applied
// '-' a sequence of reverts.
//
// Example:
//
//  Consider two sequences of changes [c11, c12] and [c21, c22, c23].
//
//  A merge taking all commits of the second ('theirs') branch and
//  rejecting those of the first ('mine') would be:
//
//    diff = {
//      "c12": ["-", "c12", "c11", "+", "c21", "c22", "c23"],
//      "c23": []
//    }
//
// A manually selected merge with [c11, c21, c23] would look like:
//
//    diff = {
//      "c12": ["-", "c12", "+", "c21", "c23"],
//      "c23": ["-", "c23", "c22", "c21", "+", "c11", "c21", "c23"]
//    }
//
var Merge = function(diff, options) {
  Commit.call(this, options);
  this.parents = _.keys(diff);
  _.extend(this.data, diff);
};
Merge.prototype = Commit.prototype;

// A Chronicle contains the history of a versioned object.
// ========
//
var Chronicle = function(index, versioned) {

  // an instance implementing the 'Index' interface
  this.index = index;

  // the versioned object which must implement the 'Versioned' interface.
  this.versioned = versioned;

};

Chronicle.__prototype__ = function() {

  // Records a change
  // ----
  // Creates a commit and inserts it into the index at
  // the current position (HEAD)
  // This is called by the application. 'change' should contain everything that
  // allows to apply or revert the commit.
  //
  // Note: this corresponds to a 'git commit' in git.
  //
  this.record = function(change) {
    throw new errors.SubstanceError("Not implemented.");
  }

  // Reset to a specific version.
  // ----
  // Brings the versioned object as well as the index to the state
  // of the given commit.
  //
  // Note: this corresponds to a 'git reset --hard' in git.
  //
  this.reset = function(sha) {
    throw new errors.SubstanceError("Not implemented.");
  }

  // Imports all commits from another index
  // ----
  //
  // Note: this corresponds to a 'git fetch', which only adds commits without
  // applying any changes.
  //
  this.import = function(otherIndex) {
    throw new errors.SubstanceError("Not implemented.");
  }

  // Create a commit that merges a history specified by its last commit.
  // ----
  // The strategy specifies how the merge should be generated.
  // 'mine':   reject the changes of the other branch
  // 'theirs': reject the changes of this branch
  // 'manual': compute a merge that leads to the given sequence.
  //
  // Throws a MergeError if the merge can not be applied.
  this.merge = function(sha, strategy, sequence) {
    throw new errors.SubstanceError("Not implemented.");
  }
};
Chronicle.prototype = new Chronicle.__prototype__();

// A directed acyclic graph of Commit instances.
// ========
//
var Index = function() {};
Index.__prototype__ = function() {
  // TODO: directed graph implementation
};
Index.prototype = new Index.__prototype__();

// A interface that must be implemented by objects that should be versioned.
var Versioned = function() {};
Versioned.__prototype__ = function() {

  // Applies a commit.
  // -----
  // throws a CommitError if the commit could not be applied
  this.apply = function(commit) {
    throw new errors.SubstanceError("Not implemented.");
  };

  // Reverts the last applied commit
  // -----
  // For reverting Merge commits the parent sha has to be given.
  this.revert = function(sha) {
    throw new errors.SubstanceError("Not implemented.");
  }

  // Provides the sha of the last applied commit.
  // ----
  //
  this.head = function() {
    throw new errors.SubstanceError("Not implemented.");
  }
};
Versioned.prototype = new Versioned.__prototype__();

})(this);
