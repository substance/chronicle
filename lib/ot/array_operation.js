(function(root) {

// Import
// ========

var _,
    errors,
    util,
    Chronicle,
    Compound;

if (typeof exports !== 'undefined') {
  _ = require('underscore');
  errors   = require('../util/errors');
  util   = require('../util/util');
  Chronicle = require('../../chronicle');
  Compound = require('./compound');
} else {
  _ = root._;
  errors = root.Substance.errors;
  util = root.Substance.util;
  Chronicle = root.Substance.Chronicle;
  Compound = Chronicle.OT.Compound;
}


var NOP = 0;
var DEL = -1;
var INS = +1;
var RET = NOP;
var MOV = 2;

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
    throw new errors.ChronicleError("Illegal argument: insufficient data.");
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
    throw new errors.ChronicleError("Illegal type.");
  }

  if (this.type === INS || this.type === DEL) {
    if (this.pos === undefined || this.val === undefined) {
      throw new errors.ChronicleError("Illegal argument: insufficient data.");
    }
    if (!_.isNumber(this.pos) && this.pos < 0) {
      throw new errors.ChronicleError("Illegal argument: expecting positive number as pos.");
    }
  } else if (this.type === MOV) {
    if (this.pos === undefined || this.target === undefined) {
      throw new errors.ChronicleError("Illegal argument: insufficient data.");
    }
    if (!_.isNumber(this.pos) && this.pos < 0) {
      throw new errors.ChronicleError("Illegal argument: expecting positive number as pos.");
    }
    if (!_.isNumber(this.target) && this.target < 0) {
      throw new errors.ChronicleError("Illegal argument: expecting positive number as target.");
    }
  }
};

ArrayOperation.fromJSON = function(data) {
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
      // enjoy
    }

    // Insert
    else if (this.type === INS) {
      if (array.length < this.pos) {
        throw new errors.ChronicleError("Provided array is too small.");
      }
      array.splice(this.pos, 0, this.val);
    }

    // Delete
    else if (this.type === DEL) {
      if (array.length < this.pos) {
        throw new errors.ChronicleError("Provided array is too small.");
      }
      if (array[this.pos] !== this.val) {
        throw new errors.ChronicleError("Unexpected value at position " + this.pos + ". Expected " + this.val + ", found " + array[this.pos]);
      }
      array.splice(this.pos, 1);
    }

    else {
      throw new errors.ChronicleError("Illegal state.");
    }

    return array;
  };

  this.invert = function() {
    var data = this.toJSON();

    if (this.type === INS) data.type = DEL;
    else if (this.type === DEL) data.type = INS;
    else {
      throw new errors.ChronicleError("Illegal state.");
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
ArrayOperation.prototype = new ArrayOperation.__prototype__();


var _hasConflict = [];

_hasConflict[DEL+DEL] = function(a,b) {
  return a.pos === b.pos;
};

_hasConflict[DEL+INS] = function() {
  return false;
};

_hasConflict[INS+INS] = function(a,b) {
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
  var caseId = a.type + b.type;

  if (_hasConflict[caseId]) {
    return _hasConflict[a.type + b.type](a,b);
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
    throw Chronicle.mergeConflict(a, b);
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
  if (!(op instanceof ArrayOperation)) {
    op = ArrayOperation.fromJSON(op);
  }
  return op.apply(array);
};

ArrayOperation.transform = Compound.createTransform(transform0);
ArrayOperation.hasConflict = hasConflict;

ArrayOperation.perform = __apply__;
// DEPRECATED: use ArrayOperation.exec
ArrayOperation.apply = __apply__;

// Note: this is implemented manually, to avoid the value parameter
// necessary for Insert and Delete
var Move = function(source, target) {

  this.type = MOV;
  this.pos = source;
  this.target = target;

  if (!_.isNumber(this.pos) || !_.isNumber(this.target) || this.pos < 0 || this.target < 0) {
    throw new errors.ChronicleError("Illegal argument");
  }
};

Move.__prototype__ = function() {

  this.clone = function() {
    return new Move(this.pos, this.target);
  };

  this.apply = function(array) {
    if (this.type === NOP) return array;

    if (array.length < this.pos) {
      throw new errors.ChronicleError("Provided array is too small.");
    }
    var val = array[this.pos];
    array.splice(this.pos, 1);

    if (array.length < this.target) throw new errors.ChronicleError("Provided array is too small.");
    array.splice(this.target, 0, val);

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

// Factory methods
// -------
// Note: you should use these methods instead of manually define
// an operation. This is allows us to change the underlying implementation
// without breaking your code.
ArrayOperation.Insert = function(pos, val) {
  return new ArrayOperation([INS, pos, val]);
};

ArrayOperation.Delete = function(pos, val) {
  return new ArrayOperation([DEL, pos, val]);
};

ArrayOperation.Move = function(pos1, pos2) {
  return new Move(pos1, pos2);
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

    if (_.isNumber(s) === RET) {
      pos += s;
    } else {
      if (s[0] === INS) {
        ops.push(ArrayOperation.Insert(pos, s[1]));
        pos+=1;
      } else if (s[0] === DEL) {
        ops.push(ArrayOperation.Delete(pos, s[1]));
      } else {
        throw new errors.ChronicleError("Illegal operation.");
      }
    }
  }

  return new Compound(ops);
};

// Export
// ========

if (typeof exports !== 'undefined') {
  module.exports = ArrayOperation;
} else {
  Chronicle.OT = Chronicle.OT || {};
  Chronicle.OT.ArrayOperation = ArrayOperation;
}

})(this);
