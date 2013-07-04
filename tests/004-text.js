(function(root) {

var assert = root.Substance.assert;
var Chronicle = root.Substance.Chronicle;
var TextOperation = Chronicle.ot.TextOperation;

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

function testTransform(a, b, input, expected) {

  var t = TextOperation.transform(a, b);

  var s = t[1].apply(a.apply(input));
  assert.isEqual(expected, s);

  s = t[0].apply(b.apply(input));
  assert.isEqual(expected, s);

}

var TextOperationTest = function() {

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

    "Transformation: a=Insert, b=Insert, a before b", function() {

      var input = "Lorem ipsum";
      var expected = "Lorem bla ipsum blupp";
      var a = TextOperation.Insert(6, "bla ");
      var b = TextOperation.Insert(11, " blupp");

      // transformation should be symmetric in this case
      testTransform(a, b, input, expected);
      testTransform(b, a, input, expected);
    },

    "Transformation: a=Insert, b=Insert, same position", function() {
      // a before b
      var input = "Lorem ipsum";
      var expected = "Lorem bla blupp ipsum";
      var expected_2 = "Lorem blupp bla ipsum";
      var a = TextOperation.Insert(6, "bla ");
      var b = TextOperation.Insert(6, "blupp ");

      testTransform(a, b, input, expected);
      testTransform(b, a, input, expected_2);
    },

    "Transformation: a=Delete, b=Delete, a before b, no overlap", function() {

      var input = "Lorem ipsum dolor sit amet";
      var expected = "Lorem dolor amet";
      var a = TextOperation.Delete(6, "ipsum ");
      var b = TextOperation.Delete(18, "sit ");

      testTransform(a, b, input, expected);
      testTransform(b, a, input, expected);
    },

    "Transformation: a=Delete, b=Delete, with overlap", function() {

      var input = "Lorem ipsum dolor sit amet";
      var expected = "Lorem amet";
      var a = TextOperation.Delete(6, "ipsum dolor sit ");
      var b = TextOperation.Delete(12, "dolor ");

      testTransform(a, b, input, expected);
      testTransform(b, a, input, expected);
    },

    "Transformation: a=Delete, b=Delete, same position", function() {

      var input = "Lorem ipsum dolor sit amet";
      var expected = "Lorem amet";
      var a = TextOperation.Delete(6, "ipsum dolor ");
      var b = TextOperation.Delete(6, "ipsum dolor sit ");

      testTransform(a, b, input, expected);
      testTransform(b, a, input, expected);

    },

    "Transformation: a=Insert, b=Delete, a before b", function() {

      var input = "Lorem dolor sit amet";
      var expected = "Lorem ipsum dolor amet";
      var a = TextOperation.Insert(6, "ipsum ");
      var b = TextOperation.Delete(12, "sit ");

      testTransform(a, b, input, expected);
      testTransform(b, a, input, expected);

    },

    "Transformation: a=Insert, b=Delete, overlap", function() {

      var input = "Lorem dolor sit amet";
      var expected = "Lorem amet";
      var a = TextOperation.Insert(12, "ipsum ");
      var b = TextOperation.Delete(6, "dolor sit ");

      testTransform(a, b, input, expected);
      testTransform(b, a, input, expected);
    },

    "Merge (simple)", function() {
      this.chronicle.open(this.ID2);
      // This should fail due to a conflict
      assert.exception(Chronicle.MergeConflict, function() {
        this.chronicle.merge(this.ID5_1, "manual", {sequence: [this.ID2, this.ID5_1]});
      }, this);

      // This should be ok
      this.M1 = this.chronicle.merge(this.ID5_2, "manual", {sequence: [this.ID2, this.ID5_2]});
      this.chronicle.open(this.M1);
      assert.isEqual(TEXT_M1, this.document.getText());
    },

    "Compound: 'bla' - 'blapp' | 'blupp'", function() {
      var input = "bla";
      var expected1 = "blappupp";
      var expected2 = "bluppapp";
      var a = TextOperation.fromOT("bla", [2, -1, "app"]);
      var b = TextOperation.fromOT("bla", [2, -1, "upp"]);

      testTransform(a, b, input, expected1);
      testTransform(b, a, input, expected2);
    },

  ];

};

TextOperationTest.__prototype__ = function() {

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

};
TextOperationTest.prototype = new TextOperationTest.__prototype__();

// ROOT - 1 - 2 - 3 - 4
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

root.Substance.registerTest(['Chronicle', 'Text Operation'], new TextOperationTest());

})(this);
