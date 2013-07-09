(function(root) { "use strict";

// Import
// ========

var _,
    errors,
    util,
    Compound,
    Operation;

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

var INS = "+";
var DEL = "-";

var TextOperation = function(options) {

  // if this operation should be created using an array
  if (_.isArray(options)) {
    options = {
      type: options[0],
      pos: options[1],
      str: options[2]
    };
  }

  if (options.type === undefined || options.pos === undefined || options.str === undefined) {
    throw new errors.ChronicleError("Illegal argument: insufficient data.");
  }

  // '+' or '-'
  this.type = options.type;

  // the position where to apply the operation
  this.pos = options.pos;

  // the string to delete or insert
  this.str = options.str;

  // sanity checks
  if(!this.isInsert() && !this.isDelete()) {
    throw new errors.ChronicleError("Illegal type.");
  }
  if (!_.isString(this.str)) {
    throw new errors.ChronicleError("Illegal argument: expecting string.");
  }
  if (!_.isNumber(this.pos) && this.pos < 0) {
    throw new errors.ChronicleError("Illegal argument: expecting positive number as pos.");
  }
};

TextOperation.fromJSON = function(data) {

  if (data.type === Compound.TYPE) {
    var ops = [];
    for (var idx = 0; idx < data.ops.length; idx++) {
      ops.push(TextOperation.fromJSON(data.ops[idx]));
    }
    return TextOperation.Compound(ops);

  } else {
    return new TextOperation(data);
  }
};

TextOperation.__prototype__ = function() {

  this.clone = function() {
    return new TextOperation(this);
  };

  this.isNOP = function() {
    return this.str.length === 0;
  };

  this.isInsert = function() {
    return this.type === INS;
  };

  this.isDelete = function() {
    return this.type === DEL;
  };

  this.length = function() {
    return this.str.length;
  };

  this.apply = function(str) {
    if (this.isEmpty()) return str;

    var adapter = (str instanceof TextOperation.StringAdapter) ? str : new TextOperation.StringAdapter(str);

    if (this.type === INS) {
      adapter.insert(this.pos, this.str);
    }
    else if (this.type === DEL) {
      adapter.delete(this.pos, this.str.length);
    }
    else {
      throw new errors.ChronicleError("Illegal operation type: " + this.type);
    }

    return adapter.get();
  };

  this.invert = function() {
    var data = {
      type: this.isInsert() ? '-' : '+',
      pos: this.pos,
      str: this.str
    };
    return new TextOperation(data);
  };

  this.hasConflict = function(other) {
    return TextOperation.hasConflict(this, other);
  };

  this.isEmpty = function() {
    return this.str.length === 0;
  };

  this.toJSON = function() {
    return {
      type: this.type,
      pos: this.pos,
      str: this.str
    };
  };

};
TextOperation.__prototype__.prototype = Operation.prototype;
TextOperation.prototype = new TextOperation.__prototype__();

var hasConflict = function(a, b) {

  // Insert vs Insert:
  //
  // Insertions are conflicting iff their insert position is the same.

  if (a.type === INS && b.type === INS)  return (a.pos === b.pos);

  // Delete vs Delete:
  //
  // Deletions are conflicting if their ranges overlap.

  if (a.type === DEL && b.type === DEL) {
    // to have no conflict, either `a` should be after `b` or `b` after `a`, otherwise.
    return !(a.pos >= b.pos + b.str.length || b.pos >= a.pos + a.str.length);
  }

  // Delete vs Insert:
  //
  // A deletion and an insertion are conflicting if the insert position is within the deleted range.

  var del, ins;
  if (a.type === DEL) {
    del = a; ins = b;
  } else {
    del = b; ins = a;
  }

  return (ins.pos >= del.pos && ins.pos < del.pos + del.str.length);
};

// Transforms two Insertions
// --------

function transform_insert_insert(a, b, first) {

  if (a.pos === b.pos) {
    if (first) {
      b.pos += a.str.length;
    } else {
      a.pos += b.str.length;
    }
  }

  else if (a.pos < b.pos) {
    b.pos += a.str.length;
  }

  else {
    a.pos += b.str.length;
  }

}

// Transform two Deletions
// --------
//

function transform_delete_delete(a, b, first) {

  // reduce to a normalized case
  if (a.pos > b.pos) {
    return transform_delete_delete(b, a, !first);
  }

  if (a.pos === b.pos && a.str.length > b.str.length) {
    return transform_delete_delete(b, a, !first);
  }


  // take out overlapping parts
  if (b.pos < a.pos + a.str.length) {
    var s = b.pos - a.pos;
    var s1 = a.str.length - s;
    var s2 = s + b.str.length;

    a.str = a.str.slice(0, s) + a.str.slice(s2);
    b.str = b.str.slice(s1);
    b.pos -= s;
  } else {
    b.pos -= a.str.length;
  }

}

// Transform Insert and Deletion
// --------
//

function transform_insert_delete(a, b) {

  if (a.type === DEL) {
    return transform_insert_delete(b, a);
  }

  // we can assume, that a is an insertion and b is a deletion

  // a is before b
  if (a.pos <= b.pos) {
    b.pos += a.str.length;
  }

  // a is after b
  else if (a.pos >= b.pos + b.str.length) {
    a.pos -= b.str.length;
  }

  // Note: this is a conflict case the user should be noticed about
  // If applied still, the deletion takes precedence
  // a.pos > b.pos && <= b.pos + b.length()
  else {
    var s = a.pos - b.pos;
    b.str = b.str.slice(0, s) + a.str + b.str.slice(s);
    a.str = "";
  }

}

var transform0 = function(a, b, options) {

  options = options || {};

  if (options.check && hasConflict(a, b)) {
    throw Operator.mergeConflict(a, b);
  }

  if (!options.inplace) {
    a = util.clone(a);
    b = util.clone(b);
  }

  if (a.type === INS && b.type === INS)  {
    transform_insert_insert(a, b, true);
  }
  else if (a.type === DEL && b.type === DEL) {
    transform_delete_delete(a, b, true);
  }
  else {
    transform_insert_delete(a,b);
  }

  return [a, b];
};

var __apply__ = function(op, array) {
  if (_.isArray(op)) {
    op = new TextOperation(op);
  }
  else if (!(op instanceof TextOperation)) {
    op = TextOperation.fromJSON(op);
  }
  return op.apply(array);
};

TextOperation.transform = Compound.createTransform(transform0);
TextOperation.apply = __apply__;

var StringAdapter = function(str) {
  this.str = str;
};
StringAdapter.prototype = {
  insert: function(pos, str) {
    if (this.str.length < pos) {
      throw new errors.ChronicleError("Provided string is too short.");
    }
    this.str = this.str.slice(0, pos) + str + this.str.slice(pos);
  },

  delete: function(pos, length) {
    if (this.str.length < pos + length) {
      throw new errors.ChronicleError("Provided string is too short.");
    }
    this.str = this.str.slice(0, pos) + this.str.slice(pos + length);
  },

  get: function() {
    return this.str;
  }
};

TextOperation.Insert = function(pos, str) {
  return new TextOperation(["+", pos, str]);
};

TextOperation.Delete = function(pos, str) {
  return new TextOperation(["-", pos, str]);
};

TextOperation.Compound = function(ops) {
  // do not create a Compound if not necessary
  if (ops.length === 1) return ops[0];
  else return new Compound(ops);
};

// Converts from a given a sequence in the format of Tim's lib
// which is an array of numbers and strings.
// 1. positive number: retain a number of characters
// 2. negative number: delete a string with the given length at the current position
// 3. string: insert the given string at the current position

TextOperation.fromOT = function(str, ops) {

  var atomicOps = []; // atomic ops

  // iterating through the sequence and bookkeeping the position
  // in the source and destination str
  var srcPos = 0,
      dstPos = 0;

  if (!_.isArray(ops)) {
    ops = _.toArray(arguments).slice(1);
  }

  _.each(ops, function(op) {
    if (_.isString(op)) { // insert chars
      atomicOps.push(TextOperation.Insert(dstPos, op));
      dstPos += op.length;
    } else if (op<0) { // delete n chars
      var n = -op;
      atomicOps.push(TextOperation.Delete(dstPos, str.slice(srcPos, srcPos+n)));
      srcPos += n;
    } else { // skip n chars
      srcPos += op;
      dstPos += op;
    }
  });

  return TextOperation.Compound(atomicOps);
};

// A helper class to model Text selections and to provide an easy way
// to bookkeep changes by other applied TextOperations
var Range = function(range) {
  if (_.isArray(range)) {
    this.start = range[0];
    this.length = range[1];
  } else {
    this.start = range.start;
    this.length = range.length;
  }
};

// Transforms a given range tuple (offset, length) in-place.
// --------
//

var range_transform = function(range, textOp, expand) {

  // handle compound operations
  if (textOp.type === Compound.TYPE) {
    for (var idx = 0; idx < textOp.ops.length; idx++) {
      var op = textOp.ops[idx];
      range_transform(range, op);
    }
    return;
  }


  var start = range.start;
  var end = start + range.length;

  // Delete
  if (textOp.type === DEL) {
    var pos1 = textOp.pos;
    var pos2 = textOp.pos+textOp.str.length;

    if (pos1 <= start) {
      start -= Math.min(pos2-pos1, start-pos1);
    }
    if (pos1 <= end) {
      end -= Math.min(pos2-pos1, end-pos1);
    }

  } else if (textOp.type === INS) {
    var pos = textOp.pos;
    var l = textOp.str.length;

    if ( (pos < start) ||
         (pos === start && !expand) ) {
      start += l;
    }

    if ( (pos < end) ||
         (pos === end && expand) ) {
      end += l;
    }
  }

  range.start = start;
  range.length = end - start;
};

Range.__prototype__ = function() {

  this.clone = function() {
    return new Range(this);
  };

  this.toJSON = function() {
    var result = {
      start: this.start,
      length: this.length
    };
    // if (this.expand) result.expand = true;
    return result;
  };

  this.transform = function(textOp, expand) {
    range_transform(this.range, textOp, expand);
  };

};
Range.prototype = new Range.__prototype__();

Range.transform = function(range, op, expand) {
  range_transform(range, op, expand);
};

Range.fromJSON = function(data) {
  return new Range(data);
};

TextOperation.StringAdapter = StringAdapter;
TextOperation.Range = Range;
TextOperation.INSERT = INS;
TextOperation.DELETE = DEL;

// Export
// ========

if (typeof exports !== 'undefined') {
  module.exports = TextOperation;
} else {
  root.Substance.Operator.TextOperation = TextOperation;
}

})(this);
