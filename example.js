(function(root) { "use_strict";

// Imports
// ====

var _, util, Chronicle;

Chronicle = root.Substance.Chronicle;
util = root.Substance.util;
_ = root._;

// Module
// ====

var Computador = function() {
  this.result = 0;
};

Computador.prototype = {

  plus: function(val) {
    this.result += val;
  },

  minus: function(val) {
    this.result -= val;
  },

  times: function(val) {
    this.result *= val;
  },

  div: function(val) {
    if(val < 10E-8) throw new Error("Value too small.");

    this.result /= val;
  }
};

var VersionedComputador = function(chronicle) {
  Computador.call(this);

  this.chronicle = chronicle;
  this.head = Chronicle.Index.ROOT_ID;
};

VersionedComputador.__prototype__ = function() {

  var __super__ = util.prototype(this);

  var inverse = {
    plus:   __super__.minus,
    minus:  __super__.plus,
    times:  __super__.div,
    div:  __super__.times
  };

  function adapt(name) {
    return function(val) {
      __super__[name].call(this, val);
      this.chronicle.record({
        op: name,
        val: val
      });
    };
  }

  this.plus = adapt("plus");
  this.minus = adapt("minus");
  this.div = adapt("div");

  this.times = function(val) {
    var orig = this.result;
    __super__.times.call(this, val);
    var rec = {
      op: "times",
      val: val
    };
    // to preserve invertibility we have to store the old value
    // in this case
    if(val < 10E-8) {
      rec.orig = orig;
    }
    this.chronicle.record(rec);
  };

  this.apply = function(change) {
    // do not call the recording version
    __super__[change.op].call(this, change.val);
  };

  this.revert = function(change) {
    if (change.orig) this.result = change.orig;
    else inverse[change.op].call(this, change.val);
  };

  this.getHead = function() {
    return this.head;
  };

  this.setHead = function(head) {
    this.head = head;
  };

  this.reset = function() {
    this.head = Chronicle.Index.ROOT_ID;
    this.result = 0;
  };

};

VersionedComputador.__prototype__.prototype = Computador.prototype;
VersionedComputador.prototype = _.extend({}, Chronicle.Versioned.prototype, new VersionedComputador.__prototype__());

// Export
// ====

var exports = {
  Computador: Computador,
  VersionedComputador: VersionedComputador
};

if (!root.Substance.test.chronicle) root.Substance.test.chronicle = {};
_.extend(root.Substance.test.chronicle, exports);

})(this);
