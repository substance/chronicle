(function(root) {

var assert,
    errors,
    Chronicle,
    TextOperation,
    registerTest;

if (typeof exports !== 'undefined') {
  assert   = require('substance-test/assert');
  errors   = require('substance-util/errors');
  Chronicle = require('..');
  TextOperation = require('substance-operator').TextOperation;
  registerTest = require('substance-test').Test.registerTest;
} else {
  assert = root.Substance.assert;
  errors   = root.Substance.errors;
  Chronicle = root.Substance.Chronicle;
  TextOperation = root.Substance.Operator.TextOperation;
  registerTest = root.Substance.Test.registerTest;
}

var TEXT1 = "Lorem amet";
var TEXT2 = "Lorem ipsum amet";
var TEXT3 = "Lorem ipsum dolor amet";
var TEXT4 = "Lorem ipsum dolor sit amet";
var TEXT5 = "Lorem sit amet";
var TEXT_M1 = "Lorem ipsum sit amet";

var OP1 = TextOperation.Insert(0, "Lorem amet");
var OP2 = TextOperation.Insert(5, " ipsum");
var OP3 = TextOperation.Insert(12, "dolor ");
var OP4 = TextOperation.Insert(18, "sit ");

var OP5_1 = TextOperation.Insert(5, " sit");
var OP5_2 = TextOperation.Insert(6, "sit ");

// Index:
//
// ROOT - 1 - 2  - 3 - 4
//        |    \
//        |      ---
//        |          \
//        |            M1
//        |          /
//        |---- 5_2
//        |
//         ---- 5_1 (fails when merged with 2)


var TestDocument;

var ChronicledTextTest = function() {

  var ID_IDX = 1;

  this.uuid = function() {
    return ""+ID_IDX++;
  };

  this.setup = function() {
    this.chronicle = Chronicle.create({mode: Chronicle.HYSTERICAL});
    this.index = this.chronicle.index;

    ID_IDX = 1;
    this.chronicle.uuid = this.uuid;

    this.document = new TestDocument(this.chronicle);
    this.fixture();
  };

  this.fixture = function() {
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
    "Basic checkout", function() {
      this.chronicle.open(this.ID4);
      assert.isEqual(TEXT4, this.document.getText());

      this.chronicle.open(this.ID1);
      assert.isEqual(TEXT1, this.document.getText());

      this.chronicle.open(this.ID5_1);
      assert.isEqual(TEXT5, this.document.getText());

      this.chronicle.open(this.ID3);
      assert.isEqual(TEXT3, this.document.getText());

      this.chronicle.open(this.ID2);
      assert.isEqual(TEXT2, this.document.getText());
    },

    "Merge (simple)", function() {
      this.chronicle.open(this.ID2);
      // This should fail due to a conflict
      assert.exception(errors.MergeConflict, function() {
        this.chronicle.merge(this.ID5_1, "manual", {sequence: [this.ID2, this.ID5_1]});
      }, this);

      // This should be ok
      this.M1 = this.chronicle.merge(this.ID5_2, "manual", {sequence: [this.ID2, this.ID5_2]});
      this.chronicle.open(this.M1);
      assert.isEqual(TEXT_M1, this.document.getText());
    },

  ];

};

TestDocument = function(chronicle) {
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

registerTest(['Chronicle', 'Text Operation'], new ChronicledTextTest());

})(this);
