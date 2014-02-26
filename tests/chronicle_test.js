"use strict";

// Import
// =========

var _ = require('underscore');
var Chronicle = require('../index');
var Calculator = require('./example');
var Test = require("substance-test");


// Test
// =========

var __ID__ = 0;
var __OP__ = 1;
var __VAL__ = 2;
var __RESULT__ = 3;

var ROOT = Chronicle.ROOT;

// Index structure:
//
// ROOT - 01 - 02 - 03 - 04
//    |              |
//    |                - 05 - 06
//      - 07 - 08

var INDEX = [
  ["01", "plus", 5, 5], // = 5
  ["02", "minus", 3, 2], // = 2
  ["03", "times", 3, 6], // = 6
  ["04", "div", 2, 3], // = 3
  ["05", "plus", 1, 7], // = 7 // applied on 03
  ["06", "plus", 2, 9], // = 9
  ["07", "minus", 1, -1], // = -1 // applied on __ROOT__
  ["08", "minus", 2, -3], // = -3
];

//function ID(i) {return INDEX[i][__ID__];}
function OP(i) {return INDEX[i][__OP__];}
function VAL(i) {return INDEX[i][__VAL__];}

var ID_IDX = 1;

var ChronicleTest = function() {
  Test.call(this);
};

ChronicleTest.Prototype = function() {
  this.RESULTS = _.reduce(INDEX, function(memo, e) {
    memo[e[__ID__]] = e[__RESULT__]; return memo;
  }, {});
  this.RESULTS[ROOT] = 0;

  function _uuid(idx) {
    return (idx < 10) ? "0"+idx : ""+idx;
  }

  this.uuid = function() {
    return _uuid(ID_IDX++);
  };

  this.next_uuid = function() {
    return _uuid(ID_IDX);
  };

  this.op = function(idx) {
    this.comp[OP(idx)](VAL(idx));
  };

  this.setup = function() {
    ID_IDX = 1;
    this.chronicle = Chronicle.create({mode: Chronicle.HYSTERICAL});
    this.index = this.chronicle.index;
    this.comp = new Calculator.ChronicleAdapter(this.chronicle);
    this.chronicle.uuid = this.uuid;

    this.fixture();
  };

  this.fixture = function() {
    // Attention: these call will automatically increment the UUIDs
    var idx;
    for (idx=0; idx < 4; idx++) {
      this.comp[OP(idx)](VAL(idx));
    }
    this.chronicle.reset("03");
    for (idx=4; idx < 6; idx++) {
      this.comp[OP(idx)](VAL(idx));
    }
    this.chronicle.reset(ROOT);
    for (idx=6; idx < 8; idx++) {
      this.comp[OP(idx)](VAL(idx));
    }
    this.comp.reset();
  };
};
ChronicleTest.Prototype.prototype = Test.prototype;
ChronicleTest.prototype = new ChronicleTest.Prototype();

// Export
// ====

module.exports = ChronicleTest;
