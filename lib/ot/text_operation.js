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

  this.copy = function() {
    return new TextOperation(this);
  };

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

  this.hasConflict = function(other) {

    if (!(other instanceof TextOperation)) {
      throw new errors.ChronicleError("Illegal argument.");
    }

    // Insert vs Insert:
    //
    // Insertions are conflicting iff their insert position is the same.

    if (this.isInsert() && other.isInsert())  return (this.pos === other.pos);

    // Delete vs Delete:
    //
    // Deletions are conflicting if their ranges overlap.

    if (this.isDelete() && other.isDelete()) {
      // to have no conflict, either `a` should be after `b` or `b` after `a`, otherwise.
      return !(this.pos >= other.pos + other.length() || other.pos >= this.pos + this.length());
    }

    // Delete vs Insert:
    //
    // A deletion and an insertion are conflicting if the insert position is within the deleted range.

    var del = this.isDelete() ? this : other;
    var ins = other.isInsert() ? other : this;
    return ins.pos >= del.pos && ins.pos < del.pos + del.length();
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

// Transforms two Insertions
// --------

function transform_insert_insert(a, b, first) {

  if (a.pos === b.pos) {
    if (first) {
      b.pos += a.length();
    } else {
      a.pos += b.length();
    }
  }

  else if (a.pos < b.pos) {
    b.pos += a.length();
  }

  else {
    a.pos += b.length();
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

  if (a.pos === b.pos && a.length() > b.length()) {
    return transform_delete_delete(b, a, !first);
  }


  // take out overlapping parts
  if (b.pos < a.pos + a.length()) {
    var s = b.pos - a.pos;
    var s1 = a.length() - s;
    var s2 = s + b.length();

    a.str = a.str.slice(0, s) + a.str.slice(s2);
    b.str = b.str.slice(s1);
    b.pos -= s;
  } else {
    b.pos -= a.length();
  }

}

// Transform Insert and Deletion
// --------
//

function transform_insert_delete(a, b) {

  if (a.isDelete()) {
    return transform_insert_delete(b, a);
  }

  // we can assume, that a is an insertion and b is a deletion

  // a is before b
  if (a.pos <= b.pos) {
    b.pos += a.length();
  }

  // a is after b
  else if (a.pos >= b.pos + b.length()) {
    a.pos -= b.length();
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

  if (options.check && a.hasConflict(b)) {
    throw Chronicle.mergeConflict(a, b);
  }

  if (!options.inplace) {
    a = a.copy();
    b = b.copy();
  }

  if (a.isInsert() && b.isInsert())  {
    transform_insert_insert(a, b, true);
  }
  else if (a.isDelete() && b.isDelete()) {
    transform_delete_delete(a, b, true);
  }
  else {
    transform_insert_delete(a,b);
  }

  return [a, b];
};

TextOperation.transform = Chronicle.OT.Compound.createTransform(transform0);

Chronicle.OT = Chronicle.OT || {};
Chronicle.OT.TextOperation = TextOperation;


})(this);
