(function(root) { "use_strict";

// Imports
// ====

var util, errors, _, Chronicle;

if (!root.exports) {
  util = root.Substance.util;
  errors = root.Substance.errors;
  _ = root._;
  Chronicle = root.Substance.Chronicle;
} else {
  throw "Node.js support not implemented";
}

// Module
// ====

var ChronicleImpl = function(index) {
  Chronicle.call(this, index);
};

ChronicleImpl.__prototype__ = function() {
  var __private__ = new ChronicleImpl.__private__();

  this.record = function(changeData) {
    // Sanity check: the change should have been applied already.
    // Reverting and applying should not fail.
    if (Chronicle.HYSTERICAL) {
      this.versioned.revert(changeData);
      this.versioned.apply(changeData);
    }

    // 1. create a new change instance
    var head = this.versioned.getState();
    var id = Chronicle.uuid();
    var change = new Chronicle.Change({
      id: id,
      parents: [head],
      data: changeData
    });

    // 2. add change to index
    this.index.add(change);

    // 3. shift head
    this.versioned.setState(id);
  };

  this.reset = function(id) {
    // sanity check: see if the given id is available
    if (Chronicle.HYSTERICAL && !this.index.contains(id)) {
      throw new errors.ChronicleError("Invalid argument: unknown change "+id);
    }

    // 1. compute diff between current state and the given id
    var head = this.versioned.getState();
    var path = this.index.shortestPath(head, id);

    // 2. apply path
    this.apply(path);
  };

  this.open = this.reset;

  this.apply = function(sha) {
    if (_.isArray(sha)) {
      return __private__.applySequence.apply(this, sha);
    } else {
      return __private__.applySequence.apply(this, arguments);
    }
  };

  this.step = this.apply;

  this.import = function(otherIndex) {
    // 1. index difference (only ids)
    var newIds = _.difference(otherIndex.list(), this.index.list());
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
      this.index.add(otherIndex.get(newIds[idx]));
    }

    // sanity check: see if all imported changes can be applied
    if (Chronicle.HYSTERICAL) __private__.importSanityCheck.call(this, newIds);

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

    var head = this.versioned.getState();
    var diff1 = this.index.diff(head, id);

    // 1. check for simple cases

    // 1.1. don't do anything if the other merge is already merged
    if (!diff1.hasApplies()) {
      return head;
    }

    // 1.2. check if the merge can be solved by simple applies (so called fast-forward)
    if (!diff1.hasReverts() && !options.no_ff) {
      __private__.applyDiff.call(this, diff1);
      return this.versioned.getState();
    }

    // 2. create a merging change
    var diff2 = this.index.diff(id, head);

    // the main path of the merge
    var main;
    var diffs = {};
    var change;
    if (strategy === "mine") {
      main = head;
      diffs[head] = Chronicle.Diff.create(head, [], []);
      diffs[id] = diff2;
      change = new Chronicle.Merge(main, diffs);
    } else if (strategy === "theirs") {
      main = id;
      diffs[head] = diff1;
      diffs[id] = Chronicle.Diff.create(id, [], []);
      change = new Chronicle.Merge(main, diffs);
    } else if (strategy === "manual") {
      if (!options.sequence) throw new errors.ChronicleError("Invalid argument: sequence is missing for manual merge");

      // Create extra commits by rebasing the given sequence (if necessary)
      // keep the newPath to allow rollback on failure
      var newPath = [];
      try {
        var sequence = options.sequence;
        // start at the common root which is the last of the reverts of each of the computed diffs
        var base = _.last(diff1.reverts());
        var next;
        while(sequence.length > 0) {
          next = sequence.shift();
          // only rebase if necessary
          if (!this.index.get(next).hasParent(base)) {
            next = __private__.rebase.call(this, next, base);
          }
          base = next;
        }
        
        // now current is the last rebased commit
        diffs[base] = Chronicle.Diff.create(base, [], []);
        diffs[head] = this.index.diff(head, base);
        diffs[id] = this.index.diff(id, base);
        change = new Chronicle.Merge(base, diffs);

      } catch(err) {
        // Remove all temporarily created rebased commits
        this.reset(head);
        while (newPath.length > 0) {
          id = newPath.pop();
          this.index.remove(id);
        }
        throw err;
      }
    } else {
      throw new errors.ChronicleError("Unsupported merge strategy: "+strategy);
    }

    // 2. add the change to the index
    this.index.add(change);

    // (sanity check: see if the manual sequence can be applied)
    if (Chronicle.HYSTERICAL && strategy === "manual") {
      try {
        __private__.apply.call(this, change.id);
        __private__.revertTo.call(this, head);
      } catch(err) {
        this.index.remove(change.id);
        this.reset(head);
        throw new errors.ChronicleError("Can not apply the merge: "+err.toString());
      }
    }

    // 3. apply the change
    __private__.applyDiff.call(this, change.diff[head]);

    // 4. set state
    this.versioned.setState(change.id);

    return change.id;
  };
};

ChronicleImpl.__private__ = function() {

  var __private__ = this;
  var ROOT = Chronicle.Index.ROOT.id;

  this.applyDiff = function(diff, force) {

    if(!diff) return;

    var originalState = this.versioned.getState();

    // sanity check: don't allow to apply the diff on another change
    if (originalState !== diff.start())
      throw new errors.ChronicleError("Diff can not applied on to this state. Expected: "+diff.start()+", Actual: "+originalState);

    // Note: when this is called to apply a merge we force the changes.
    // Merges can have custom change selections which do not follow the relationship defined in the changes.
    // Due to that, the index may temporarily be in an illegal state.
    // Therefor, we record all successfully applied changes so that we
    // can roll them back in case of failure (again in forced mode).

    var err = null;
    var successfulReverts = [];
    var successfulApplies = [];
    try {
      var reverts = diff.reverts();
      var applies = diff.applies();

      var idx, id;
      // start at idx 1 as the first is the starting id
      for (idx = 0; idx < reverts.length; idx++) {
        id = reverts[idx];
        __private__.revertTo.call(this, id, force);
        successfulReverts.push(id);
      }
      for (idx = 0; idx < applies.length; idx++) {
        id = applies[idx];
        __private__.apply.call(this, id);
        successfulApplies.push(id);
      }
    } catch(_err) {
      err = _err;
    }

    // if the diff could not be applied, revert all changes that have been applied so far
    if (err && (successfulReverts.length > 0 || successfulApplies.length > 0)) {
      // idx shows to the change that has failed;
      var applied = Chronicle.Diff.create(diff.start(), successfulReverts, successfulApplies);
      var inverted = applied.inverted();
      try {
        __private__.applyDiff.call(this, inverted, force);
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
    var originalState = this.versioned.getState();

    try {
      var current = this.index.get(originalState);
      _.each(arguments, function(id) {
        // tolerate nop-transitions
        if (current.id === id) return;

        var next = this.index.get(id);
        if (current.hasParent(id)) {
          __private__.revertTo.call(this, id);
        } else if (next.hasParent(current.id)) {
          __private__.apply.call(this, id);
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

  this.revertTo = function(id, force) {
    var head = this.versioned.getState();
    var current = this.index.get(head);

    // sanity checks
    if (!current) throw new errors.ChangeError("Illegal state. 'head' is unknown: "+ head);

    // typically we check if the commit is parent
    // However, when applying merges we have to apply without this check
    if (!force && !current.hasParent(id)) throw new errors.ChangeError("Can not revert: change is not parent of current");

    if (current instanceof Chronicle.Merge) {
      // Note: this is the inverted action of setting the head to id of the merge commit
      var diff = current.diff[id];
      this.versioned.setState(diff.end());
      __private__.applyDiff.call(this, diff.inverted(), true);
    } else {
      this.versioned.revert(current.data);
      this.versioned.setState(id);
    }
  };

  this.rebase = function(id, onto) {
    var diff = this.index.diff(id, onto);
    var reverts = diff.reverts();
    var applies = diff.applies();

    // Note: this implementation does not treat Merge nodes differently,
    // as it assumes that index.diff provides a path taking the main branch
    // in every merge node.

    // 1. Compute transformed change    
    // Iteratively transforms the change so it can be applied onto the
    // given target.
    var transformed = this.index.get(id).data;
    var idx, next, swapped;
    for (idx=0; idx<reverts.length; idx++) {
      next = this.index.get(reverts[idx]);
      swapped = this.versioned.swapped(next.data, transformed);
      transformed = swapped[0];
    }
    for (idx=0; idx<applies.length; idx++) {
      next = this.index.get(applies[idx]);
      swapped = this.versioned.swapped(transformed, next.data);
      transformed = swapped[1];
    }

    // 2. Register a new change
    var change = new Chronicle.Change({
      parents: [onto],
      data: transformed
    });
    this.index.add(change);

    return change.id;
  };

  this.apply = function(id) {
    var change = this.index.get(id);
    var current = this.versioned.getState();

    // sanity check
    if (!change) throw new errors.ChangeError("Illegal argument. change is unknown: "+ id);

    if (change instanceof Chronicle.Merge) {
      __private__.applyDiff.call(this, change.diff[current], true);
      this.versioned.setState(id);
    } else {
      this.versioned.apply(change.data);
      this.versioned.setState(id);
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
    var head = this.versioned.getState();

    // This is definitely very hysterical: we try to reach
    // every provided change by resetting to it.
    // If this is possible we are sure that every change has been applied
    // and reverted at least once.
    // This is for sure not a minimalistic approach.
    var err = null;
    var idx;
    try {
      for (idx = 0; idx < newIds.length; idx++) {
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
      for (idx = 0; idx < newIds.length; idx++) {
        this.index.remove(newIds[idx]);
      }
      if (err) throw new errors.ChronicleError("Import did not pass sanity check: "+err.toString());
    }

  };

};

ChronicleImpl.__prototype__.prototype = Chronicle.prototype;
ChronicleImpl.prototype = new ChronicleImpl.__prototype__();

Chronicle.create = function(index) {
  return new ChronicleImpl(index);
};


})(this);
