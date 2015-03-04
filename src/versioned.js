'use strict';

var Substance = require('substance');

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

Substance.initClass(Versioned);

module.exports = Versioned;
