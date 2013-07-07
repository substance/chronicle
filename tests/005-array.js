(function(root) {

var assert,
    Chronicle,
    Operator;

if (typeof exports !== 'undefined') {
  assert   = require('substance-test/assert');
  Chronicle = require('substance-chronicle');
  Operator = require('substance-operator');
} else {
  assert = root.Substance.assert;
  Chronicle = root.Substance.Chronicle;
  Operator = root.Substance.Operator;
}

var ArrayOperation = Operator.ArrayOperation;

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

function testTransform(a, b, input, expected) {
  var t = ArrayOperation.transform(a, b);

  var output = ArrayOperation.perform(t[1], ArrayOperation.perform(a, input.slice(0)));
  assert.isArrayEqual(expected, output);

  output = ArrayOperation.perform(t[0], ArrayOperation.perform(b, input.slice(0)));
  assert.isArrayEqual(expected, output);

}


var ArrayOperationTest = function() {

  this.actions = [

    // All cases are tested canonically. No convenience. Completeness.

    // Insert-Insert Transformations
    // --------
    // Cases:
    //  1. `a < b`:   operations should not be affected
    //  2. `b < a`:   dito
    //  3. `a == b`:  result depends on preference (first applied)

    "Transformation: a=Insert, b=Insert (1,2), a < b and b < a", function() {
      var input = [1,3,5];
      var expected = [1,2,3,4,5];
      var a = ArrayOperation.Insert(1, 2);
      var b = ArrayOperation.Insert(2, 4);

      testTransform(a, b, input, expected);
      testTransform(b, a, input, expected);
    },

    // Example:
    //     A = [1,4], a = [+, 1, 2], b = [+, 1, 3]
    //     A  - a ->  [1, 2, 4]   - b' ->   [1,2,3,4]     => b'= [+, 2, 3], transform(a, b) = [a, b']
    //     A  - b ->  [1, 3, 4]   - a' ->   [1,3,2,4]     => a'= [+, 2, 2], transform(b, a) = [a', b]
    "Transformation: a=Insert, b=Insert (3), a == b", function() {
      var input = [1,4];
      var expected = [1,2,3,4];
      var expected_2 = [1,3,2,4];
      var a = ArrayOperation.Insert(1, 2);
      var b = ArrayOperation.Insert(1, 3);

      // in this case the transform is not symmetric
      testTransform(a, b, input, expected);
      testTransform(b, a, input, expected_2);
    },

    // Delete-Delete Transformations
    // --------
    // Cases:
    //  1. `a < b`:   operations should not be affected
    //  2. `b < a`:   dito
    //  3. `a == b`:  second operation should not have an effect;
    //                user should be noticed about conflict

    "Transformation: a=Delete, b=Delete (1,2), a < b and b < a", function() {
      var input = [1,2,3,4,5];
      var expected = [1,3,5];
      var a = ArrayOperation.Delete(1, 2);
      var b = ArrayOperation.Delete(3, 4);

      testTransform(a, b, input, expected);
      testTransform(b, a, input, expected);
    },

    "Transformation: a=Delete, b=Delete (3), a == b", function() {
      var input = [1,2,3];
      var expected = [1,3];
      var a = ArrayOperation.Delete(1, 2);
      var b = ArrayOperation.Delete(1, 2);

      testTransform(a, b, input, expected);
      testTransform(b, a, input, expected);
    },

    // Insert-Delete Transformations
    // --------
    // Cases: (a = insertion, b = deletion)
    //  1. `a < b`:   b must be shifted right
    //  2. `b < a`:   a must be shifted left
    //  3. `a == b`:  ???

    //     A = [1,3,4,5], a = [+, 1, 2], b = [-, 2, 4]
    //     A  - a ->  [1,2,3,4,5] - b' ->   [1,2,3,5]     => b'= [-, 3, 4]
    //     A  - b ->  [1,3,5]     - a' ->   [1,2,3,5]     => a'= [+, 1, 2] = a
    "Transformation: a=Insert, b=Delete (1), a < b", function() {
      var input = [1,3,4,5];
      var expected = [1,2,3,5];
      var a = ArrayOperation.Insert(1, 2);
      var b = ArrayOperation.Delete(2, 4);

      testTransform(a, b, input, expected);
      testTransform(b, a, input, expected);
    },

    //     A = [1,2,3,5], a = [+,3,4], b = [-,1,2]
    //     A  - a ->  [1,2,3,4,5] - b' ->   [1,3,4,5]     => b'= [-,1,2] = b
    //     A  - b ->  [1,3,5]     - a' ->   [1,3,4,5]     => a'= [+,2,4]
   "Transformation: a=Insert, b=Delete (2), b < a", function() {
      var input = [1,2,3,5];
      var expected = [1,3,4,5];
      var a = ArrayOperation.Insert(3, 4);
      var b = ArrayOperation.Delete(1, 2);

      testTransform(a, b, input, expected);
      testTransform(b, a, input, expected);
    },

    //     A = [1,2,3], a = [+,1,4], b = [-,1,2]
    //     A  - a ->  [1,4,2,3] - b' ->   [1,4,3]     => b'= [-,2,2]
    //     A  - b ->  [1,3]     - a' ->   [1,4,3]     => a'= [+,1,4] = a
    "Transformation: a=Insert, b=Delete (3), a == b", function() {
      var input = [1,2,3];
      var expected = [1,4,3];
      var a = ArrayOperation.Insert(1, 4);
      var b = ArrayOperation.Delete(1, 2);

      testTransform(a, b, input, expected);
      testTransform(b, a, input, expected);
    },

    "Transformation (conflict): a=Move, b=Insert, m.s > i && m.t == i", function() {
      var input = [1,3,4,5];
      var expected1 = [1,5,2,3,4];
      var expected2 = [1,2,5,3,4];
      var a = ArrayOperation.Move(3, 1);
      var b = ArrayOperation.Insert(1, 2);

      testTransform(a, b, input, expected1);
      testTransform(b, a, input, expected2);
    },

    "Transformation (conflict): a=Move, b=Insert, m.s < i && m.t == i-1", function() {
      var input = [1,2,3,5];
      var expected1 = [1,3,2,4,5];
      var expected2 = [1,3,4,2,5];
      var a = ArrayOperation.Move(1, 2);
      var b = ArrayOperation.Insert(3, 4);

      testTransform(a, b, input, expected1);
      testTransform(b, a, input, expected2);
    },

    "Transformation (conflict): a=Move, b=Delete, m.s == d", function() {
      var input = [1,2,3,4];
      var expected = [1,2,4];
      var a = ArrayOperation.Move(2, 0);
      var b = ArrayOperation.Delete(2, 3);

      testTransform(a, b, input, expected);
      testTransform(b, a, input, expected);
    },

    "Transformation (conflict): a=Move, b=Move, a.s == b.s", function() {
      var input = [1,2,3,4];
      var expected1 = [1,3,2,4];
      var expected2 = [2,1,3,4];
      var a = ArrayOperation.Move(1, 0);
      var b = ArrayOperation.Move(1, 2);

      testTransform(a, b, input, expected1);
      testTransform(b, a, input, expected2);
    },

    "Transformation (conflict): a=Move, b=Move, a.s < b.t && a.t == b.t-1", function() {
      var input = [1,2,3,4];
      var expected1 = [2,1,4,3];
      var expected2 = [2,4,1,3];
      var a = ArrayOperation.Move(0, 1);
      var b = ArrayOperation.Move(3, 2);

      testTransform(a, b, input, expected1);
      testTransform(b, a, input, expected2);
    },

    "Transformation (conflict): a=Move, b=Move, a.t == b.t", function() {
      var input = [1,2,3,4];
      var expected1 = [1,3,4,2];
      var expected2 = [1,4,3,2];
      var a = ArrayOperation.Move(2, 1);
      var b = ArrayOperation.Move(3, 1);

      testTransform(a, b, input, expected1);
      testTransform(b, a, input, expected2);
    },

    "Update: [1,2,3,4,5] -> [2,1,3,4]", function() {
      var input = [1,2,3,4,5];
      var expected = [2,1,3,4];

      var op = ArrayOperation.Update(input, expected);
      var output = op.apply(input);

      assert.isArrayEqual(expected, output);
    },

    "Update: [1,2,3,4,5] -> []", function() {
      var input = [1,2,3,4,5];
      var expected = [];

      var op = ArrayOperation.Update(input, expected);
      var output = op.apply(input);

      assert.isArrayEqual(expected, output);
    },

    "Update: [1,2,3,4,5] -> [5,4,3,2,1]", function() {
      var input = [1,2,3,4,5];
      var expected = [5,4,3,2,1];

      var op = ArrayOperation.Update(input, expected);
      var output = op.apply(input);

      assert.isArrayEqual(expected, output);
    },

    //     A = [1,2,3,4,5], a = [>>,,], b = [>>,,]
    //     A  - a ->  [1,2,3,4,5]   - b' ->   []   => b'= [>>,,]
    //     A  - b ->  [1,2,3,4,5]   - a' ->   []   => a'= [>>,,]
    //
    //     a: move "" after "" before "", b: move "" after "" and before ""
    //
    //      [] -b'->
    //      [] -a'->
    //

    "Load fixture", function() {
      this.fixture();
    },

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

    "Delete 3: [1,2,3,4,5] -> [1,2,4,5]", function() {
      var input = [1,2,3,4,5];
      var expected = [1,2,4,5];

      var op = ArrayOperation.Delete(input, 3);
      var output = op.apply(input);

      assert.isArrayEqual(expected, output);
    },

    "Pop: [1,2,3,4,5] -> [1,2,3,4]", function() {
      var input = [1,2,3,4,5];
      var expected = [1,2,3,4];

      var op = ArrayOperation.Pop(input);
      var output = op.apply(input);

      assert.isArrayEqual(expected, output);
    },

    "Push: [1,2,3,4] -> [1,2,3,4,6]", function() {
      var input = [1,2,3,4];
      var expected = [1,2,3,4,6];

      var op = ArrayOperation.Push(input, 6);
      var output = op.apply(input);

      assert.isArrayEqual(expected, output);
    }

  ];

};

ArrayOperationTest.__prototype__ = function() {

  var ID_IDX = 1;

  this.uuid = function() {
    return ""+ID_IDX++;
  };

  this.setup = function() {
    this.chronicle = Chronicle.create({mode: Chronicle.HYSTERICAL});
    this.index = this.chronicle.index;

    ID_IDX = 1;
    this.chronicle.uuid = this.uuid;

    this.array = [];
    this.adapter = new Chronicle.ArrayOperationAdapter(this.chronicle, this.array);
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

};
ArrayOperationTest.prototype = new ArrayOperationTest.__prototype__();

root.Substance.registerTest(['Chronicle', 'Array Operation'], new ArrayOperationTest());

})(this);
