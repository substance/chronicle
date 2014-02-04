"use strict";

// Import
// ========

var Test = require('substance-test');
var assert = Test.assert;
var Chronicle = require('../index');
var ChronicleTest = require("./chronicle_test");


// Test
// ========

var ROOT = Chronicle.Index.ROOT.id;

var Diff = function() {
  ChronicleTest.call(this);
};

Diff.Prototype = function() {
  this.actions = [

    "Diff (01 -> 02)", function() {
      // only applies
      var start = "01", end = "02";

      var diff = this.index.diff(start, end);
      var sp = this.index.shortestPath(start, end);

      assert.isArrayEqual([start, end], diff.sequence());
      assert.isEqual(0, diff.reverts().length);
      assert.isArrayEqual([end], diff.applies());
      assert.isArrayEqual(diff.sequence().slice(1), sp);
    },

    "Diff (02 -> 01)", function() {
      // only reverts
      var start = "02", end = "01";

      var diff = this.index.diff(start, end);
      var sp = this.index.shortestPath(start, end);

      assert.isArrayEqual([start, end], diff.sequence());
      assert.isEqual(0, diff.applies().length);
      assert.isArrayEqual([end], diff.reverts());
      assert.isArrayEqual(diff.sequence().slice(1), sp);
    },

    "Diff to ROOT (01 -> ROOT)", function() {

      var start = "01", end = "ROOT";

      var diff = this.index.diff("01", ROOT);
      var sp = this.index.shortestPath(start, end);

      assert.isArrayEqual([start, end], diff.sequence());
      assert.isEqual(0, diff.applies().length);
      assert.isArrayEqual([end], diff.reverts());
      assert.isArrayEqual(diff.sequence().slice(1), sp);
    },

    "Diff from ROOT (ROOT -> 08)", function() {

      var start = "ROOT", end = "08";

      var diff = this.index.diff(start, end);
      var sp = this.index.shortestPath(start, end);

      assert.isArrayEqual([ROOT, "07", "08"], diff.sequence());
      assert.isArrayEqual([], diff.reverts());
      assert.isArrayEqual(["07", "08"], diff.applies());
      assert.isArrayEqual(diff.sequence().slice(1), sp);

    },

    "No Diff (02 -> 02)", function() {
      var start = "02", end = "02";
      var diff = this.index.diff(start, end);
      var sp = this.index.shortestPath(start, end);

      assert.isArrayEqual(["02"], diff.sequence());
      assert.isArrayEqual([], diff.reverts());
      assert.isArrayEqual([], diff.applies());
      assert.isArrayEqual(diff.sequence().slice(1), sp);
    },

    "Diff with reverts and applies (04 -> 05)", function() {
      // mixed: 04 -> 03 -> 05
      var start = "04", end = "05";
      var diff = this.index.diff(start, end);
      var sp = this.index.shortestPath(start, end);

      assert.isArrayEqual(["04", "03", "05"], diff.sequence());
      assert.isArrayEqual(["03"], diff.reverts());
      assert.isArrayEqual(["05"], diff.applies());
      assert.isArrayEqual(diff.sequence().slice(1), sp);
    },

    "Diff across ROOT (07 -> 01)", function() {

      var start = "07", end = "01";
      var diff = this.index.diff(start, end);
      var sp = this.index.shortestPath(start, end);

      assert.isArrayEqual(["07", ROOT, "01"], diff.sequence());
      assert.isArrayEqual([ROOT], diff.reverts());
      assert.isArrayEqual(["01"], diff.applies());
      assert.isArrayEqual(diff.sequence().slice(1), sp);
    }
  ];
};
Diff.Prototype.prototype = ChronicleTest.prototype;
Diff.prototype = new Diff.Prototype();

Test.registerTest(['Substance.Chronicle', 'Diff'], new Diff());
