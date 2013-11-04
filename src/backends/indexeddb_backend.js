"use strict";

var Chronicle = require("../chronicle");
var Index = Chronicle.Index;

var IndexedDbBackend = function(name, index) {
  this.name = name;
  this.index = index;
  this.db = null;
};

IndexedDbBackend.Prototype = function() {

  this.delete = function() {
    window.indexedDB.deleteDatabase(this.name);
  };

  this.open = function(cb) {
    var self = this;
    // reset this.db to make sure it is only available when successfully opened.
    this.db = null;

    var request = window.indexedDB.open(this.name, 1);
    request.onupgradeneeded = function(event) {
      var db = event.target.result;
      db.createObjectStore("changes", { keyPath: "id" });
    };
    request.onerror = function(event) {
      console.error("Could not open database", self.name);
      cb(event);
    };
    request.onsuccess = function(event) {
      console.log("Opened database", self.name);
      self.db = event.target.result;
      cb(null);
    };
  };

  // Load all stored changes into the memory index
  this.load = function(cb) {
    var self = this;
    var transaction = this.db.transaction(["changes"]);
    var objectStore = transaction.objectStore("changes");

    var iterator = objectStore.openCursor();

    var changes = {};

    iterator.onsuccess = function(event) {
      var cursor = event.target.result;
      if (cursor) {
        // Note: this requires the changes iterated topoloically sorted
        // i.e., a change can only be added if all its parents are already added.
        changes[cursor.key] = cursor.value;
        cursor.continue();
        return;
      }
      self.index.import(Index.adapt(changes));
      cb(null);
    };

    iterator.onerror = function(event) {
      console.error("Error during loading...", event);
      cb(event);
    };
  };

  this.save = function(cb) {
    // TODO: we should use a special index which keeps track of new changes to be synched
    // for now brute-forcely overwriting everything
    var transaction = this.db.transaction(["changes"], "readwrite");

    transaction.oncomplete = function() {
      console.log("Index saved.");
      cb(null);
    };

    transaction.onerror = function(event) {
      console.log("Error while saving index.");
      cb(event);
    };

    var changes = transaction.objectStore("changes");
    this.index.foreach(function(change) {
      var request = changes.add(change.toJSON());
      request.onerror = function(event) {
        console.error("Could not add change: ", change.id, event);
      };
    });
  };
};
IndexedDbBackend.prototype = new IndexedDbBackend.Prototype();

module.exports = IndexedDbBackend;
