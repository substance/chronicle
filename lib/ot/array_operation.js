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
      tmp.pos = options[1],
      tmp.target = options[2]
    } else {
      tmp.val = options[1];
      tmp.pos = options[2];
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
      if (array.length < this.pos) throw new errors.ChronicleError("Provided array is too small.");
      if (array[this.pos] !== this.val) throw new errors.ChronicleError("Unexpected value at position " + this.pos + ". Expected " + this.val + ", found " + array[this.pos]);
      array.splice(this.pos, 1);
    }

    // Move
    else {
      // Note: it is allowed to have a target === array.length which means that
      // the element is appended
      if (array.length <= this.pos || array.length < this.target) throw new errors.ChronicleError("Provided array is too small.");
      if (this.pos == this.target) return array;

      var val = array[this.pos];

      // Depending on the actual indices it is better to insert first
      // or vice versa
      if (this.pos < this.target) {
        array.splice(this.target, 0, val);
        array.splice(this.pos, 1);
      } else {
        array.splice(this.pos, 1);
        array.splice(this.target, 0, val);
      }
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

      // There are some move position pecularities, as to avoid inambiguities of movements
      // with same source and target index (see explanation above).
      //
      // Example:
      // [1,2,3] -> [2,3,1] would be done by [MOV, 1, 0, 3]
      // and inverted by [MOV, 1, 2, 0]
      //
      if (this.pos < this.target) {
        data.pos -= 1;
      } else {
        data.target += 1;
      }
    }

    return new ArrayOperation(data);
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

ArrayOperation.hasConflict = function(a, b) {

  // Deletes and Moves of the same element are conflicts
  if ( (a.isDelete() || a.isMove()) && (b.isDelete() || b.isMove()) )  return (a.pos === b.pos);

  // TODO: are the others ok, i.e., Insert at same position or Moves with that target position.
  return false;
};

function transform_insert_insert(a, b) {

  // reduce to a normalized case
  if (a.pos > b.pos) {
    return transform_insert_insert(b, a).reverse();
  }

  var a_t = a.toJSON();
  var b_t = b.toJSON();

  b_t.pos = b.pos + 1;

  return [a_t, b_t];
}

function transform_delete_delete(a, b) {

  // reduce to a normalized case
  if (a.pos > b.pos) {
    return transform_delete_delete(b, a).reverse();
  }

  var a_t = a.toJSON();
  var b_t = b.toJSON();

  if (a.pos === b.pos) {
    b_t = { type: NOP };
  } else {
    b_t.pos += 1;
  }

  return [a_t, b_t];
}

function transform_insert_delete(a, b) {

  // reduce to a normalized case
  if (a.isDelete()) {
    return transform_insert_delete(b,a).reverse();
  }

  var a_t = a.toJSON();
  var b_t = b.toJSON();

  if (a.pos <= b.pos) {
    b_t.pos += 1;
  } else {
    a_t.pos += 1;
  }

  return [a_t, b_t];
}


function transform_move_delete(a, b) {

  // reduce to a normalized case
  if (a.isDelete()) {
    return transform_move_delete(b,a).reverse();
  }

  var a_t = a.toJSON();
  var b_t = b.toJSON();

  // Note: this is a conflict case which the user should know about
  if (a.pos === b.pos) {
    a_t = { type: NOP };
  }

  // [a, a2, b] + [a2, a, b]  ->  a and b are independent
  else if (a.pos <= b.pos && a.target <= b.pos) {
    // everything is fine
  }
  // [a, b, a2] -> move source is left of deleted position
  else if (a.pos <= b.pos && b <= a.target) {
    a_t.target -= 1;
    b_t.pos -= 1;
  }
  // [a2, b, a] -> move target is left / move source is right of deleted position
  else if (a.target <= b.pos && b <= a.pos) {
    a_t.pos -= 1;
    b_t.pos += 1;
  }
  // [b, a, a2] + [b, a2, a]  -> delete left of move
  else {
    a_t.pos -= 1;
    a_t.target -= 1;
  }

  return [a_t, b_t];
}

function transform_move_insert(a, b) {

  // reduce to a normalized case
  if (a.isInsert()) {
    return transform_move_insert(b,a).reverse();
  }

  var a_t = a.toJSON();
  var b_t = b.toJSON();

  // [a, a2, b] + [a2, a, b]  ->  a and b are independent
  if (a.pos <= b.pos && a.target <= b.pos) {
    // everything is fine
  }
  // [a, b, a2] -> move source is left of inserted position
  else if (a.pos <= b.pos && b <= a.target) {
    a_t.target += 1;
    b_t.pos -= 1;
  }
  // [a2, b, a] -> move target is left / move source is right of inserted position
  else if (a.target <= b.pos && b <= a.pos) {
    a_t.pos += 1;
    b_t.pos += 1;
  }
  // [b, a, a2] + [b, a2, a]  -> insert left of move
  else {
    a_t.pos += 1;
    a_t.target += 1;
  }

  return [a_t, b_t];
}

ArrayOperation.transform = function(a, b) {

  var transformed;

  if (a.isNOP() || b.isNOP())  {
    transformed = [a.toJSON(), b.toJSON()];
  }
  else if (a.isInsert() && b.isInsert())  {
    transformed = transform_insert_insert(a,b);
  }
  else if (a.isDelete() && b.isDelete()) {
    transformed = transform_delete_delete(a,b);
  }
  else if (a.isMove() || b.isMove()) {

    if (a.isInsert() || b.isInsert()) {
      transformed = transform_move_insert(a,b);
    }
    else {
      transformed = transform_move_delete(a,b);
    }

  }
  else {
    transformed = transform_insert_delete(a,b);
  }

  return [new ArrayOperation(transformed[0]), new ArrayOperation(transformed[1])];
};

Chronicle.OT = Chronicle.OT || {};
Chronicle.OT.ArrayOperation = ArrayOperation;

})(this);
