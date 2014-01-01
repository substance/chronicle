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

  this.toJSON = function() {
    return {
      text: this.text
    };
  };
};

var DB_NAME = "substance.chronicle.test";

// Test
// ========

function IndexedDbBackendTest() {

  this.setup = function() {
    this.backend = new IndexedDBBackend(DB_NAME, Chronicle.Index.create());
    // delete the database initially
    window.indexedDB.deleteDatabase(DB_NAME);
  };

  this.fixture = function() {
    var chronicle = Chronicle.create();
    var document = new TestDocument(chronicle);
    this.applyChanges(document);
    return document;
  };

  this.applyChanges = function(document) {
    this.ID1 = document.apply(OP1);
    this.ID2 = document.apply(OP2);
    this.ID3 = document.apply(OP3);
    this.ID4 = document.apply(OP4);
    document.chronicle.open(this.ID1);
    this.ID5_1 = document.apply(OP5_1);
    document.chronicle.open(this.ID1);
    this.ID5_2 = document.apply(OP5_2);
    document.chronicle.open("ROOT");
  };

  this.actions = [
    "Open database", function(cb) {
      var backend = new IndexedDBBackend(DB_NAME, Chronicle.Index.create());
      backend.open(cb);
    },

    "Save an index", function(cb) {
      var document = this.fixture();
      var backend = new IndexedDBBackend(DB_NAME, document.chronicle.index);
      backend.open(function(error) {
        if (error) return cb(error);
        backend.save(cb);
      });
    },

    "Load the index", function(cb) {
      this.index = Chronicle.Index.create();
      var backend = new IndexedDBBackend(DB_NAME, this.index);
      backend.open(function(err) {
        if (err) return cb(err);
        backend.load(cb);
      });
    },

    "Check the loaded index", function() {
      assert.isTrue(this.index.contains(this.ID1));
      assert.isTrue(this.index.contains(this.ID2));
      assert.isTrue(this.index.contains(this.ID3));
      assert.isTrue(this.index.contains(this.ID4));
      assert.isTrue(this.index.contains(this.ID5_1));
      assert.isTrue(this.index.contains(this.ID5_2));
    },

    "Save a snapshot", function(cb) {
      var self = this;
      var document = this.fixture();
      var backend = new IndexedDBBackend(DB_NAME, document.chronicle.index);
      document.chronicle.open("ROOT");
      backend.open(function(error) {
        if (error) return cb(error);
        backend.saveSnapshot("ROOT", document, function(error) {
          if (error) return cb(error);
          document.chronicle.open(self.ID5_1);
          backend.saveSnapshot(self.ID5_1, document, cb);
        });
      });
    },

    "List snapshots", function(cb) {
      var self = this;
      var backend = new IndexedDBBackend(DB_NAME, Chronicle.Index.create());
      backend.open(function(error) {
        if (error) return cb(error);
        backend.listSnapshots(function(error, snapshots) {
          if (error) return cb(error);
          self.snapshots = snapshots;
          cb(null);
        });
      });
    },

    "Check list of snapshots", function() {
      assert.isDefined(this.snapshots);
      assert.isEqual(2, this.snapshots.length);
      assert.isTrue(this.snapshots.indexOf("ROOT") >= 0);
      assert.isTrue(this.snapshots.indexOf(this.ID5_1) >= 0);
    }
  ];
}

registerTest(['Substance.Chronicle', 'IndexedDB Backend'], new IndexedDbBackendTest());
