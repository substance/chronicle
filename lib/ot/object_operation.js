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
var UPDATE = 2;

var ObjectOperation = function(data) {

  this.type = data.type;
  this.path = data.path;
  this.val = data.val;
  this.original = data.original;

  if (this.type === UPDATE && this.original === undefined) {
    throw new ChronicleError("Illegal argument: original value must be given");
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

function resolve(obj, path) {
  if (path.length === 0) return undefined;

  var key, idx;
  for (idx = 0; idx < path.length-1; idx++) {
    key = path[idx];
    if (obj[key] === undefined) {
      throw new errors.ChronicleError("Can not resolve property for path: " + JSON.stringify(path));
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

    var prop = resolve(obj, this.path);

    if (this.type === CREATE) {
      prop.parent[prop.key] = util.clone(this.val);
    }

    else if (this.type === DELETE) {
      delete prop.parent[prop.key];
    }

    else if (this.type === UPDATE) {
      prop.parent[prop.key] = util.clone(this.val);
    }

    else {
      throw new errors.ChronicleError("Illegal state.");
    }

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

    var data = {};
    if (this.create) data.create = this.create;
    if (this.delete) data.delete = this.delete;
    if (this.update) {
      data.update = this.update;
      data.original = this.original;
    }
    return data;
  };

};
ObjectOperation.prototype = new ObjectOperation.__prototype__();


var hasConflict = function(a, b) {
  if (a.type === NOP || b.type === NOP) return false;

  return _.equal(a.path, b.path);
};

var transform0 = function(a, b, options) {

  options = options || {};

  if (options.check && hasConflict(a, b)) {
    throw Chronicle.mergeConflict(a, b);
  }

  if (!options.inplace) {
    a = util.clone(a);
    b = util.clone(b);
  }

  // TODO: implement
  // without conflict: a' = a, b' = b

  // For conflicting changes apply following rules
  // a=DEL, b=DEL -> a' = NOP, b' = NOP (concurrent deletion of the same property are ok)
  // a=DEL, b=CRE -> a' = NOP, b' = b
  // a=CRE, b=DEL -> a' = NOP, b' = DEL: b'.val = a.val
  // a=CRE, b=CRE -> a' = NOP, b' = UPDATE: b'.original = a.val


  return [a, b];
};

ObjectOperation.transform = Compound.createTransform(transform0);

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