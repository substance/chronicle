'use strict';

var Substance = require('substance');
var Chronicle = require('../chronicle');
var ChronicleError = require('../chronicle_error');

function ChronicleImport() {}

ChronicleImport.Prototype = function() {

  var __private__ = this;

  this.import = function(otherIndex) {
    var newIds = this.index.import(otherIndex);
    // sanity check: see if all imported changes can be applied
    if ((this.__mode__ & Chronicle.PEDANTIC_IMPORT) > 0) __private__.importSanityCheck.call(this, newIds);
  };

  this.importSanityCheck = function(newIds) {
    var head = this.versioned.getState();

    // This is definitely very hysterical: we try to reach
    // every provided change by resetting to it.
    // If this is possible we are sure that every change has been applied
    // and reverted at least once.
    // This is for sure not a minimalistic approach.
    var err = null;
    var idx;
    try {
      for (idx = 0; idx < newIds.length; idx++) {
        this.reset(newIds[idx]);
      }
    } catch (_err) {
      err = _err;
      console.log(err.stack);
    }
    // rollback to original state
    this.reset(head);

    if (err) {
      // remove the changes in reverse order to meet restrictions
      newIds.reverse();
      for (idx = 0; idx < newIds.length; idx++) {
        this.index.remove(newIds[idx]);
      }
      if (err) throw new ChronicleError("Import did not pass sanity check: "+err.toString());
    }
  };

};

Substance.initClass(ChronicleImport);

module.exports = ChronicleImport;