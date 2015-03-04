"use strict";

/*jshint unused: false*/ // deactivating this, as we define abstract interfaces here

var Substance = require('substance');
var ChronicleError = require('./chronicle_error');
var Change = require('./change');
var ROOT = require('./constants').ROOT;

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

  this.record = function(changeData) {
    // Sanity check: the change should have been applied already.
    // Reverting and applying should not fail.
    if ((this.__mode__ & Chronicle.PEDANTIC_RECORD) > 0) {
      this.versioned.revert(changeData);
      this.versioned.apply(changeData);
    }

    // 1. create a new change instance
    var head = this.versioned.getState();
    var id = this.uuid();
    var change = new Chronicle.Change(id, head, changeData);

    // 2. add change to index
    this.index.add(change);

    // 3. shift head
    this.versioned.setState(id);

    return id;
  };

  // Reset to a specific version.
  // --------
  //
  // Brings the versioned object as well as the index to the state
  // of the given state.
  //

  this.reset = function(id, index) {
    index = index || this.index;

    // the given id must be available
    if (!index.contains(id)) {
      throw new ChronicleError("Invalid argument: unknown change "+id);
    }

    // 1. compute diff between current state and the given id
    var head = this.versioned.getState();
    var path = index.shortestPath(head, id);

    // 2. apply path
    this.__applySequence(path, index);
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

  this.step = function(nextId) {
    var index = this.index;
    var originalState = this.versioned.getState();

    try {
      var current = index.get(originalState);

      // tolerate nop-transitions
      if (current.id === nextId) return null;

      var next = index.get(nextId);

      var op;
      if (current.parent === nextId) {
        op = this.versioned.invert(current.data);
      } else if (next.parent === current.id) {
        op = next.data;
      }
      else {
        throw new ChronicleError("Invalid apply sequence: "+nextId+" is not parent or child of "+current.id);
      }

      this.versioned.apply(op);
      this.versioned.setState(nextId);
      return op;

    } catch(err) {
      this.reset(originalState, index);
      throw err;
    }
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

    Substance.each(path, function(id) {
      changes.push(this.index.get(id));
    }, this);

    return changes;
  };

  this.canRedo = function() {
    var state = this.versioned.getState();
    var children = this.index.children[state];
    return children.length > 0;
  };

  this.canUndo = function() {
    var root = this.index.get(ROOT);
    var current = this.index.get(this.versioned.getState());
    return (current !== root);
  };

  /* Internal methods */

  this.uuid = Substance.uuid;

  this.internal_uuid = Substance.uuid;

  this.__path = function(id1, id2) {
    if (!id2) {
      var path = this.index.shortestPath(ROOT, id1 || this.versioned.getState());
      path.shift();
      return path;
    } else {
      if (!id1) throw new ChronicleError("Illegal argument: "+id1);
      return this.index.shortestPath(id1, id2);
    }
  };

  this.__applySequence = function(seq, index) {
    index = index || this.index;

    var originalState = this.versioned.getState();

    try {
      var current = index.get(originalState);
      Substance.each(seq, function(id) {

        // tolerate nop-transitions
        if (current.id === id) return;

        var next = index.get(id);

        // revert
        if (current.parent === id) {
          this.__revertTo(id, index);
        }
        // apply
        else if (next.parent === current.id) {
          this.__forwardTo(id, index);
        }
        else {
          throw new ChronicleError("Invalid apply sequence: "+id+" is not parent or child of "+current.id);
        }
        current = next;

      }, this);
    } catch(err) {
      this.reset(originalState, index);
      throw err;
    }
  };

  // Performs a single revert step
  // --------

  this.__revertTo = function(id, index) {
    index = index || this.index;

    var head = this.versioned.getState();
    var current = index.get(head);

    // sanity checks
    if (!current) throw new ChronicleError("Illegal state. 'head' is unknown: "+ head);
    if (current.parent !== id) throw new ChronicleError("Can not revert: change is not parent of current");

    // Note: Merge nodes do not have data
    if (current.data) this.versioned.revert(current.data);
    this.versioned.setState(id);
  };

  // Performs a single forward step
  // --------

  this.__forwardTo = function(id, index) {
    index = index || this.index;

    var change = index.get(id);

    // sanity check
    if (!change) throw new ChronicleError("Illegal argument. change is unknown: "+ id);

    if (change.data) this.versioned.apply(change.data);
    this.versioned.setState(id);
  };

};

Substance.initClass(Chronicle);

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
  options = options || {};
  var index = Chronicle.Index.create(options);
  return new Chronicle(index, options);
};

Chronicle.Change = Change;
Chronicle.ROOT = ROOT;

module.exports = Chronicle;
