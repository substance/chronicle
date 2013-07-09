(function(root) { "use strict";

// Import
// ========

var _,
    errors,
    util,
    Operation,
    Compound;

if (typeof exports !== 'undefined') {
  _ = require('underscore');
  errors   = require('substance-util/errors');
  util   = require('substance-util');
  Operation = require('./operation');
  Compound = require('./compound');
} else {
  _ = root._;
  errors = root.Substance.errors;
  util = root.Substance.util;
  Operation = root.Substance.Operator.Operation;
  Compound = root.Substance.Operator.Compound;
}

var NOP = "NOP";
var DEL = "delete";
var INS = "insert";
var MOV = 'move';

// ArrayOperations can be used to describe changes to arrays by operations.
// ========
//
// Insertions
// --------
//
// An insertion is specified by
//    {
//      type: '+',
//      val:  <value>,
//      pos:  <position>
//    }
// or shorter:
//    ['+', <value>, <position>]
//
//
// Deletions
// --------
//
// A deletion is in the same way as Insertions but with '-' as type.
//
//    ['-', <value>, <position>]
//
// The value must be specified too as otherwise the operation would not be invertible.
//

var ArrayOperation = function(options) {

  // if this operation should be created using an array
  if (_.isArray(options)) {
    var tmp = {
      type: options[0]
    };

    tmp.pos = options[1];
    tmp.val = options[2];

    options = tmp;
  }

  if (options.type === undefined) {
    throw new errors.OperatorError("Illegal argument: insufficient data.");
  }

  // Insert: '+', Delete: '-', Move: '>>'
  this.type = options.type;

  if (this.type === NOP) return;

  // the position where to apply the operation
  this.pos = options.pos;

  // the string to delete or insert
  this.val = options.val;

  // Move operations have a target position
  this.target = options.target;

  // sanity checks
  if(this.type !== NOP && this.type !== INS && this.type !== DEL && this.type !== MOV) {
    throw new errors.OperatorError("Illegal type.");
  }

  if (this.type === INS || this.type === DEL) {
    if (this.pos === undefined || this.val === undefined) {
      throw new errors.OperatorError("Illegal argument: insufficient data.");
    }
    if (!_.isNumber(this.pos) && this.pos < 0) {
      throw new errors.OperatorError("Illegal argument: expecting positive number as pos.");
    }
  } else if (this.type === MOV) {
    if (this.pos === undefined || this.target === undefined) {
      throw new errors.OperatorError("Illegal argument: insufficient data.");
    }
    if (!_.isNumber(this.pos) && this.pos < 0) {
      throw new errors.OperatorError("Illegal argument: expecting positive number as pos.");
    }
    if (!_.isNumber(this.target) && this.target < 0) {
      throw new errors.OperatorError("Illegal argument: expecting positive number as target.");
    }
  }
};

ArrayOperation.fromJSON = function(data) {
  if (_.isArray(data)) {
    if (data[0] === MOV) {
      return new Move(data[1], data[2]);
    } else {
      return new ArrayOperation(data);
    }
  }
  if (data.type === MOV) {
    return Move.fromJSON(data);
  } else if (data.type === Compound.TYPE) {
    var ops = [];
    for (var idx = 0; idx < data.ops.length; idx ++) {
      ops.push(ArrayOperation.fromJSON(data.ops[idx]));
    }
    return ArrayOperation.Compound(ops);
  }
  else  {
    return new ArrayOperation(data);
  }
};

ArrayOperation.__prototype__ = function() {

  this.clone = function() {
    return new ArrayOperation(this);
  };

  this.apply = function(array) {

    if (this.type === NOP) {
      return array;
    }

    var adapter = (array instanceof ArrayOperation.ArrayAdapter) ? array : new ArrayOperation.ArrayAdapter(array);

    // Insert
    if (this.type === INS) {
      if (array.length < this.pos) {
        throw new errors.OperatorError("Provided array is too small.");
      }

      adapter.insert(this.pos, this.val);
    }

    // Delete
    else if (this.type === DEL) {
      if (array.length < this.pos) {
        throw new errors.OperatorError("Provided array is too small.");
      }
      if (array[this.pos] !== this.val) {
        throw new errors.OperatorError("Unexpected value at position " + this.pos + ". Expected " + this.val + ", found " + array[this.pos]);
      }
      adapter.delete(this.pos, this.val);
    }

    else {
      throw new errors.OperatorError("Illegal state.");
    }

    return array;
  };

  this.invert = function() {
    var data = this.toJSON();

    if (this.type === INS) data.type = DEL;
    else if (this.type === DEL) data.type = INS;
    else {
      throw new errors.OperatorError("Illegal state.");
    }

    return new ArrayOperation(data);
  };

  this.hasConflict = function(other) {
    return ArrayOperation.hasConflict(this, other);
  };

  this.toJSON = function() {
    var result = {
      type: this.type,
    };

    if (this.type === NOP) return result;

    result.pos = this.pos;
    result.val = this.val;

    return result;
  };

};
ArrayOperation.__prototype__.prototype = Operation.prototype;
ArrayOperation.prototype = new ArrayOperation.__prototype__();

var _NOP = 0;
var _DEL = 1;
var _INS = 2;
var _MOV = 4;

var CODE = {};
CODE[NOP] = _NOP;
CODE[DEL] = _DEL;
CODE[INS] = _INS;
CODE[MOV] = _MOV;

var _hasConflict = [];

_hasConflict[_DEL | _DEL] = function(a,b) {
  return a.pos === b.pos;
};

_hasConflict[_DEL | _INS] = function() {
  return false;
};

_hasConflict[_INS | _INS] = function(a,b) {
  return a.pos === b.pos;
};

/*
  As we provide Move as quasi atomic operation we have to look at it conflict potential.

  A move is realized as composite of Delete and Insert.

  M / I: ( -> I / I conflict)

    m.s < i && m.t == i-1
    else i && m.t == i

  M / D: ( -> D / D conflict)

    m.s === d

  M / M:

    1. M/D conflict
    2. M/I conflict
*/

var hasConflict = function(a, b) {
  if (a.type === NOP || b.type === NOP) return false;
  var caseId = CODE[a.type] | CODE[b.type];

  if (_hasConflict[caseId]) {
    return _hasConflict[caseId](a,b);
  } else {
    return false;
  }
};

var transform0;

function transform_insert_insert(a, b, first) {

  if (a.pos === b.pos) {
    if (first) {
      b.pos += 1;
    } else {
      a.pos += 1;
    }
  }
  // a before b
  else if (a.pos < b.pos) {
    b.pos += 1;
  }

  // a after b
  else  {
    a.pos += 1;
  }

}

function transform_delete_delete(a, b) {

  // turn the second of two concurrent deletes into a NOP
  if (a.pos === b.pos) {
    b.type = NOP;
    a.type = NOP;
    return;
  }

  if (a.pos < b.pos) {
    b.pos -= 1;
  } else {
    a.pos -= 1;
  }

}

function transform_insert_delete(a, b) {

  // reduce to a normalized case
  if (a.type === DEL) {
    var tmp = a;
    a = b;
    b = tmp;
  }

  if (a.pos <= b.pos) {
    b.pos += 1;
  } else {
    a.pos -= 1;
  }

}

function transform_move(a, b, check, first) {
  if (a.type !== MOV) return transform_move(b, a, check, !first);

  var del = {type: DEL, pos: a.pos};
  var ins = {type: INS, pos: a.target};

  var options = {inplace: true, check:check};

  if (b.type === DEL && a.pos === b.pos) {
    a.type = NOP;
    b.pos = a.target;

  } else if (b.type === MOV && a.pos === b.pos) {
    if (first) {
      b.pos = a.target;
      a.type = NOP;
    } else {
      a.pos = b.target;
      b.type = NOP;
    }
  } else {

    if (first) {
      transform0(del, b, options);
      transform0(ins, b, options);
    } else {
      transform0(b, del, options);
      transform0(b, ins, options);
    }

    a.pos = del.pos;
    a.target = ins.pos;

  }
}

transform0 = function(a, b, options) {

  options = options || {};

  if (options.check && hasConflict(a, b)) {
    throw Operation.conflict(a, b);
  }

  if (!options.inplace) {
    a = util.clone(a);
    b = util.clone(b);
  }

  if (a.type === NOP || b.type === NOP)  {
    // nothing to transform
  }
  else if (a.type === INS && b.type === INS)  {
    transform_insert_insert(a, b, true);
  }
  else if (a.type === DEL && b.type === DEL) {
    transform_delete_delete(a, b, true);
  }
  else if (a.type === MOV || b.type === MOV) {
    transform_move(a, b, options.check, true);
  }
  else {
    transform_insert_delete(a, b, true);
  }

  return [a, b];
};

var __apply__ = function(op, array) {
  if (_.isArray(op)) {
    if (op[0] === MOV) {
      op = new Move(op[1], op[2]);
    } else {
      op = new ArrayOperation(op);
    }
  } else if (!(op instanceof ArrayOperation)) {
    op = ArrayOperation.fromJSON(op);
  }
  return op.apply(array);
};

ArrayOperation.transform = Compound.createTransform(transform0);
ArrayOperation.hasConflict = hasConflict;

ArrayOperation.perform = __apply__;
// DEPRECATED: use ArrayOperation.perform
ArrayOperation.apply = __apply__;

// Note: this is implemented manually, to avoid the value parameter
// necessary for Insert and Delete
var Move = function(source, target) {

  this.type = MOV;
  this.pos = source;
  this.target = target;

  if (!_.isNumber(this.pos) || !_.isNumber(this.target) || this.pos < 0 || this.target < 0) {
    throw new errors.OperatorError("Illegal argument");
  }
};

Move.__prototype__ = function() {

  this.clone = function() {
    return new Move(this.pos, this.target);
  };

  this.apply = function(array) {
    if (this.type === NOP) return array;

    var adapter = (array instanceof ArrayOperation.ArrayAdapter) ? array : new ArrayOperation.ArrayAdapter(array);

    var val = array[this.pos];
    adapter.move(val, this.pos, this.target);

    return array;
  };

  this.invert = function() {
    return new Move(this.target, this.pos);
  };

  this.toJSON = function() {
    return {
      type: MOV,
      pos: this.pos,
      target: this.target
    };
  };

};
Move.__prototype__.prototype = ArrayOperation.prototype;
Move.prototype = new Move.__prototype__();

Move.fromJSON = function(data) {
  return new Move(data.pos, data.target);
};


// classical LCSS, implemented inplace and using traceback trick
var lcss = function(arr1, arr2) {
  var i,j;
  var L = [0];

  for (i = 0; i < arr1.length; i++) {
    for (j = 0; j < arr2.length; j++) {
      L[j+1] = L[j+1] || 0;
      if (_.isEqual(arr1[i], arr2[j])) {
        L[j+1] = Math.max(L[j+1], L[j]+1);
      } else {
        L[j+1] = Math.max(L[j+1], L[j]);
      }
    }
  }

  var seq = [];
  for (j = arr2.length; j >= 0; j--) {
    if (L[j] > L[j-1]) {
      seq.unshift(arr2[j-1]);
    }
  }

  return seq;
};


// Factory methods
// -------
// Note: you should use these methods instead of manually define
// an operation. This is allows us to change the underlying implementation
// without breaking your code.


ArrayOperation.Insert = function(pos, val) {
  return new ArrayOperation([INS, pos, val]);
};

ArrayOperation.Delete = function(pos, val) {
  if (_.isArray(pos)) {
    pos = pos.indexOf(val);
  }
  if (pos < 0) return new ArrayOperation([NOP]);
  return new ArrayOperation([DEL, pos, val]);
};

ArrayOperation.Move = function(pos1, pos2) {
  return new Move(pos1, pos2);
};

ArrayOperation.Push = function(arr, val) {
  var index = arr.length;
  return ArrayOperation.Insert(index, val);
};

ArrayOperation.Pop = function(arr) {
  // First we need to find a way to return values
  var index = arr.length-1;
  return ArrayOperation.Delete(index, arr[index]);
};


// Creates a compound operation that transforms the given oldArray
// into the new Array
ArrayOperation.Update = function(oldArray, newArray) {

  // 1. Compute longest common subsequence
  var seq = lcss(oldArray, newArray);

  // 2. Iterate through the three sequences and generate a sequence of
  //    retains, deletes, and inserts

  var a = seq;
  var b = oldArray;
  var c = newArray;
  var pos1, pos2, pos3;
  pos1 = 0;
  pos2 = 0;
  pos3 = 0;

  seq = [];

  while(pos2 < b.length || pos3 < c.length) {
    if (a[pos1] === b[pos2] && b[pos2] === c[pos3]) {
      pos1++; pos2++; pos3++;
      seq.push(1);
    } else if (a[pos1] === b[pos2]) {
      seq.push(['+', c[pos3++]]);
    } else {
      seq.push(['-', b[pos2++]]);
    }
  }

  // 3. Create a compound for the computed sequence

  return ArrayOperation.Sequence(seq);
};

ArrayOperation.Compound = function(ops) {
  return new Compound(ops);
};

// Convenience factory method to create an operation that clears the given array.
// --------
//

ArrayOperation.Clear = function(arr) {
  var ops = [];
  for (var idx = 0; idx < arr.length; idx++) {
    ops.push(ArrayOperation.Delete(0, arr[idx]));
  }
  return ArrayOperation.Compound(ops);
};



// Convenience factory method to create an incremental complex array update.
// --------
//
// Example:
//  Input:
//    [1,2,3,4,5,6,7]
//  Sequence:
//    [2, ['-', 3], 2, ['+', 8]]
//  Output:
//    [1,2,4,5,8,6,7]
//
// Syntax:
//
//  - positive Number: skip / retain
//  - tuple ['-', <val>]: delete element at current position
//  - tuple ['+', <val>]: insert element at current position

ArrayOperation.Sequence = function(seq) {
  var pos = 0;
  var ops = [];

  for (var idx = 0; idx < seq.length; idx++) {
    var s = seq[idx];

    if (_.isNumber(s) && s > 0) {
      pos += s;
    } else {
      if (s[0] === "+") {
        ops.push(ArrayOperation.Insert(pos, s[1]));
        pos+=1;
      } else if (s[0] === "-") {
        ops.push(ArrayOperation.Delete(pos, s[1]));
      } else {
        throw new errors.OperatorError("Illegal operation.");
      }
    }
  }

  return new Compound(ops);
};

var ArrayAdapter = function(arr) {
  this.array = arr;
};

ArrayAdapter.prototype = {
  insert: function(pos, val) {
    this.array.splice(pos, 0, val);
  },

  delete: function(pos) {
    this.array.splice(pos, 1);
  },

  move: function(val, pos, to) {
    if (this.array.length < pos) {
      throw new errors.OperatorError("Provided array is too small.");
    }
    this.array.splice(pos, 1);

    if (this.array.length < to) {
      throw new errors.OperatorError("Provided array is too small.");
    }
    this.array.splice(to, 0, val);
  }
};
ArrayOperation.ArrayAdapter = ArrayAdapter;

ArrayOperation.NOP = NOP;
ArrayOperation.DELETE = DEL;
ArrayOperation.INSERT = INS;
ArrayOperation.MOVE = MOV;

// Export
// ========

if (typeof exports !== 'undefined') {
  module.exports = ArrayOperation;
} else {
  root.Substance.Operator.ArrayOperation = ArrayOperation;
}

})(this);
