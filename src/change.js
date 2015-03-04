'use strict';

var Substance = require('substance');
var ChronicleError = require('./chronicle_error');

// A change recorded in the chronicle
// ========
//
// Each change has an unique id (equivalent to git SHA).
// A change can have multiple parents (merge).
//
// options:
//   - id: a custom id for the change

var Change = function(id, parent, data) {

  this.type = 'change';

  if (!id) {
    throw new ChronicleError("Every change needs a unique id.");
  }
  this.id = id;

  if (!parent) {
    throw new ChronicleError("Every change needs a parent.");
  }

  this.parent = parent;

  // Application specific data
  // --------
  //
  // This needs to contain all information to be able to apply and revert
  // a change.

  this.data = data;

  this.uuid = Substance.uuid;

};

Change.prototype = {

  toJSON: function() {
    return {
      type: this.type,
      id: this.id,
      parent: this.parent,
      data: this.data
    };
  }

};

Change.fromJSON = function(json) {
  return new Change(json.parent, json.data, json);
};

module.exports = Change;
