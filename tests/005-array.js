"use strict";

// Import
// ========

var Test = require('substance-test');
var assert = Test.assert;
var Chronicle = require('../index');
var Operator = require('substance-operator');
var ArrayOperation = Operator.ArrayOperation;
var ArrayOperationAdapter = require('./array_adapter');

// Test
// =======

// Index:
//
// ROOT - 1  -  2  -  3  -  4  -  5
//        |                 \
//        |                   M1 (1,2,6,4)
//        |---  6  ---------/

var OP_1 = ArrayOperation.Insert(0, 1);
var OP_2 = ArrayOperation.Insert(1, 3);
var OP_3 = ArrayOperation.Insert(1, 2);
var OP_4 = ArrayOperation.Move(0, 2);
var OP_5 = ArrayOperation.Delete(1, 3);
var OP_6 = ArrayOperation.Insert(1, 4);

var ARR_1 = [1];
var ARR_2 = [1,3];
var ARR_3 = [1,2,3];
var ARR_4 = [2,3,1];
var ARR_5 = [2,1];
//var ARR_6 = [1,4];

var ARR_M1 = [3,4,1];

var ChronicledArrayTest = function() {
  Test.call(this);
};

ChronicledArrayTest.Prototype = function() {
  var ID_IDX = 1;

  this.uuid = function() {
    return ""+ID_IDX++;
  };

  this.apply = function(op) {
    this.adapter.apply(op);
    return this.chronicle.record(op);
  };

  this.fixture = function() {
    this.ID1 = this.apply(OP_1);
    this.ID2 = this.apply(OP_2);
    this.ID3 = this.apply(OP_3);
    this.ID4 = this.apply(OP_4);
    this.ID5 = this.apply(OP_5);
    this.chronicle.reset(this.ID1);
    this.ID6 = this.apply(OP_6);
    this.chronicle.reset("ROOT");
  };

  this.setup = function() {
    this.chronicle = Chronicle.create({mode: Chronicle.HYSTERICAL});
    this.index = this.chronicle.index;

    ID_IDX = 1;
    this.chronicle.uuid = this.uuid;

    this.array = [];
    this.adapter = new ArrayOperationAdapter(this.chronicle, this.array);

    this.fixture();
  };


  this.actions = [

    "Basic checkout", function() {
      this.chronicle.open(this.ID4);
      assert.isArrayEqual(ARR_4, this.array);

      this.chronicle.open(this.ID1);
      assert.isArrayEqual(ARR_1, this.array);

      this.chronicle.open(this.ID5);
      assert.isArrayEqual(ARR_5, this.array);

      this.chronicle.open(this.ID3);
      assert.isArrayEqual(ARR_3, this.array);

      this.chronicle.open(this.ID2);
      assert.isArrayEqual(ARR_2, this.array);
    },

    "Manual merge", function() {
      this.chronicle.open(this.ID4);
      // Note: the sequence 2 - 6 - 4
      this.ID_M1 = this.chronicle.merge(this.ID6, "manual",
        {
          sequence: [this.ID2, this.ID6, this.ID4],
          force: true
        }
      );

      this.chronicle.open("ROOT");
      this.chronicle.open(this.ID_M1);
      assert.isArrayEqual(ARR_M1, this.array);
    },

  ];
};
ChronicledArrayTest.Prototype.prototype = Test.prototype;
ChronicledArrayTest.prototype = new ChronicledArrayTest.Prototype();

Test.registerTest(['Substance.Chronicle', 'Array Operation'], new ChronicledArrayTest());
