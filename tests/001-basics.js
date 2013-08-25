"use strict";


// Import
// ========

var _ = require('underscore');
var util = require('substance-util');
var errors = util.errors;
var Test = require('substance-test');
var assert = Test.assert;
var registerTest = Test.registerTest;
var Chronicle = require('../index');
var ChronicleTest = require("./chronicle_test");


// Test
// ========

var ROOT = Chronicle.ROOT;

// Index structure:
//
// ROOT - 01 - 02 - 03 - 04
//    |              |
//    |                - 05 - 06
//      - 07 - 08

var C1 = new Chronicle.Change("01", ROOT, "bla");
var OP = function(op, val, id, parent) {
  var data = { op: op, val: val };
  return new Chronicle.Change(id, parent, data);
};
var PLUS = function(id, parents) {
  return OP("plus", 1, id, parents);
};

var Basics = function() {
  ChronicleTest.call(this);

  // deactivate the default fixture
  // for testing basic behavior
  this.default_fixture = this.fixture;

  this.fixture = function() {};

  this.actions = [

    "Index: add", function() {
      this.index.add(C1);
      assert.isTrue(this.index.contains(C1.id));

      // should reject
      assert.exception(errors.ChronicleError, function() {
        this.index.add(PLUS("bla", "doesnotexist"));
      }, this);
    },

    "Index: get", function() {
      var c = this.index.get(C1.id);
      assert.isEqual(C1.id, c.id);
      assert.isEqual(C1.data, c.data);
    },

    "Index: list", function() {
      assert.isArrayEqual([ROOT, C1.id], this.index.list());
    },

    "Every Ref should reference an existing change", function() {
      assert.exception(errors.ChronicleError, function() {
        this.index.setRef("FAIL", "balla");
      }, this);
    },

    "Record", function() {
      var id = this.next_uuid();
      this.chronicle.record({op: "plus", val: 1});
      assert.isTrue(this.index.contains(id));
    },

    "Should not record failing changes", function() {
      var id = this.next_uuid();
      assert.exception(function() {
        // this fails due to division by 0
        this.chronicle.record({op: "div", val: 0});
      }, this);
      assert.isFalse(this.index.contains(id));
    },

    "Import", function() {
      var other = Chronicle.Index.create();
      other.add(PLUS("1", ROOT));
      other.add(PLUS("2", "1"));
      other.add(PLUS("3", "2"));
      other.add(PLUS("4", ROOT));
      this.chronicle.import(other);

      for (var idx=1; idx<5; idx++) {
        assert.isTrue(this.index.contains(""+idx));
      }
    },

    "Reject Imports with Failing changes", function() {
      this.setup();

      var other = Chronicle.Index.create();
      other.add(PLUS("1", ROOT));
      other.add(OP("div", 0, "2", "1"));
      other.add(PLUS("3", "2"));

      assert.exception(errors.ChronicleError, function() {
        this.chronicle.import(other);
      }, this);
    },

    "Load default fixture", function() {
      this.setup();
      this.default_fixture();
    },

    "Reset", function() {
      this.comp.reset();

      var seq = ["07", "05", "04", ROOT, "06", "08", "03", "01", "02"];
      _.each(seq, function(id) {
        this.chronicle.open(id);
        assert.isEqual(this.RESULTS[id], this.comp.result);
        assert.isEqual(id, this.comp.getState());
      }, this);
    },

    "Transition: simple forward", function() {

      this.chronicle.open(ROOT);
      this.chronicle.apply("01", "02", "03");
      assert.isEqual("03", this.comp.getState());
      assert.isEqual(this.RESULTS["03"], this.comp.result);

    },

    "Transition: simple revert", function() {

      this.chronicle.open("02");
      this.chronicle.apply("01");
      assert.isEqual("01", this.comp.getState());
      assert.isEqual(this.RESULTS["01"], this.comp.result);

    },

    "Transition: revert and apply", function() {

      this.chronicle.open("04");
      this.chronicle.apply("03", "05");
      assert.isEqual("05", this.comp.getState());
      assert.isEqual(this.RESULTS["05"], this.comp.result);

    },

    "Transition: across ROOT", function() {

      this.chronicle.open("01");
      this.chronicle.apply(ROOT, "07");
      assert.isEqual("07", this.comp.getState());
      assert.isEqual(this.RESULTS["07"], this.comp.result);

    },

    // TODO: add some smoke tests to check robustness against wrong usage

  ];
};
Basics.prototype = ChronicleTest.prototype;

registerTest(['Chronicle', 'Basics'], new Basics());
