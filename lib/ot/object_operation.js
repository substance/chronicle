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
var CREATE = 1;
var DELETE = -1;
var UPDATE = 4;

var ObjectOperation = function(data) {

  this.type = data.type;
  this.path = data.path;
  this.val = data.val;
  this.original = data.original;

  if (this.type === UPDATE && this.original === undefined) {
    throw new errors.ChronicleError("Illegal argument: original value must be given");
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

function resolve(obj, path, create) {
  if (path.length === 0) return undefined;

  var key, idx;
  for (idx = 0; idx < path.length-1; idx++) {
    key = path[idx];
    if (obj[key] === undefined) {
      if (create) {
        obj[key] = {};
      } else {
        throw new errors.ChronicleError("Can not resolve property for path: " + JSON.stringify(path));
      }
    }
    obj = obj[key];
  }

  key = path[idx];
  return {parent: obj, key: key};
}

ObjectOperation.__prototype__ = function() {

  this.clone = function() {
    return new ObjectOperation(this);
  };

  this.isNOP = function() {
    return this.type === NOP;
  };

  this.apply = function(obj) {
    if (this.type === NOP) return obj;

    var prop = resolve(obj, this.path, this.type === CREATE);

    if (this.type === CREATE) {
      if (prop.parent[prop.key] !== undefined) {
        throw new errors.ChronicleError("Value already exists. key =" + prop.key + ", " + JSON.stringify(prop.parent));
      }

      prop.parent[prop.key] = util.clone(this.val);
    }

    else if (this.type === DELETE) {
      // TODO: maybe we could tolerate such deletes
      if (prop.parent[prop.key] === undefined) {
        throw new errors.ChronicleError("Key " + prop.key + " not found in " + JSON.stringify(prop.parent));
      }

      delete prop.parent[prop.key];
    }

    else if (this.type === UPDATE) {
      // TODO: maybe we could be less hysterical
      if (prop.parent[prop.key] === undefined) {
        throw new errors.ChronicleError("Key " + prop.key + " not found in " + JSON.stringify(prop.parent));
      }
      if (!_.isEqual(this.original, prop.parent[prop.key])) {
        throw new errors.ChronicleError("Illegal operation: expected value " + JSON.stringify(this.original) + ", was " + JSON.stringify(prop.parent[prop.key]));
      }

      prop.parent[prop.key] = util.clone(this.val);
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
      result.original = this.val;
      result.val = this.original;
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
      val: this.val
    };

    if (this.type === UPDATE) {
      data.original = this.original;
    }

    return data;
  };

};
ObjectOperation.prototype = new ObjectOperation.__prototype__();


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

var transform_create_create = function(a, b) {

  // Note: having two concurring creates is a conflict which should the user
  // should be noticed about. However, if forced the effect of the second operation
  // is preferred. I.e., the effect of the first get's overwritten.

  a.type = NOP;
  b.type = UPDATE;
  b.original = a.val;

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

  // (DELETE, UPDATE) is transformed into (DELETE, CREATE)
  if (!flipped) {
    a.type = NOP;
    b.type = CREATE;
  }
  // (UPDATE, DELETE): the delete is updated to delete the updated value
  else {
    a.val = b.val;
    b.type = NOP;
  }

};

var transform_create_update = function(a, b, flipped) {
  if (a.type !== CREATE) {
    return transform_create_update(b, a, true);
  }

  // Note: having a concurring create and an update is a conflict which should the user
  // should be noticed about. However, if forced the effect of the second operation
  // is preferred.

  // (CREATE, UPDATE):  original value of the update changes to the created value
  if (!flipped) {
    a.type = NOP;
    b.original = a.val;
  }

  // (UPDATE, CREATE)  is turned into (UPDATE, UPDATE)
  else {
    a.type = UPDATE;
    a.original = b.val;
    b.type = NOP;
  }

};

var transform_update_update = function(a, b) {

  // Note: this is a conflict the user should know about

  // second update overrides the effect of the first
  a.type = NOP;
  b.original = a.val;

};

var __transform__ = [];
__transform__[DELETE+DELETE] = transform_delete_delete;
__transform__[DELETE+CREATE] = transform_delete_create;
__transform__[DELETE+UPDATE] = transform_delete_update;
__transform__[CREATE+CREATE] = transform_create_create;
__transform__[CREATE+UPDATE] = transform_create_update;
__transform__[UPDATE+UPDATE] = transform_update_update;

var transform = function(a, b, options) {

  options = options || {};

  var conflict = hasConflict(a, b);

  if (options.check && conflict) {
    throw Chronicle.mergeConflict(a, b);
  }

  if (!options.inplace) {
    a = util.clone(a);
    b = util.clone(b);
  }

  // without conflict: a' = a, b' = b
  if (!conflict) {
    return [a, b];
  }

  __transform__[a.type + b.type](a,b);

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

ObjectOperation.Update = function(path, oldVal, newVal) {
  return new ObjectOperation({type: UPDATE, path: path, val: newVal, original: oldVal});
};

ObjectOperation.Compound = function(ops) {
  return new Compound(ops);
};

// Export
// ========

if (typeof exports !== 'undefined') {
  module.exports = ObjectOperation;
} else {
  Chronicle.OT = Chronicle.OT || {};
  Chronicle.OT.ObjectOperation = ObjectOperation;
}

})(this);


/* NOTE: snippets I used at the beginning, which could be handy when implementing
 convenience helpers

// Removes everything from a given object which is defined
// in oldData but not in newData
function remove(obj, data) {
  var keys = Object.getOwnPropertyNames(data);

  for (var idx = 0; idx < keys.length; idx++) {
    var key = keys[idx];
    if (_.isObject(data[key])) {
      if (!_.isObject(obj[key])) {
        throw new ChronicleError("Illegal target object: expected an object with key " + key);
      }
      remove(obj[key], data[key]);
    } else {
      delete obj[key];
    }
  }

  return result;
}

function update(obj, data) {
  var keys = Object.getOwnPropertyNames(data);

  for (var idx = 0; idx < keys.length; idx++) {
    var key = keys[idx];

    if (_.isObject(data[key])) {
      if (!_.isObject(obj[key])) {
        obj[key] = data[key];
      } else {
        update(obj[key], data[key]);
      }
    } else {
      obj[key] = data[key];
    }
  }
}

function intersects = function(a, b) {
  var keys = Object.getOwnPropertyNames(b);

  for (var idx = 0; idx < keys.length; idx++) {
    var key = keys[idx];

    if (b[key] !== undefined) {
      if (_.isObject(a[key]) && _.isObject(b[key])) {
        if(intersects(a[key], b[key])) {
          return true;
        }
      } else {
        return true;
      }
    }
  }

  return false;
}

*/