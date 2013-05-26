(function(root) {

if (typeof exports === 'undefined') {
  var util = root.Substance.util;
  var errors = root.Substance.errors;
  var _ = root._;
  var Chronicle = root.Substance.Chronicle;
} else {
  throw "Node.js support not implemented";
}

var ChronicleImpl = function(index) {
  Chronicle.call(this, index);
}

ChronicleImpl.__prototype__ = function() {

  var private = new ChronicleImpl.__private__();
  var ROOT = Chronicle.Index.ROOT.id;

  this.record = function(changeData) {
    // Sanity check: the change should have been applied already.
    // Reverting and applying should not fail.
    if (Chronicle.HYSTERICAL) {
      this.versioned.revert(changeData);
      this.versioned.apply(changeData);
    }

    // 1. create a new change instance
    var head = this.versioned.getHead();
    var id = Chronicle.uuid();
    var change = new Chronicle.Change({
      id: id,
      parents: [head],
      data: changeData
    });

    // 2. add change to index
    this.index.add(change);

    // 3. shift head
    this.versioned.setHead(id);
  };

  this.reset = function(id) {
    // sanity check: see if the given id is available
    if (Chronicle.HYSTERICAL && !this.index.contains(id)) {
      throw new errors.ChronicleError("Invalid argument: unknown change "+id);
    }

    // 1. compute diff between current state and the given id
    var head = this.versioned.getHead();
    var diff = this.index.diff(head, id);

    // 2. apply diff
    private.applyDiff.call(this, diff);
  };

  this.apply = function(sha) {
    if (_.isArray(sha)) {
      return private.applySequence.apply(this, sha);
    } else {
      return private.applySequence.apply(this, arguments);
    }
  }

  this.import = function(otherIndex) {
    // 1. index difference (only ids)
    var newIds = _.difference(otherIndex.list(), this.index.list());
    if (newIds.length == 0) return;

    // 2. compute correct order
    // Note: changes have to added according to their dependencies.
    // I.e., a change can only be added after all parents have been added.
    // OTOH, changes have to be removed in reverse order.
    var order = private.computeDependencyOrder.call(this, otherIndex, newIds);

    // now they are topologically sorted
    newIds.sort(function(a,b){ return (order[a] - order[b]); });

    // 2. add changes to the index
    for (var idx = 0; idx < newIds.length; idx++) {
      this.index.add(otherIndex.get(newIds[idx]));
    }

    // sanity check: see if all imported changes can be applied
    if (Chronicle.HYSTERICAL) private.importSanityCheck.call(this, newIds);

  };

  this.merge = function(id, strategy, options) {
    // sanity check: see if the given id is available
    if (Chronicle.HYSTERICAL && !this.index.contains(id))
      throw new errors.ChronicleError("Invalid argument: unknown change "+id);

    if(arguments.length == 1) {
      strategy = "auto";
      options = {};
    }

    options = options || {};

    var head = this.versioned.getHead();
    var diff1 = this.index.diff(head, id);

    // 1. check for simple cases

    // 1.1. don't do anything if the other merge is already merged
    if (!diff1.hasApplies()) {
      return head;
    }

    // 1.2. check if the merge can be solved by simple applies (so called fast-forward)
    if (!diff1.hasReverts() && !options.no_ff) {
      private.applyDiff.call(this, diff1);
      return this.versioned.getHead();
    }

    // 2. create a merging change
    var diff2 = this.index.diff(id, head);

    var current = this.index.get(head);
    var other = this.index.get(id);

    var data = {};
    if (strategy === "mine") {
      data[head] = Chronicle.Diff.create(head, [], []);
      data[id] = diff2;
    } else if (strategy === "theirs") {
      data[head] = diff1;
      data[id] = Chronicle.Diff.create(id, [], []);
    } else if (strategy === "manual") {
      if (!sequence) throw new errors.ChronicleError("Invalid argument: sequence is missing for manual merge");

      // An empty sequence means that both branches are dropped
      if (sequence.length == 0) {
        // deriving diffs containing only reverts
        // Note: exploiting the knowledge about the data structure
        var reverts1 = diff1.reverts();
        var reverts2 = diff2.reverts();
        data[head] = Chronicle.Diff.create(head, reverts1, []);
        data[id] = Chronicle.Diff.create(id, reverts2, []);
      } else {
        // compute diffs to the first of the sequence
        var reverts1 = this.index.diff(head, sequence[0]).reverts();
        var reverts2 = this.index.diff(id, sequence[0]).reverts();
        // and append the rest of the sequence
        // Note: exploiting the knowledge about the data structure
        data[head] = Chronicle.Diff.create(head, reverts1, sequence.slice(0));
        data[id] = Chronicle.Diff.create(id, reverts2, sequence.slice(0));
      }
    } else {
      throw new ChronicleError("Unsupported merge strategy: "+strategy);
    }
    var change = new Chronicle.Merge(data);

    // (sanity check: see if the manual sequence can be applied)
    if (Chronicle.HYSTERICAL && strategy === "manual") {
      var err = null;
      try {
        var diff = change.diff[head];
        var inverted = diff.inverted();
        private.applyDiff.call(this, diff);
        private.applyDiff.call(this, inverted);
      } catch(_err) {
        err = _err;
      }
    }

    // 2. add the change to the index
    this.index.add(change);

    // 3. apply the change
    private.applyDiff.call(this, change.diff[head]);

    // 4. shift head
    this.versioned.setHead(change.id);
  };

};

ChronicleImpl.__private__ = function() {

  var private = this;
  var ROOT = Chronicle.Index.ROOT.id;

  this.applyDiff = function(diff) {

    if(!diff) return;

    var originalState = this.versioned.getHead();

    // sanity check: don't allow to apply the diff on another change
    if (originalState !== diff.start())
      throw new errors.ChronicleError("Diff can not applied on to this state. Expected: "+diff.start()+", Actual: "+originalState);

    // TODO: I feel that this can radically be simplified.
    // A nice part of using incremental change traversal to describe a diffs
    // is that the repository is never in an invalid state
    // (as long the changes could be applied earlier)
    // On failing it should be enough to call a reset(originalState)
    // TODO try this after having the current changes upstream.

    var err = null;
    var successfulReverts = [];
    var successfulApplies = [];
    try {
      var reverts = diff.reverts();
      // start at idx 1 as the first is the starting id
      for (var idx = 0; idx < reverts.length; idx++) {
        var id = reverts[idx];
        private.revertTo.call(this, id);
        successfulReverts.push(id);
      }
      var applies = diff.applies();
      for (var idx = 0; idx < applies.length; idx++) {
        var id = applies[idx];
        private.apply.call(this, id);
        successfulApplies.push(id);
      }
    } catch(_err) {
      err = _err;
    }

    // if the diff could not be applied, revert all changes that have been applied so far
    if (err && idx > 0) {
      // idx shows to the change that has failed;
      var applied = Chronicle.Diff.create(diff.start(), successfulReverts, successfulApplies);
      var inverted = applied.inverted();
      try {
        private.applyDiff.call(this, inverted);
      } catch(_err) {
        // TODO: maybe we should do that always, instead of minimal rollback?
        console.log("Ohohhhh.... could not rollback partially applied diff.",
          "Without bugs and in HYSTERICAL mode this should not happen.",
          "Resetting to original state");
        this.versioned.reset();
        this.reset(originalState);
      }
    }

    if (err) throw err;
  };

  this.applySequence = function() {
    var originalState = this.versioned.getHead();

    try {
      var current = this.index.get(originalState);
      _.each(arguments, function(id) {
        // tolerate nop-transitions
        if (current.id === id) return;

        var next = this.index.get(id);
        if (current.hasParent(id)) {
          private.revertTo.call(this, id);
        } else if (next.hasParent(current.id)) {
          private.apply.call(this, id);
        } else {
          throw new errors.ChronicleError("Invalid apply sequence: "+id+" is not parent or child of "+current.id);
        }
        current = next;

      }, this);
    } catch(err) {
      this.reset(originalState);
      throw err;
    }
  };

  this.revertTo = function(id) {
    var head = this.versioned.getHead();
    var current = this.index.get(head);

    // sanity checks
    if (!current) throw new errors.ChangeError("Illegal state. 'head' is unknown: "+ head);
    if (current.parents.indexOf(id) < 0) throw new errors.ChangeError("Can not revert: change is not parent of current");

    if (current instanceof Chronicle.Merge) {
      // Note: this is the inverted action of setting the head to id of the merge commit
      var diff = current.diff[id];
      this.versioned.setHead(diff.end());
      private.applyDiff.call(this, diff.inverted());
    } else {
      this.versioned.revert(current.data);
      this.versioned.setHead(id);
    }
  };

  this.apply = function(id) {
    var change = this.index.get(id);
    var current = this.versioned.getHead();

    // sanity check
    if (!change) throw new errors.ChangeError("Illegal argument. change is unknown: "+ id);

    if (change instanceof Chronicle.Merge) {
      private.applyDiff.call(this, change.diff[current]);
      this.versioned.setHead(id);
    } else {
      this.versioned.apply(change.data);
      this.versioned.setHead(id);
    }
  };

  this.computeDependencyOrder = function(other, newIds) {
    var order = {};

    function _order(id) {
      if (order[id]) return order[id];
      var change = other.get(id);

      var o;
      if (change.parents[0] === ROOT) {
        o = 1;
      } else {
        var parents = change.parents;
        var tmp = [];
        for (var idx = 0; idx < parents.length; idx++) {
          tmp.push(_order(parents[idx]));
        }
        // Maxing here as then all children have smaller distance
        o = Math.max.apply(null, tmp) + 1;
      }

      order[id] = o;
      return o;
    }

    for (var idx = 0; idx < newIds.length; idx++) {
      _order(newIds[idx]);
    }

    return order;
  };

  this.importSanityCheck = function(newIds) {
    var head = this.versioned.getHead();

    // This is definitely very hysterical: we try to reach
    // every provided change by resetting to it.
    // If this is possible we are sure that every change has been applied
    // and reverted at least once.
    // This is for sure not a minimalistic approach.
    var err = null;
    try {
      for (var idx = 0; idx < newIds.length; idx++) {
        this.reset(newIds[idx]);
      }
    } catch (_err) {
      err = _err;
    }
    // rollback to original state
    this.reset(head);

    if (err) {
      // remove the changes in reverse order to meet restrictions
      newIds.reverse();
      for (var idx = 0; idx < newIds.length; idx++) {
        this.index.remove(newIds[idx]);
      }
      if (err) throw new errors.ChronicleError("Import did not pass sanity check: "+err.toString());
    }

  }

}

ChronicleImpl.__prototype__.prototype = Chronicle.prototype;
ChronicleImpl.prototype = new ChronicleImpl.__prototype__();

Chronicle.create = function(index) {
  return new ChronicleImpl(index);
};


})(this);
