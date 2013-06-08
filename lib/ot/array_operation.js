(function(root) {

var _ = root._;
var errors = root.Substance.errors;
var Chronicle = root.Substance.Chronicle;

var NOP = "0";
var DEL = "-";
var INS = "+";
var MOV = ">>";

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
// Moves
// --------
//
// A move is specified by
//    {
//      type:    '>>',
//      pos:     <position>,
//      target:  <position>
//    }
// or shorter:
//    ['+', <from>, <to>]

var ArrayOperation = function(options) {

  // if this operation should be created using an array
  if (_.isArray(options)) {
    var tmp = {
      type: options[0]
    };

    if (tmp.type === MOV) {
      tmp.pos = options[1];
      tmp.target = options[2];
    } else {
      tmp.pos = options[1];
      tmp.val = options[2];
    }

    options = tmp;
  }

  if (options.type === undefined) {
    throw new errors.ChronicleError("Illegal argument: insufficient data.");
  }

  // Insert: '+', Delete: '-', Move: '>>'
  this.type = options.type;

  if (this.type === NOP) return;

  if (this.type === MOV) {
    if (options.pos === undefined || options.target === undefined) {
      throw new errors.ChronicleError("Illegal argument: insufficient data.");
    }
  } else {
    if (options.pos === undefined || options.val === undefined) {
      throw new errors.ChronicleError("Illegal argument: insufficient data.");
    }
  }

  // the position where to apply the operation
  this.pos = options.pos;

  // the string to delete or insert
  this.val = options.val;

  // Move operations have a target position
  this.target = options.target;

  // sanity checks
  if(this.type !== NOP && this.type !== INS && this.type !== DEL && this.type !== MOV) throw new errors.ChronicleError("Illegal type.");

  if (!_.isNumber(this.pos) && this.pos < 0) throw new errors.ChronicleError("Illegal argument: expecting positive number as pos.");

  if (this.type === MOV) {
    if (!_.isNumber(this.target) && this.target < 0) throw new errors.ChronicleError("Illegal argument: expecting positive number as target.");
  }
};

ArrayOperation.DEL = DEL;
ArrayOperation.INS = INS;
ArrayOperation.MOV = MOV;

ArrayOperation.fromJSON = function(json) {
  return new ArrayOperation(json);
};

ArrayOperation.__prototype__ = function() {

  this.isNOP = function() {
    return this.type === NOP;
  };

  this.isInsert = function() {
    return this.type === INS;
  };

  this.isDelete = function() {
    return this.type === DEL;
  };

  this.isMove = function() {
    return this.type === MOV;
  };

  this.copy = function() {
    return new ArrayOperation(this);
  };

  this.apply = function(array) {

    if (this.isNOP()) {
      // enjoy
    }

    // Insert
    else if (this.isInsert()) {
      if (array.length < this.pos) throw new errors.ChronicleError("Provided array is too small.");
      array.splice(this.pos, 0, this.val);
    }

    // Delete
    else if (this.isDelete()) {
      if (array.length < this.pos) {
        throw new errors.ChronicleError("Provided array is too small.");
      }
      if (array[this.pos] !== this.val) {
        throw new errors.ChronicleError("Unexpected value at position " + this.pos + ". Expected " + this.val + ", found " + array[this.pos]);
      }
      array.splice(this.pos, 1);
    }

    // Move
    else {
      if (array.length <= this.pos || array.length <= this.target) {
        throw new errors.ChronicleError("Provided array is too small.");
      }

      if (this.pos == this.target) return array;

      var val = array[this.pos];

      array.splice(this.pos, 1);
      array.splice(this.target, 0, val);
    }

    return array;
  };

  this.invert = function() {
    var data = this.toJSON();

    if (this.isInsert()) data.type = DEL;
    else if (this.isDelete()) data.type = INS;
    else if (this.isMove()) {
      data.pos = this.target;
      data.target = this.pos;
    }

    return new ArrayOperation(data);
  };

  this.hasConflict = function(other) {

    if (!(other instanceof ArrayOperation)) {
      throw new errors.ChronicleError("Illegal Argument.");
    }

    // Deletes and Moves of the same element are conflicts
    if ( (this.isDelete()  || this.isMove()) &&
         (other.isDelete() || other.isMove()) ) {
      return (this.pos === other.pos);
    }
    else {
      // TODO: are the others ok, i.e., Insert at same position or Moves with that target position.
      return false;
    }

  };

  this.toJSON = function() {
    var result = {
      type: this.type,
    };

    if (this.isNOP()) return result;

    result.pos = this.pos;

    if (this.isMove()) {
      result.target = this.target;
    } else {
      result.val = this.val;
    }

    return result;
  };

};
ArrayOperation.prototype = new ArrayOperation.__prototype__();

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


function transform_move_delete(a, b, first) {

  // reduce to a normalized case
  if (a.type === DEL) {
    return transform_move_delete(b, a, !first);
  }

  // after some struggle I decided to implement this completely test-case driven
  // you can find a test case for each case here.
  // TODO: simplify this after the behaviour is exactly as desired.

  // a before b
  if (a.pos < b.pos && a.target < b.pos) {
    // nothing to do;
  }

  // a after b
  else if (a.pos > b.pos && a.target > b.pos) {
    // nothing to transform;
    a.pos -= 1;
    a.target -= 1;
  }

  // a.s < b < a.t
  else if(a.pos < b.pos && b.pos < a.target) {
    a.target -= 1;
    b.pos -= 1;
  }

  // a.t < b < a.s
  else if(a.target < b.pos && b.pos < a.pos) {
    a.pos -= 1;
    b.pos += 1;
  }

  // a.s == b
  else if (a.pos === b.pos) {
    a.type = NOP;
    b.pos = a.target;
  }

  // a.s < b == a.t
  else if (a.pos < b.pos && b.pos === a.target) {
    a.target -= 1;
    b.pos -= 1;
  }

  // a.t == b < a.s
  else if (a.target === b.pos && b.pos < a.pos) {
    a.pos -= 1;
    a.target -= 1;
  }

}

function transform_move_insert(a, b, first) {

  // reduce to a normalized case
  if (a.type === INS) {
    return transform_move_insert(b, a, !first);
  }

  // after some struggle I decided to implement this completely test-case driven
  // you can find a test case for each case here.
  // TODO: simplify this after the behaviour is exactly as desired.

  // a before b
  if (a.pos < b.pos && a.target < b.pos) {
    // nothing to transform;
  }

  // a after b
  else if (a.pos > b.pos && a.target > b.pos) {
    // nothing to transform;
    a.pos += 1;
    a.target += 1;
  }

  // a.s < b < a.t
  else if(a.pos < b.pos && b.pos < a.target) {
    a.target += 1;
    b.pos -= 1;
  }

  // a.t < b < a.s
  else if(a.target < b.pos && b.pos < a.pos) {
    a.pos += 1;
    b.pos += 1;
  }

  // a.s == b < a.t
  else if (a.pos === b.pos && b.pos < a.target) {
    a.pos += 1;
    a.target += 1;
  }

  // a.s < b == a.t
  else if (a.pos < b.pos && b.pos === a.target) {
    a.target += 1;
    b.pos -= 1;
  }

  // a.t < b == a.s
  else if (a.target < b.pos && b.pos === a.pos) {
    a.pos += 1;
    b.pos += 1;
  }

  // a.t == b < a.s
  else if (a.target === b.pos && b.pos < a.pos) {
    a.pos += 1;
    a.target += 1;
  }

}

var transform0 = function(a, b, options) {

  options = options || {};

  if (options.check && a.hasConflict(b)) {
    throw Chronicle.mergeConflict(a, b);
  }

  if (!options.inplace) {
    a = a.copy();
    b = b.copy();
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

    if (a.type === INS || b.type === INS) {
      transform_move_insert(a, b, true);
    }
    else {
      transform_move_delete(a, b, true);
    }
  }
  else {
    transform_insert_delete(a, b, true);
  }

  return [a, b];
};

ArrayOperation.transform = Chronicle.OT.Compound.createTransform(transform0);

Chronicle.OT = Chronicle.OT || {};
Chronicle.OT.ArrayOperation = ArrayOperation;

})(this);
