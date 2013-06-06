(function(root) {

var _ = root._;
var errors = root.Substance.errors;
var Chronicle = root.Substance.Chronicle;

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
  if(!this.isInsert() && !this.isDelete()) throw new errors.ChronicleError("Illegal type.");
  if (!_.isString(this.str)) throw new errors.ChronicleError("Illegal argument: expecting string.");
  if (!_.isNumber(this.pos) && this.pos < 0) throw new errors.ChronicleError("Illegal argument: expecting positive number as pos.");
};

TextOperation.fromJSON = function(json) {
  return new TextOperation(json);
};

TextOperation.__prototype__ = function() {

  this.isInsert = function() {
    return this.type === "+";
  };

  this.isDelete = function() {
    return this.type === "-";
  };

  this.length = function() {
    return this.str.length;
  };

  this.apply = function(str) {
    if (this.isEmpty()) return str;

    if (this.isInsert()) {
      if (str.length < this.pos) throw new errors.ChronicleError("Provided string is too short.");
      return str.slice(0, this.pos) + this.str + str.slice(this.pos);
    }

    else {
      if (str.length < this.pos + this.str.length) throw new errors.ChronicleError("Provided string is too short.");
      var del = str.slice(this.pos, this.pos + this.str.length);

      if (del !== this.str) {
        throw new errors.ChronicleError("Provided string is incompatible: expected " + this.str + " at position " + this.pos + ", found " + del);
      }

      return str.slice(0, this.pos) + str.slice(this.pos + this.length());
    }
  };

  this.invert = function() {
    var data = {
      type: this.isInsert() ? '-' : '+',
      pos: this.pos,
      str: this.str
    };
    return new TextOperation(data);
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
TextOperation.prototype = new TextOperation.__prototype__();

TextOperation.INS = INS;
TextOperation.DEL = DEL;

TextOperation.hasConflict = function(a, b) {

  // Insert vs Insert:
  //
  // Insertions are conflicting iff their insert position is the same.

  if (a.isInsert() && b.isInsert())  return (a.pos === b.pos);

  // Delete vs Delete:
  //
  // Deletions are conflicting if their ranges overlap.

  if (a.isDelete() && b.isDelete()) {
    // to have no conflict, either `a` should be after `b` or `b` after `a`, otherwise.
    return !(a.pos >= b.pos + b.length() || b.pos >= a.pos + a.length());
  }

  // Delete vs Insert:
  //
  // A deletion and an insertion are conflicting if the insert position is within the deleted range.

  var del = a.isDelete() ? a : b;
  var ins = b.isInsert() ? b : a;
  return ins.pos >= del.pos && ins.pos < del.pos + del.length();
};

// Transforms two Insertions
// --------
// Example:
//   - a
// o          o = "."
//   - b
//
// ### Case 1: (no conflict, a before b)
//
// a = [+, 0, "bla"], b = [+, 1, "blupp"] -> "bla.blupp"
// a' = a, b' = [+, 4, "blupp"]
//
// ### Case 2: (no conflict, b before a)
//
// Reduced to Case 1.
//
// ### Case 3: (conflict)
//
// a = [+, 0, "bla"], b = [+, 0, "blupp"] -> "blablupp"
// a' = a, b' = [+, 3, "blupp"]
// convention: a is before b
//

function transform_insert_insert(a, b, first) {

  // we can assume that a.pos <= b.pos here
  var a_t = a.toJSON();
  var b_t = b.toJSON();

  if (a.pos === b.pos) {
    if (first) {
      b_t.pos = b.pos + a.length();
    } else {
      a_t.pos = a.pos + b.length();
    }
  }
  else if (a.pos < b.pos) {
    b_t.pos = b.pos + a.length();
  } else {
    a_t.pos = a.pos + b.length();
  }

  return [a_t, b_t];
}

// Transform two Deletions
// --------
// Example:
//   - a
// o          o = "bla.blupp"
//   - b
//
// ### Case 1: (no overlap, a before b)
//
// a = [-, 0, "bla"], b = [-, 4, "blupp"]     -> ".blupp" vs. "bla."
// a' = a, b' = [-, 1, "blupp"]               -> "."
//
// ### Case 2: (no overlap, b before a)
//
// Reduced to case 1.
//
// ### Case 3: (overlap, a before or b or at same position)
//
// a = [-, 1, "la.b"], b = [-, 3, ".blu"]       -> "blupp" vs. "blapp"
// a' = [-, 1, "la"], b' = [-, 1, "lu"]                    -> "bpp"
//
// Note: the user should be noticed about a potential conflict
//
// ### Case 4: (overlap, a after b)
//
// Reduced to Case 3.

function transform_delete_delete(a, b, first) {
  // reduce to a normalized case
  if (a.pos > b.pos) {
    return transform_delete_delete(b, a, !first).reverse();
  }

  if (a.pos === b.pos && a.length() > b.length()) {
    return transform_delete_delete(b, a, !first).reverse();
  }

  var a_t = a.toJSON();
  var b_t = b.toJSON();
  var s;

  if (a.pos === b.pos) {
    // Note: this is a conflict case the user should be noticed about
    // Leave the first untouched and trunc the second
    if (first) {
      s = a.length();
      b_t.str = b.str.slice(s);
      b_t.pos -= s;
    } else {
      s = b.length();
      a_t.str = a.str.slice(s);
      a_t.pos -= s;
    }
  } else {
    if (b.pos < a.pos + a.length()) {
      s = a.pos + a.length() - b.pos;
      a_t.str = a.str.slice(0, s);
      b_t.str = b.str.slice(s);
    }
    b_t.pos -= a.length();
  }

  return [a_t, b_t];
}

// Transform Insert and Deletion
// --------
// Example:
//   - a
// o          o = ".blupp"
//   - b
//
// ### Case 1: (no conflict, a before b or at the same position)
//
// a = [+, 0, "bla"], b = [-, 1, "blupp"]     -> "bla.blupp" vs. "."
// a' = a, b' = [-, 4, "blupp"]               -> "bla."
//
// ### Case 2: (no conflict, a after b)
//
// Reduced to case 1.
//
// ### Case 3: (conflict, a in the range of b)
//
// a = [+, 2, "la.b"], b = [-, 2, "lu"]             -> ".bla.blupp" vs. ".bpp"
// a' = [+, 0, ""] (= NOP), b' = [-, 2, "la.blu"]   -> ".bpp"
//
// Note: the user should be noticed about this conflict
//
// ### Case 4: (conflict, b in range of a)
//
// Reduced to Case 3.

function transform_insert_delete(a, b) {
  // Note:

  if (a.isDelete()) {
    return transform_insert_delete(b, a).reverse();
  }

  var a_t = a.toJSON();
  var b_t = b.toJSON();

  // we can assume, that a is an insertion and b is a deletion

  // a is before b
  if (a.pos <= b.pos) {
    b_t.pos += a.length();
  }
  // a is after b
  else if (a.pos >= b.pos + b.length()) {
    a_t.pos -= b.length();
  }

  // Note: this is a conflict case the user should be noticed about
  // If applied still, the deletion takes precedence
  // a.pos > b.pos && <= b.pos + b.length()
  else {
    var s = a.pos - b.pos;
    a_t.str = "";
    b_t.str = b.str.slice(0, s) + a.str + b.str.slice(s);
  }

  return [a_t, b_t];
}

TextOperation.transform = function(a, b) {

  var transformed;

  if (a.isInsert() && b.isInsert())  {
    transformed = transform_insert_insert(a, b, true);
  }
  else if (a.isDelete() && b.isDelete()) {
    transformed = transform_delete_delete(a, b, true);
  }
  else {
    transformed = transform_insert_delete(a,b);
  }

  return [new TextOperation(transformed[0]), new TextOperation(transformed[1])];
};

Chronicle.OT = Chronicle.OT || {};
Chronicle.OT.TextOperation = TextOperation;

})(this);
