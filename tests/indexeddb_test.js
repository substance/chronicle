"use strict";

// Import
// ========

var Test = require('substance-test');
var assert = Test.assert;
var registerTest = Test.registerTest;
var Chronicle = require('../index');
var MemoryStore = require('substance-store').MemoryStore;
var Change = Chronicle.Change;
var IndexedDBBackend = require("../src/indexeddb_backend");


// Test
// ========

function IndexedDbBackendTest() {

  this.setup = function() {
    this.chronicle = Chronicle.create();
    this.index = this.chronicle.index;
    this.backend = new IndexedDBBackend("substance.chronicle.test", this.index);

    // delete the database initially
    this.backend.delete();
  };

  this.actions = [
    "Open database", function(cb) {
      this.backend.open(cb);
    }
  ];
}

registerTest(['Substance.Chronicle', 'IndexedDB Backend'], new IndexedDbBackendTest());
