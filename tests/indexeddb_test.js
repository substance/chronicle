"use strict";

// Import
// ========

var Test = require('substance-test');
var assert = Test.assert;
var registerTest = Test.registerTest;
var Chronicle = require('../index');
// var MemoryStore = require('substance-store').MemoryStore;
// var Change = Chronicle.Change;
var IndexedDBBackend = require("../src/backends/indexeddb_backend");
var TextOperation = require('substance-operator').TextOperation;


// Fixture

var OP1 = TextOperation.Insert(0, "Lorem amet");
var OP2 = TextOperation.Insert(5, " ipsum");
var OP3 = TextOperation.Insert(12, "dolor ");
var OP4 = TextOperation.Insert(18, "sit ");
var OP5_1 = TextOperation.Insert(5, " sit");
var OP5_2 = TextOperation.Insert(6, "sit ");

var TestDocument = function(chronicle) {
  this.text = "";
  this.chronicle = chronicle;
  chronicle.manage(new Chronicle.TextOperationAdapter(chronicle, this));

  this.setText = function(text) {
    this.text = text;
  };

  this.getText = function() {
    return this.text;
  };

  this.apply = function(op) {
    this.text = op.apply(this.text);
    return this.chronicle.record(op);
  };
};

var DB_NAME = "substance.chronicle.test";

// Test
// ========

function IndexedDbBackendTest() {

  this.setup = function() {
    this.chronicle = Chronicle.create();
    this.index = this.chronicle.index;
    this.backend = new IndexedDBBackend(DB_NAME, this.index);
    // delete the database initially
    this.backend.delete();
    this.fixture();
  };

  this.fixture = function() {
    this.document = new TestDocument(this.chronicle);
    this.ID1 = this.document.apply(OP1);
    this.ID2 = this.document.apply(OP2);
    this.ID3 = this.document.apply(OP3);
    this.ID4 = this.document.apply(OP4);
    this.chronicle.open(this.ID1);
    this.ID5_1 = this.document.apply(OP5_1);
    this.chronicle.open(this.ID1);
    this.ID5_2 = this.document.apply(OP5_2);
    this.chronicle.open("ROOT");
  };

  this.actions = [
    "Open database", function(cb) {
      this.backend.open(cb);
    },

    "Save an index", function(cb) {
      this.backend.save(cb);
    },

    "Load the index", function(cb) {
      this.chronicle = Chronicle.create();
      this.index = this.chronicle.index;
      var backend = new IndexedDBBackend(DB_NAME, this.index);
      this.backend = backend;
      backend.open(function(err) {
        if (err) return cb(err);
        backend.load(cb);
      });
    }
  ];
}

registerTest(['Substance.Chronicle', 'IndexedDB Backend'], new IndexedDbBackendTest());
