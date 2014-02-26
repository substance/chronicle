require("./001-basics");
require("./002-diff");
require("./003-merge");
require("./004-text");
require("./005-array");
require("./006-persistent-index");

// skip this test when no indexedDB is available
if (typeof windows !== "undefined" && window.indexedDB) {
  require("./indexeddb_test");
};
