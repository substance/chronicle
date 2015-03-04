var Substance = require('substance');

function ChronicleError() {
  Substance.Error.apply(this, arguments);
}

Substance.inherit(ChronicleError, Substance.Error);

module.exports = ChronicleError;
