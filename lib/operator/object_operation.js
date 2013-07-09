(function(root) { "use strict";

// Import
// ========

var _,
    errors,
    util,
    Operation,
    Compound,
    TextOperation,
    ArrayOperation;

if (typeof exports !== 'undefined') {
  _ = require('underscore');
  util   = require('substance-util');
  errors   = require('substance-util/errors');
  Operation = require('./operation');
  Compound = require('./compound');
  TextOperation = require('./text_operation');
  ArrayOperation = require('./array_operation');
} else {
  _ = root._;
  util = root.Substance.util;
  errors = root.Substance.errors;
  Operation = root.Substance.Operator.Operation;
  Compound = root.Substance.Operator.Compound;
  TextOperation = root.Substance.Operator.TextOperation;
  ArrayOperation = root.Substance.Operator.ArrayOperation;
}

var NOP = "NOP";
var CREATE = "create";
var DELETE = 'delete';
var UPDATE = 'update';
var SET = 'set';

var ObjectOperation = function(data) {

  this.type = data.type;
  this.path = data.path;

  if (this.type === CREATE || this.type === DELETE) {
    this.val = data.val;
  }

  // Updates can be given as value or as Operation (Text, Array)
  else if (this.type === UPDATE) {
    if (data.diff !== undefined) {
      this.diff = data.diff;
      this.propertyType = data.propertyType;
    } else {
      throw new errors.ChronicleError("Illegal argument: update by value or by diff must be provided");
    }
  }

  else if (this.type === SET) {
    this.val = data.val;
    this.original = data.original;
  }

};

ObjectOperation.fromJSON = function(data) {

  if (data.type === Compound.TYPE) {
    var ops = [];
    for (var idx = 0; idx < data.ops.length; idx++) {
      ops.push(ObjectOperation.fromJSON(data.ops[idx]));
    }
    return ObjectOperation.Compound(ops);

  } else {
    return new ObjectOperation(data);
  }
};

ObjectOperation.__prototype__ = function() {

  this.clone = function() {
    return new ObjectOperation(this);
  };

  this.isNOP = function() {
    return this.type === NOP;
  };

  this.apply = function(obj) {
    if (this.type === NOP) return obj;

    // Note: this allows to use a custom adapter implementation
    // to support other object like backends
    var adapter = (obj instanceof ObjectOperation.Object) ? obj : new ObjectOperation.Object(obj);

    if (this.type === CREATE) {
      adapter.create(this.path, util.clone(this.val));
      return obj;
    }

    var val = adapter.get(this.path);

    if (this.type === DELETE) {
      // TODO: maybe we could tolerate such deletes
      if (val === undefined) {
        throw new errors.ChronicleError("Property " + JSON.stringify(this.path) + " not found.");
      }
      adapter.delete(this.path, val);
    }

    else if (this.type === UPDATE) {
      if (this.propertyType === 'object') {
        val = ObjectOperation.apply(this.diff, val);
        if(!adapter.inplace()) adapter.set(this.path, val);
      }
      else if (this.propertyType === 'array') {
        val = ArrayOperation.apply(this.diff, val);
        if(!adapter.inplace()) adapter.set(this.path, val);
      }
      else if (this.propertyType === 'string') {
        val = TextOperation.apply(this.diff, val);
        adapter.set(this.path, val);
      }
      else {
        throw new errors.ChronicleError("Unsupported type for operational update.");
      }
    }

    else if (this.type === SET) {
      adapter.set(this.path, this.val);
    }

    else {
      throw new errors.ChronicleError("Illegal state.");
    }

    return obj;
  };

  this.invert = function() {

    if (this.type === NOP) {
      return { type: NOP };
    }

    var result = new ObjectOperation(this);

    if (this.type === CREATE) {
      result.type = DELETE;
    }

    else if (this.type === DELETE) {
      result.type = CREATE;
    }

    else if (this.type === UPDATE) {
      var invertedDiff;
      if (this.propertyType === 'string') {
        invertedDiff = TextOperation.fromJSON(this.diff).invert();
      } else if (this.propertyType === 'array') {
        invertedDiff = ArrayOperation.fromJSON(this.diff).invert();
      }
      result.diff = invertedDiff;
      result.propertyType = this.propertyType;
    }

    else if (this.type === SET) {
      result.val = this.original;
      result.original = this.val;
    }

    else {
      throw new errors.ChronicleError("Illegal state.");
    }

    return result;
  };

  this.hasConflict = function(other) {
    return ObjectOperation.hasConflict(this, other);
  };

  this.toJSON = function() {

    if (this.type === NOP) {
      return {
        type: NOP
      };
    }

    var data = {
      type: this.type,
      path: this.path,
    };

    if (this.type === CREATE || this.type === DELETE) {
      data.val = this.val;
    }

    else if (this.type === UPDATE) {
      data.diff = this.diff;
      data.propertyType = this.propertyType;
    }

    else if (this.type === SET) {
      data.val = this.val;
      data.original = this.original;
    }

    return data;
  };

};
ObjectOperation.__prototype__.prototype = Operation.prototype;
ObjectOperation.prototype = new ObjectOperation.__prototype__();

ObjectOperation.Object = function(obj) {
  this.obj = obj;
};

ObjectOperation.Object.__prototype__ = function() {

  function resolve(self, obj, path, create) {
    var item = obj;
    var idx = 0;
    for (; idx < path.length-1; idx++) {
      if (item === undefined) {
        throw new Error("Key error: could not find element for path " + JSON.stringify(self.path));
      }

      if (item[path[idx]] === undefined && create) {
        item[path[idx]] = {};
      }

      item = item[path[idx]];
    }
    return {parent: item, key: path[idx]};
  }

  this.get = function(path) {
    var item = resolve(this, this.obj, path);
    return item.parent[item.key];
  };

  this.create = function(path, value) {
    var item = resolve(this, this.obj, path, true);
    if (item.parent[item.key] !== undefined) {
      throw new errors.ChronicleError("Value already exists. path =" + JSON.stringify(path));
    }
    item.parent[item.key] = value;
  };

  this.set = function(path, value) {
    var item = resolve(this, this.obj, path);
    item.parent[item.key] = value;
  };

  this.delete = function(path) {
    var item = resolve(this, this.obj, path);
    delete item.parent[item.key];
  };

  this.inplace = function() {
    return true;
  };

};
ObjectOperation.Object.prototype = new ObjectOperation.Object.__prototype__();


var hasConflict = function(a, b) {
  if (a.type === NOP || b.type === NOP) return false;

  return _.isEqual(a.path, b.path);
};

var transform_delete_delete = function(a, b) {
  // both operations have the same effect.
  // the transformed operations are turned into NOPs
  a.type = NOP;
  b.type = NOP;
};

var transform_create_create = function() {
  // TODO: maybe it would be possible to create an differntial update that transforms the one into the other
  // However, we fail for now.
  throw new errors.ChronicleError("Can not transform two concurring creates of the same property");
};

var transform_delete_create = function(a, b, flipped) {
  if (a.type !== DELETE) {
    return transform_delete_create(b, a, true);
  }

  if (!flipped) {
    a.type = NOP;
  } else {
    a.val = b.val;
    b.type = NOP;
  }
};

var transform_delete_update = function(a, b, flipped) {
  if (a.type !== DELETE) {
    return transform_delete_update(b, a, true);
  }

  var op;
  if (b.propertyType === 'string') {
    op = TextOperation.fromJSON(b.diff);
  } else if (b.propertyType === 'array') {
    op = ArrayOperation.fromJSON(b.diff);
  }

  // (DELETE, UPDATE) is transformed into (DELETE, CREATE)
  if (!flipped) {
    a.type = NOP;
    b.type = CREATE;
    b.val = op.apply(a.val);
  }
  // (UPDATE, DELETE): the delete is updated to delete the updated value
  else {
    a.val = op.apply(a.val);
    b.type = NOP;
  }

};

var transform_create_update = function() {
  // it is not possible to reasonably transform this.
  throw new errors.ChronicleError("Can not transform a concurring create and update of the same property");
};

var transform_update_update = function(a, b) {

  // Note: this is a conflict the user should know about

  var op_a, op_b, t;
  if (b.propertyType === 'string') {
    op_a = TextOperation.fromJSON(a.diff);
    op_b = TextOperation.fromJSON(b.diff);
    t = TextOperation.transform(op_a, op_b, {inplace: true});
  } else if (b.propertyType === 'array') {
    op_a = ArrayOperation.fromJSON(a.diff);
    op_b = ArrayOperation.fromJSON(b.diff);
    t = ArrayOperation.transform(op_a, op_b, {inplace: true});
  } else if (b.propertyType === 'object') {
    op_a = ObjectOperation.fromJSON(a.diff);
    op_b = ObjectOperation.fromJSON(b.diff);
    t = ObjectOperation.transform(op_a, op_b, {inplace: true});
  }

  a.diff = t[0];
  b.diff = t[1];
};

var transform_create_set = function(a, b, flipped) {
  if (a.type !== CREATE) return transform_create_set(b, a, true);

  if (!flipped) {
    a.type = NOP;
    b.original = a.val;
  } else {
    a.type = SET;
    a.original = b.val;
    b.type = NOP;
  }

};

var transform_delete_set = function(a, b, flipped) {
  if (a.type !== DELETE) return transform_delete_set(b, a, true);

  if (!flipped) {
    a.type = NOP;
    b.type = CREATE;
    b.original = undefined;
  } else {
    a.val = b.val;
    b.type = NOP;
  }

};

var transform_update_set = function() {
  throw new errors.ChronicleError("Can not transform update/set of the same property.");
};

var transform_set_set = function(a, b) {
  a.type = NOP;
  b.original = a.val;
};

var _NOP = 0;
var _CREATE = 1;
var _DELETE = 2;
var _UPDATE = 4;
var _SET = 8;

var CODE = {};
CODE[NOP] =_NOP;
CODE[CREATE] = _CREATE;
CODE[DELETE] = _DELETE;
CODE[UPDATE] = _UPDATE;
CODE[SET] = _SET;

var __transform__ = [];
__transform__[_DELETE | _DELETE] = transform_delete_delete;
__transform__[_DELETE | _CREATE] = transform_delete_create;
__transform__[_DELETE | _UPDATE] = transform_delete_update;
__transform__[_CREATE | _CREATE] = transform_create_create;
__transform__[_CREATE | _UPDATE] = transform_create_update;
__transform__[_UPDATE | _UPDATE] = transform_update_update;
__transform__[_CREATE | _SET   ] = transform_create_set;
__transform__[_DELETE | _SET   ] = transform_delete_set;
__transform__[_UPDATE | _SET   ] = transform_update_set;
__transform__[_SET    | _SET   ] = transform_set_set;

var transform = function(a, b, options) {

  options = options || {};

  var conflict = hasConflict(a, b);

  if (options.check && conflict) {
    throw Operation.conflict(a, b);
  }

  if (!options.inplace) {
    a = util.clone(a);
    b = util.clone(b);
  }

  // without conflict: a' = a, b' = b
  if (!conflict) {
    return [a, b];
  }

  __transform__[CODE[a.type] | CODE[b.type]](a,b);

  return [a, b];
};

ObjectOperation.transform = Compound.createTransform(transform);
ObjectOperation.hasConflict = hasConflict;

var __apply__ = function(op, obj) {
  if (!(op instanceof ObjectOperation)) {
    op = ObjectOperation.fromJSON(op);
  }
  return op.apply(obj);
};

// TODO: rename to "exec" or perform
ObjectOperation.apply = __apply__;

ObjectOperation.Create = function(path, val) {
  return new ObjectOperation({type: CREATE, path: path, val: val});
};

ObjectOperation.Delete = function(path, val) {
  return new ObjectOperation({type: DELETE, path: path, val: val});
};

function guessPropertyType(op) {

  if (op instanceof Compound) {
    return guessPropertyType(op.ops[0]);
  }
  if (op instanceof TextOperation) {
    return "string";
  }
  else if (op instanceof ArrayOperation) {
    return  "array";
  }
  else {
    return "other";
  }
}

ObjectOperation.Update = function(path, diff, propertyType) {
  propertyType = propertyType || guessPropertyType(diff);

  return new ObjectOperation({
    type: UPDATE,
    path: path,
    diff: diff,
    propertyType: propertyType
  });
};

ObjectOperation.Set = function(path, oldVal, newVal) {
  return new ObjectOperation({
    type: SET,
    path: path,
    val: newVal,
    original: oldVal
  });
};

ObjectOperation.Compound = function(ops) {
  return new Compound(ops);
};

// TODO: this can not deal with cyclic references
var __extend__ = function(obj, newVals, path, deletes, creates, updates) {
  var keys = Object.getOwnPropertyNames(newVals);

  for (var idx = 0; idx < keys.length; idx++) {
    var key = keys[idx];
    var p = path.concat(key);

    if (newVals[key] === undefined && obj[key] !== undefined) {
      deletes.push(ObjectOperation.Delete(p, obj[key]));

    } else if (_.isObject(newVals[key])) {

      // TODO: for now, the structure must be the same
      if (!_.isObject(obj[key])) {
        throw new errors.ChronicleError("Incompatible arguments: newVals must have same structure as obj.");
      }
      __extend__(obj[key], newVals[key], p, deletes, creates, updates);

    } else {
      if (obj[key] === undefined) {
        creates.push(ObjectOperation.Create(p, newVals[key]));
      } else {
        var oldVal = obj[key];
        var newVal = newVals[key];
        if (!_.isEqual(oldVal, newVal)) {
          updates.push(ObjectOperation.Set(p, oldVal, newVal));
        }
      }
    }
  }
};

ObjectOperation.Extend = function(obj, newVals) {
  var deletes = [];
  var creates = [];
  var updates = [];
  __extend__(obj, newVals, [], deletes, creates, updates);
  return ObjectOperation.Compound(deletes.concat(creates).concat(updates));
};

ObjectOperation.NOP = NOP;
ObjectOperation.CREATE = CREATE;
ObjectOperation.DELETE = DELETE;
ObjectOperation.UPDATE = UPDATE;
ObjectOperation.SET = SET;

// Export
// ========


if (typeof exports !== 'undefined') {
  module.exports = ObjectOperation;
} else {
  root.Substance.Operator.ObjectOperation = ObjectOperation;
}

})(this);
