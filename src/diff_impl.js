"use strict";

var _ = require('underscore');

var Chronicle = require("./chronicle");

var DiffImpl = function(data) {
  this.data = data;
};

DiffImpl.Prototype = function() {

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

  this.root = function() {
    return this.data[1][this.data[0]];
  };

  this.sequence = function() {
    return this.data[1].slice(0);
  };

  this.mine = function() {
    return this.data[1].slice(0, this.data[0]).reverse();
  };

  this.theirs = function() {
    return this.applies();
  };

  this.inverted = function() {
    return new DiffImpl([this.data[1].length-1-this.data[0], this.data[1].slice(0).reverse()]);
  };

  this.toJSON = function() {
    return {
      data: this.data
    };
  };
};

DiffImpl.Prototype.prototype = Chronicle.Diff.prototype;
DiffImpl.prototype = new DiffImpl.Prototype();

DiffImpl.create = function(id, reverts, applies) {
  return new DiffImpl([reverts.length, [id].concat(reverts).concat(applies)]);
};

module.exports = DiffImpl;
