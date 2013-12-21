"use strict";

var Chronicle = require('./src/chronicle');

Chronicle.IndexImpl = require('./src/index_impl');
Chronicle.ChronicleImpl = require('./src/chronicle_impl');
Chronicle.DiffImpl = require('./src/diff_impl');
Chronicle.TmpIndex = require('./src/tmp_index');

Chronicle.create = Chronicle.ChronicleImpl.create;
Chronicle.Index.create = Chronicle.IndexImpl.create;
Chronicle.Diff.create = Chronicle.DiffImpl.create;

Chronicle.ArrayOperationAdapter = require('./src/array_adapter');
Chronicle.TextOperationAdapter = require('./src/text_adapter');

Chronicle.IndexedDBBackend = require("./src/backends/indexeddb_backend");

module.exports = Chronicle;
