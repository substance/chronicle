"use strict";

var util = require("substance-util");
var Test = require('substance-test');
var assert = Test.assert;
var registerTest = Test.registerTest;
var Chronicle = require('../index');
// var MemoryStore = require('substance-store').MemoryStore;
// var Change = Chronicle.Change;
var IndexedDBBackend = require("../src/backends/indexeddb_backend");
var TextOperation = require('substance-operator').TextOperation;


// Fixture
// -------

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

  // this.setup = function() {
  // };

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
    "Delete exisiting database", function(cb) {
      // delete the database initially
      var __id__ = util.uuid();
      console.log("Deleting test database...", __id__);
      var request = window.indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = function() {
        console.log("...deleted.", __id__);
        cb(null);
      };
      request.onerror = function(error) {
        console.log("...failed.", __id__);
        cb(error);
      };
    },

    "Open and close database", function(cb) {
      var backend = new IndexedDBBackend(DB_NAME, Chronicle.Index.create());

      util.async.sequential({
        "functions": [
          function(cb) {
            backend.open(cb);
          }
        ],
        "finally": function(err) {
          backend.close(function() {
            cb(err, null);
          });
        }
      }, cb);
    },

    "Save an index", function(cb) {
      var document = this.fixture();
      var backend = new IndexedDBBackend(DB_NAME, document.chronicle.index);
      util.async.sequential({
        "functions": [
          function(cb) {
            backend.open(cb);
          },
          function(cb) {
            backend.save(cb);
          }
        ],
        "finally": function(err) {
          backend.close(function() {
            cb(err, null);
          });
        }
      }, cb);
    },

    "Load the index", function(cb) {
      var self = this;
      var index = Chronicle.Index.create();
      var backend = new IndexedDBBackend(DB_NAME, index);
      util.async.sequential({
        "functions": [
          function(cb) {
            backend.open(cb);
          },
          function(cb) {
            backend.load(cb);
          },
          function() {
            assert.isTrue(index.contains(self.ID1));
            assert.isTrue(index.contains(self.ID2));
            assert.isTrue(index.contains(self.ID3));
            assert.isTrue(index.contains(self.ID4));
            assert.isTrue(index.contains(self.ID5_1));
            assert.isTrue(index.contains(self.ID5_2));
          }
        ],
        "finally": function(err) {
          backend.close(function() {
            cb(err, null);
          });
        }
      }, cb);
    },

    "Save a snapshot", function(cb) {
      var self = this;
      var document = this.fixture();
      var backend = new IndexedDBBackend(DB_NAME, document.chronicle.index);
      document.chronicle.open("ROOT");

      util.async.sequential({
        "functions": [
          function(cb) {
            backend.open(cb);
          },
          function(cb) {
            backend.saveSnapshot("ROOT", document, cb);
          },
          function(cb) {
            document.chronicle.open(self.ID5_1);
            backend.saveSnapshot(self.ID5_1, document, cb);
          }
        ],
        "finally": function(err) {
          backend.close(function() {
            cb(err, null);
          });
        }
      }, cb);
    },

    "List snapshots", function(cb) {
      var self = this;
      var backend = new IndexedDBBackend(DB_NAME, Chronicle.Index.create());
      util.async.sequential({
        "functions": [
          function(cb) {
            backend.open(cb);
          },
          function(cb) {
            backend.listSnapshots(cb);
          },
          function(snapshots, cb) {
            assert.isDefined(snapshots);
            assert.isEqual(2, snapshots.length);
            assert.isTrue(snapshots.indexOf("ROOT") >= 0);
            assert.isTrue(snapshots.indexOf(self.ID5_1) >= 0);
            cb(null);
          }
        ],
        "finally": function(err) {
          backend.close(function() {
            cb(err, null);
          });
        }
      }, cb);
    }
  ];
}

registerTest(['Substance.Chronicle', 'IndexedDB Backend'], new IndexedDbBackendTest());
