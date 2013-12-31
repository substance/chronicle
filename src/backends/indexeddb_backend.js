"use strict";

var util = require("substance-util");
var _ = require("underscore");
var Chronicle = require("../chronicle");
var Index = Chronicle.Index;

var IndexedDbBackend = function(name, index) {
  this.name = name;
  this.index = index;
  this.db = null;
};

IndexedDbBackend.Prototype = function() {

  this.delete = function(cb) {
    var self = this;
    this.clear(function() {
      window.indexedDB.deleteDatabase(self.name);
      cb(null);
    });
  };

  var __clearObjectStore = function(db, name, cb) {
    var transaction = db.transaction([name], "readwrite");
    var objectStore = transaction.objectStore(name);
    var request = objectStore.clear();
    request.onsuccess = function() {
      cb(null);
    };
    request.onerror = function(err) {
      cb(err);
    };
  };

  this.clear = function(cb) {
    var db = this.db;
    var names = ["changes", "snapshots", "refs"];
    util.async.each({
      items: names,
      iterator: function(name, cb) {
        __clearObjectStore(db, name, cb);
      }
    }, cb);
  };

  this.open = function(cb) {
    var self = this;
    // reset this.db to make sure it is only available when successfully opened.
    this.db = null;

    var request = window.indexedDB.open(this.name, 1);
    request.onupgradeneeded = function(event) {
      var db = event.target.result;
      db.createObjectStore("changes", { keyPath: "id" });
      var snapshots = db.createObjectStore("snapshots", { keyPath: "sha" });
      snapshots.createIndex("sha", "sha", {unique:true});
      var refs = db.createObjectStore("refs", { keyPath: "name" });
      refs.createIndex("name", "name", {unique:true});
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

  this.close = function(cb) {
    var self = this;
    var request = this.db.close;
    request.onsuccess = function() {
      cb(null);
      self.db = null;
    };
    request.onerror = function(error) {
      cb(error);
      self.db = null;
    };
  };


  // Load all stored changes into the memory index
  this.load = function(cb) {
    var self = this;
    var transaction = this.db.transaction(["changes", "refs"]);
    var objectStore = transaction.objectStore("changes");

    var iterator = objectStore.openCursor();
    var changes = {};
    iterator.onsuccess = function(event) {
      var cursor = event.target.result;
      if (cursor) {
        changes[cursor.key] = cursor.value;
        cursor.continue();
        return;
      }
      // Note: Index.adapt() mimics a hash to be a Chronicle.Index.
      self.index.import(Index.adapt(changes));

      var refStore = transaction.objectStore("refs");
      iterator = refStore.openCursor();
      iterator.onsuccess = function(event) {
        var cursor = event.target.result;
        if (cursor) {
          self.index.setRef(cursor.key, cursor.value["sha"]);
          cursor.continue();
          return;
        }
        cb(null);
      };
      iterator.onerror = function(event) {
        console.error("Error during loading...", event);
        cb(event);
      };
    };
    iterator.onerror = function(event) {
      console.error("Error during loading...", event);
      cb(event);
    };
  };

  var _saveChanges = function(self, cb) {
    // TODO: we should use a special index which keeps track of new changes to be synched
    // for now brute-forcely overwriting everything
    var transaction = self.db.transaction(["changes"], "readwrite");
    transaction.onerror = function(event) {
      console.log("Error while saving changes.");
      if (cb) cb(event);
    };
    transaction.oncomplete = function() {
      if (cb) cb(null);
    };

    // NOTE: brute-force. Saving all changes everytime. Should be optimized someday.
    var changes = transaction.objectStore("changes");
    self.index.foreach(function(change) {
      var data = change;
      if (change instanceof Chronicle.Change) {
        data = change.toJSON();
      }
      var request = changes.put(data);
      request.onerror = function(event) {
        console.error("Could not add change: ", change.id, event);
      };
    });
  };

  var _saveRefs = function(self, cb) {
    // TODO: we should use a special index which keeps track of new changes to be synched
    // for now brute-forcely overwriting everything
    var transaction = self.db.transaction(["refs"], "readwrite");
    transaction.onerror = function(event) {
      console.log("Error while saving refs.");
      if (cb) cb(event);
    };
    transaction.oncomplete = function() {
      console.log("Index saved.");
      if (cb) cb(null);
    };

    var refs = transaction.objectStore("refs");
    _.each(self.index.listRefs(), function(name) {
      var data = {
        name: name,
        sha: self.index.getRef(name)
      };
      var request = refs.put(data);
      request.onerror = function(event) {
        console.error("Could not store ref: ", data, event);
      };
    });
  };

  this.save = function(cb) {
    var self = this;
    _saveChanges(self, function(error) {
      if (error) return cb(error);
      _saveRefs(self, cb);
    });
  };

  this.saveSnapshot = function(sha, document, cb) {
    var transaction = this.db.transaction(["snapshots"], "readwrite");
    transaction.oncomplete = function() {
      console.log("Saved snapshot.");
      cb(null);
    };
    transaction.onerror = function(event) {
      console.log("Error while saving snapshot.");
      cb(event);
    };

    var snapshots = transaction.objectStore("snapshots");
    var data = document;
    // if the provided document has a toJSON function
    // apply it before serialization
    if (data.toJSON) data = data.toJSON();
    data.sha = sha;
    var request = snapshots.put(data);
    request.onerror = function(event) {
      console.error("Could not add snapshot: ", data, event);
    };
  };

  this.listSnapshots = function(cb) {
    var transaction = this.db.transaction(["snapshots"], "readonly");
    var objectStore = transaction.objectStore("snapshots");
    var index = objectStore.index("sha");
    var iterator = index.openCursor();
    var snapshots = [];

    iterator.onsuccess = function(event) {
      var cursor = event.target.result;
      if (cursor) {
        snapshots.push(cursor.key);
        cursor.continue();
        return;
      }
      cb(null, snapshots);
    };
    iterator.onerror = function(event) {
      console.error("Error during loading...", event);
      cb(event);
    };
  };

  this.getSnapshot = function(sha, cb) {
    var transaction = this.db.transaction(["snapshots"], "readonly");
    var snapshots = transaction.objectStore("snapshots");
    var request = snapshots.get(sha);
    request.onsuccess = function(event) {
      var snapshot = event.target.result;
      cb(null, snapshot);
    };
    request.onerror = function(event) {
      console.error("Error: could not load snapshot for sha", sha);
      cb(event);
    };
  };
};
IndexedDbBackend.prototype = new IndexedDbBackend.Prototype();

module.exports = IndexedDbBackend;
