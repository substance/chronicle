'use strict';

var Substance = require('substance');

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

var Diff = function(data) {
  this.data = data;
};

Diff.Prototype = function() {

  this.hasReverts = function() {
    return this.data[0]>0;
  };

  // Provides the changes that will be reverted
  // --------

  this.reverts = function() {
    return this.data[1].slice(1, this.data[0]+1);
  };

  this.hasApplies = function() {
    return this.data[1].length-1-this.data[0] > 0;
  };

  // Provides the changes that will applied
  // --------

  this.applies = function() {
    return this.data[1].slice(this.data[0]+1);
  };

  // Provides the sequence of states visited by this diff.
  // --------

  this.sequence = function() {
    return this.data[1].slice(0);
  };

  // Provides the path from the root to the first change
  // --------
  //
  // The naming refers to a typical diff situation where
  // two branches are compared. The first branch containing the own
  // changes, the second one the others.

  this.mine = function() {
    return this.data[1].slice(0, this.data[0]).reverse();
  };

  // Provides the path from the root to the second change
  // --------
  //

  this.theirs = function() {
    return this.applies();
  };

  // Provides the common root of the compared branches.
  // --------
  //

  this.root = function() {
    return this.data[1][this.data[0]];
  };

  // Provides the version this diff has to be applied on.
  // --------

  this.start = function() {
    return this.data[1][0];
  };

  // Provides the version which is generated by applying this diff.
  // --------

  this.end = function() {
    return Substance.last(this.data[1]);
  };

  // Provides a copy that represents the inversion of this diff.
  // --------

  this.inverted = function() {
    return new Diff([this.data[1].length-1-this.data[0], this.data[1].slice(0).reverse()]);
  };

  this.toJSON = function() {
    return {
      data: this.data
    };
  };

};

Substance.initClass(Diff);

// Creates a new diff for the given reverts and applies
// --------
// Note this factory is provided when loading index_impl.js

Diff.create = function(id, reverts, applies) {
  return new Diff([reverts.length, [id].concat(reverts).concat(applies)]);
};

module.exports = Diff;