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
  index = index || Chronicle.Index.create();
  Chronicle.call(this, index);
};

ChronicleImpl.__prototype__ = function() {

  var __private__ = new ChronicleImpl.__private__();
  var ROOT = Chronicle.Index.ROOT.id;

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
    var change = new Chronicle.Change(head, changeData, { id: id });

    // 2. add change to index
    this.index.add(change);

    // 3. shift head
    this.versioned.setState(id);

    return id;
  };

  this.reset = function(id, index) {
    index = index || this.index;

    // sanity check: see if the given id is available
    if (Chronicle.HYSTERICAL && !index.contains(id)) {
      throw new errors.ChronicleError("Invalid argument: unknown change "+id);
    }

    // 1. compute diff between current state and the given id
    var head = this.versioned.getState();
    var path = index.shortestPath(head, id);

    // 2. apply path
    __private__.applySequence.call(this, path, index);
  };

  this.open = this.reset;

  this.path = function(id1, id2) {
    if (!id2) {
      var path = this.index.shortestPath(ROOT, id1 || this.versioned.getState());
      path.shift();
      return path;
    } else {
      if (!id1) throw new errors.ChronicleError("Illegal argument: "+id1);
      return this.index.shortestPath(id1, id2);
    }
  };

  this.apply = function(sha) {
    if (_.isArray(sha)) {
      return __private__.applySequence.call(this, sha);
    } else {
      return __private__.applySequence.call(this, arguments);
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
    var diff = this.index.diff(head, id);

    // 1. check for simple cases

    // 1.1. don't do anything if the other merge is already merged
    if (!diff.hasApplies()) {
      return head;
    }

    // 1.2. check if the merge can be solved by simple applies (so called fast-forward)
    if (!diff.hasReverts() && !options.no_ff) {
      __private__.applyDiff.call(this, diff);
      return this.versioned.getState();
    }

    // 2. create a Merge node
    var change;

    // Strategies:

    // Mine
    if (strategy === "mine") {
      change = new Chronicle.Merge(head, [head, id]);
    }

    // Theirs
    else if (strategy === "theirs") {
      change = new Chronicle.Merge(id, [head, id]);
    }

    // Manual
    else if (strategy === "manual") {
      if (!options.sequence) throw new errors.ChronicleError("Invalid argument: sequence is missing for manual merge");
      var sequence = options.sequence;

      change = __private__.manualMerge.call(this, head, id, diff, sequence);
    }

    // Unsupported
    else {
      throw new errors.ChronicleError("Unsupported merge strategy: "+strategy);
    }

    // 2. add the change to the index
    this.index.add(change);

    // 3. reset state
    this.reset(change.id);

    return change.id;
  };
};


ChronicleImpl.__private__ = function() {

  var __private__ = this;

  var ROOT = Chronicle.Index.ROOT.id;

  // Traversal operations
  // =======

  // a diff is a special kind of path which consists of
  // a sequence of reverts and a sequence of applies.
  this.applyDiff = function(diff, index) {

    index = index || this.index;

    if(!diff) return;

    var originalState = this.versioned.getState();

    // sanity check: don't allow to apply the diff on another change
    if (originalState !== diff.start())
      throw new errors.ChronicleError("Diff can not applied on to this state. Expected: "+diff.start()+", Actual: "+originalState);

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
        __private__.revertTo.call(this, id, index);
        successfulReverts.push(id);
      }
      for (idx = 0; idx < applies.length; idx++) {
        id = applies[idx];
        __private__.apply.call(this, id, index);
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
        __private__.applyDiff.call(this, inverted, index);
      } catch(_err) {
        // TODO: maybe we should do that always, instead of minimal rollback?
        console.log("Ohohhhh.... could not rollback partially applied diff.",
          "Without bugs and in HYSTERICAL mode this should not happen.",
          "Resetting to original state");
        this.versioned.reset();
        this.reset(originalState, index);
      }
    }

    if (err) throw err;
  };

  this.applySequence = function(seq, index) {
    index = index || this.index;

    var originalState = this.versioned.getState();

    try {
      var current = index.get(originalState);
      _.each(seq, function(id) {

        // tolerate nop-transitions
        if (current.id === id) return;

        var next = index.get(id);

        // revert
        if (current.parent === id) {
          __private__.revertTo.call(this, id, index);
        }
        // apply
        else if (next.parent === current.id) {
          __private__.apply.call(this, id, index);
        }
        else {
          throw new errors.ChronicleError("Invalid apply sequence: "+id+" is not parent or child of "+current.id);
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

  this.revertTo = function(id, index) {
    index = index || this.index;

    var head = this.versioned.getState();
    var current = index.get(head);

    // sanity checks
    if (!current) throw new errors.ChangeError("Illegal state. 'head' is unknown: "+ head);
    if (current.parent !== id) throw new errors.ChangeError("Can not revert: change is not parent of current");

    // Note: Merge nodes do not have data
    if (current.data) this.versioned.revert(current.data);
    this.versioned.setState(id);
  };

  // Performs a single forward step
  // --------

  this.apply = function(id, index) {
    index = index || this.index;

    var change = index.get(id);

    // sanity check
    if (!change) throw new errors.ChangeError("Illegal argument. change is unknown: "+ id);

    if (change.data) this.versioned.apply(change.data);
    this.versioned.setState(id);
  };

  // Restructuring operations
  // =======

  // Eliminates a sequence of changes before a given change.
  // --------
  //
  // A new branch with transformed changes is created.
  //
  //      0 - a  - b  - c  - d
  //
  //    > c' = eliminate(c, [b,a])
  //
  //      0 - a  - b  - c  - d
  //      |
  //       \- c' - d'
  //
  // The sequence should be in descending order.
  //
  // Returns the id of the rebased change.
  //

  this.eliminate = function(start, del, mapping, index, selection) {
    index = index || this.index;

    var left = index.get(del);
    var right = index.get(start);
    var inverted, rebased;

    // attach the inversion of the first to the first node
    inverted = new Chronicle.Change(del, this.versioned.invert(left.data));
    index.add(inverted);

    // rebase onto the inverted change
    // Note: basicially this can fail due to broken dependencies of changes
    // However, we do not want to have any conflict management in this case
    // and fail with error instead
    rebased = __private__.rebase0.call(this, inverted.id, right.id, mapping, index, selection);

    // as we know that we have eliminated the effect by directly applying
    // a change and its inverse, it is ok to directly skip those two changes at all
    index.reconnect(rebased, left.parent);

    // continue with the transformed version
    right = index.get(rebased);

    return right.id;
  };

  // Performs a basic rebase operation.
  // --------
  //
  // The target and source must be siblings
  //
  //        0 - a
  //        |
  //         \- b - c
  //
  //    > b' = rebase0(a, b)
  //
  //        0 - a  - b' - c'
  //        |
  //         \- b - c
  //
  // The original changes remain.
  // A mapping is created to allow looking up rebased changes via their original ids.

  this.rebase0 = function(targetId, sourceId, mapping, index, selection) {
    index = index || this.index;

    var target = index.get(targetId);
    var source = index.get(sourceId);

    if (target.parent !== source.parent) throw new errors.ChronicleError("Illegal arguments: principal rebase can only be applied on siblings.");

    // recursively transform the sub-graph
    var queue = [[target.data, target.id, source]];

    var item;
    var a, b, b_i;
    var result = null;


    // keep merge nodes to update the mapped branches afterwards
    var merges = [];
    var idx;

    while(queue.length > 0) {
      item = queue.pop();

      a = item[0];
      targetId = item[1];
      source = item[2];
      b = source.data;

      var transformed;

      if (source instanceof Chronicle.Merge) {
        // no transformation necessary here
        // propagating the current transformation
        transformed = [a];
        // inserting the original branch ids here, which will be resolved to the transformed ids
        // afterwards, when we can be sure, that all other node have been transformed.
        b_i = new Chronicle.Merge(targetId, source.branches);
        merges.push(b_i);
      } else {
        if (this.versioned.hasConflict(a, b)) {
          var conflict = new errors.MergeConflict("Merge conflict: " + JSON.stringify(source) +" vs " + JSON.stringify(target));
          conflict.a = a;
          conflict.b = b;
          throw conflict;
        }
        // perform th Operational Transformation
        transformed = this.versioned.transform(a, b);
        // add a change the with the rebased/transformed operation
        var orig = (source instanceof Chronicle.Transformed) ? source.original : source.id;
        b_i = new Chronicle.Transformed(targetId, transformed[1], orig);

        // overwrite the mapping for the original
        mapping[orig] = b_i.id;
      }

      // record a mapping between old and new nodes
      mapping[source.id] = b_i.id;

      if (!result) result = b_i;
      index.add(b_i);

      // add children to iteration
      var children = index.getChildren(source.id);
      for (idx = 0; idx < children.length; idx++) {
        var child = index.get(children[idx]);

        // only rebase selected children if a selection is given
        if (selection) {
          var c = (child instanceof Chronicle.Transformed) ? child.original : child.id;
          if (!selection[c]) continue;
        }

        queue.unshift([transformed[0], b_i.id, child]);
      }
    }

    // resolve the transformed branch ids in all occurred merge nodes.
    for (idx = 0; idx < merges.length; idx++) {
      var m = merges[idx];
      var mapped_branches = [];
      for (var idx2 = 0; idx2 < m.branches.length; idx2++) {
        mapped_branches.push(mapping[m.branches[idx2]]);
      }
      m.branches = mapped_branches;
    }

    return result.id;
  };

  // Merge implementations
  // =======

  // Creates a branch containing only the selected changes
  // --------
  // this is part of the merge
  this.eliminateToSelection = function(branch, sequence, mapping, index) {
    var tmp_index = new Chronicle.TmpIndex(index);

    var selection = _.intersection(branch, sequence);
    if (selection.length === 0) return null;

    var eliminations = _.difference(branch, sequence).reverse();
    if (eliminations.length === 0) return mapping[selection[0]];

    var idx1 = 0, idx2 = 0;
    var idx, id, del;
    var last = null;

    while (idx1 < branch.length && idx2 < eliminations.length) {
      id = branch[branch.length-1-idx1];
      del = eliminations[idx2];

      if (id === del) {
        // update the selected change
        if (last) {
          // TODO: filter propagations to nodes that are within the selection (or resolve to)
          last = __private__.eliminate.call(this, last, id, mapping, tmp_index, mapping);
        }
        idx1++; idx2++;
      } else {
        last = id;
        idx1++;
      }
    }

    // store the transformed selected changes to the parent index
    for (idx = 0; idx < selection.length; idx++) {
      id = selection[idx];
      tmp_index.save(mapping[id]);
    }

    return mapping[selection[0]];
  };

  this.manualMerge = function(head, id, diff, sequence) {


      if (sequence.length === 0) {
        throw new errors.ChronicleError("Nothing selected for merge.");
      }

      // accept only those selected which are actually part of the two branches
      var tmp = _.intersection(sequence, diff.sequence());
      if (tmp.length !== sequence.length) {
        throw new errors.ChronicleError("Illegal merge selection: contains changes that are not contained in the merged branches.");
      }

      // The given sequence is constructed introducing new (hidden) changes.
      // This is done in the following way:
      // 1. Creating clean versions of the two branches by eliminating all changes that are not selected
      // 2. TODO Re-order the eliminated versions
      // 3. Zip-merge the temporary branches into the selected one

      var tmp_index = new Chronicle.TmpIndex(this.index);

      // 1. Eliminate

      var root = diff.root();
      var mine = diff.mine();
      var theirs = diff.theirs();

      var mapping = _.object(sequence, sequence);
      __private__.eliminateToSelection.call(this, mine, sequence, mapping, tmp_index);
      __private__.eliminateToSelection.call(this, theirs, sequence, mapping, tmp_index);

      // 2. Re-order
      // TODO: implement this if desired

      // 3. Merge
      var lastId = root;
      var idx;

      for (idx=0; idx<sequence.length; idx++) {
        var nextId = mapping[sequence[idx]];
        var next = tmp_index.get(nextId);
        if (next.parent === lastId) {
          // skip if already in place
          lastId = nextId;
        } else {
          lastId = __private__.rebase0.call(this, lastId, nextId, mapping, tmp_index);
        }
      }

      lastId = mapping[_.last(sequence)];

      // let's do a sanity check before we save the index changes
      try {
        this.reset(lastId, tmp_index);
      } catch (err) {
        this.reset(head, tmp_index);
        throw err;
      }

      // finally we can write the newly created changes into the parent index
      for (idx=0; idx<sequence.length; idx++) {
        tmp_index.save(mapping[sequence[idx]]);
      }

      return new Chronicle.Merge(lastId, [head,id]);
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
      console.log(err.stack);
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
