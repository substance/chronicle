(function(root) {

var assert = root.Substance.assert;
var util = root.Substance.util;
var errors = root.Substance.errors;
var Chronicle = root.Substance.Chronicle;
var ObjectOperation = Chronicle.ot.ObjectOperation;
var TextOperation = Chronicle.ot.TextOperation;
var ArrayOperation = Chronicle.ot.ArrayOperation;

function testTransform(a, b, input, expected) {
  var t = ObjectOperation.transform(a, b);

  var output = ObjectOperation.apply(t[1], ObjectOperation.apply(a, util.clone(input)));
  assert.isObjectEqual(expected, output);

  output = ObjectOperation.apply(t[0], ObjectOperation.apply(b, util.clone(input)));
  assert.isObjectEqual(expected, output);
}

var ObjectOperationTest = function() {

  this.actions = [

    "Apply: create", function() {
      var path = ["a"];
      var val = "bla";
      var expected = {a: "bla"};
      var op = ObjectOperation.Create(path, val);

      var obj = {};
      op.apply(obj);

      assert.isObjectEqual(expected, obj);
    },

    "Apply: create (nested)", function() {
      var path = ["a", "b"];
      var val = "bla";
      var expected = {a: { b: "bla"} };
      var op = ObjectOperation.Create(path, val);

      var obj = {"a": {}};
      op.apply(obj);

      assert.isObjectEqual(expected, obj);
    },

    "Apply: delete", function() {
      var path = ["a"];
      var val = "bla";
      var op = ObjectOperation.Delete(path, val);
      var expected = {};

      var obj = {"a": "bla"};
      op.apply(obj);

      assert.isObjectEqual(expected, obj);
    },

    "Apply: delete (nested)", function() {
      var path = ["a", "b"];
      var val = "bla";
      var op = ObjectOperation.Delete(path, val);
      var expected = { a: {} };

      var obj = { a: { b: "bla"} };
      op.apply(obj);

      assert.isObjectEqual(expected, obj);
    },

    "Apply: delete (key error)", function() {
      var path = ["a", "b"];
      var val = "bla";
      var op = ObjectOperation.Delete(path, val);

      var obj = { a: { c: "bla"} };
      assert.exception(errors.ChronicleError, function() {
        op.apply(obj);
      });
    },

    "Apply: update (text)", function() {
      var path = ["a"];
      var op = ObjectOperation.Update(path, TextOperation.fromOT("bla", [2, -1, "upp"]));
      var expected = {a: "blupp"};

      var obj = {a: "bla"};
      op.apply(obj);

      assert.isObjectEqual(expected, obj);
    },

    "Apply: update (array)", function() {
      var path = ["a"];
      var val = [1,2,3,4,5];
      var op = ObjectOperation.Update(path, ArrayOperation.Sequence([2, ['-', 3], 2, ['+', 6]]));
      var expected = {a: [1,2,4,5,6]};

      var obj = {a: val.slice(0)};
      op.apply(obj);

      assert.isObjectEqual(expected, obj);
    },

    // Conflict cases
    "Transformation: create/create (conflict)", function() {
      var path = ["a"];
      var val1 = "bla";
      var val2 = "blupp";

      var a = ObjectOperation.Create(path, val1);
      var b = ObjectOperation.Create(path, val2);

      assert.isTrue(ObjectOperation.hasConflict(a, b));

      assert.exception(errors.ChronicleError, function() {
        ObjectOperation.transform(a, b);
      });
    },

    "Transformation: delete/delete (conflict)", function() {
      var path = ["a"];
      var val = "bla";
      var input = {"a": val};
      var expected = {};

      var a = ObjectOperation.Delete(path, val);
      var b = ObjectOperation.Delete(path, val);

      assert.isTrue(ObjectOperation.hasConflict(a, b));

      testTransform(a, b, input, expected);
      testTransform(b, a, input, expected);
    },

    "Transformation: delete/create (conflict)", function() {
      var path = ["a"];
      var a = ObjectOperation.Delete(path, "bla");
      var b = ObjectOperation.Create(path, "blupp");
      var expected1 = {a: "blupp"};
      var expected2 = {};
      var obj, t;

      assert.isTrue(ObjectOperation.hasConflict(a, b));

      // Note: this is a ill-posed case, as create will fail when the value already exists.

      t = ObjectOperation.transform(a, b);
      obj = t[1].apply(a.apply({a: "bla"}));
      assert.isObjectEqual(expected1, obj);
      obj = t[0].apply(b.apply({}));
      assert.isObjectEqual(expected1, obj);

      t = ObjectOperation.transform(b, a);
      obj = t[1].apply(b.apply({}));
      assert.isObjectEqual(expected2, obj);
      obj = t[0].apply(a.apply({a: "bla"}));
      assert.isObjectEqual(expected2, obj);

    },

    "Transformation: delete/update (conflict)", function() {
      var path = ["a"];
      var a = ObjectOperation.Delete(path, "bla");
      var b = ObjectOperation.Update(path, TextOperation.fromOT("bla", [2, -1, "upp"]));

      var input = {a : "bla"};
      var expected1 = {a: "blupp"};
      var expected2 = {};

      assert.isTrue(ObjectOperation.hasConflict(a, b));

      testTransform(a, b, input, expected1);
      testTransform(b, a, input, expected2);
    },

    "Transformation: create/update (conflict)", function() {
      var path = ["a"];
      var a = ObjectOperation.Create(path, "bla");
      var b = ObjectOperation.Update(path, TextOperation.fromOT("foo", [-3, "bar"]));

      assert.isTrue(ObjectOperation.hasConflict(a, b));
      assert.exception(errors.ChronicleError, function() {
        ObjectOperation.transform(a, b);
      });
    },

    "Transformation: update/update (conflict)", function() {
      var path = ["a"];
      var a = ObjectOperation.Update(path, TextOperation.fromOT("bla", [2, -1, "app"]));
      var b = ObjectOperation.Update(path, TextOperation.fromOT("bla", [2, -1, "upp"]));

      var input = {a : "bla"};
      var expected1 = {a: "blappupp"};
      var expected2 = {a: "bluppapp"};

      assert.isTrue(ObjectOperation.hasConflict(a, b));

      testTransform(a, b, input, expected1);
      testTransform(b, a, input, expected2);
    },

    "Transformation: delete/set (conflict)", function() {
      var path = ["a"];
      var a = ObjectOperation.Delete(path, "bla");
      var b = ObjectOperation.Set(path, "bla", "blupp");

      var input = {a : "bla"};
      var expected1 = {a: "blupp"};
      var expected2 = {};

      assert.isTrue(ObjectOperation.hasConflict(a, b));

      testTransform(a, b, input, expected1);
      testTransform(b, a, input, expected2);
    },

    "Transformation: create/set (conflict)", function() {
      var path = ["a"];
      var a = ObjectOperation.Create(path, "foo");
      var b = ObjectOperation.Set(path, "bla", "blupp");

      var expected1 = {a: "blupp"};
      var expected2 = {a: "foo"};

      assert.isTrue(ObjectOperation.hasConflict(a, b));

      var t = ObjectOperation.transform(a, b);
      var obj = t[1].apply(a.apply({}));
      assert.isObjectEqual(expected1, obj);
      obj = t[0].apply(b.apply({a: "bla"}));
      assert.isObjectEqual(expected1, obj);

      t = ObjectOperation.transform(b, a);
      obj = t[1].apply(b.apply({a: "bla"}));
      assert.isObjectEqual(expected2, obj);
      obj = t[0].apply(a.apply({}));
      assert.isObjectEqual(expected2, obj);
    },

    "Transformation: update/set (conflict)", function() {
      var path = ["a"];
      var a = ObjectOperation.Update(path, TextOperation.fromOT("bla", [2, -1, "upp"]));
      var b = ObjectOperation.Set(path, "bla", "blupp");

      assert.isTrue(ObjectOperation.hasConflict(a, b));

      assert.exception(errors.ChronicleError, function() {
        ObjectOperation.transform(a,b);
      });
    },

    "Transformation: set/set (conflict)", function() {
      var path = ["a"];
      var a = ObjectOperation.Set(path, "bla", "blapp");
      var b = ObjectOperation.Set(path, "bla", "blupp");

      var input = {a : "bla"};
      var expected1 = {a: "blupp"};
      var expected2 = {a: "blapp"};

      assert.isTrue(ObjectOperation.hasConflict(a, b));

      testTransform(a, b, input, expected1);
      testTransform(b, a, input, expected2);
    },

  ];

};

ObjectOperationTest.__prototype__ = function() {

  var ID_IDX = 1;

  this.uuid = function() {
    return ""+ID_IDX++;
  };

  this.setup = function() {
    this.chronicle = Chronicle.create({mode: Chronicle.HYSTERICAL});
    this.index = this.chronicle.index;

    ID_IDX = 1;
    this.chronicle.uuid = this.uuid;

    this.obj = {};
    this.fixture();
  };

  this.fixture = function() {
  };

};
ObjectOperationTest.prototype = new ObjectOperationTest.__prototype__();


root.Substance.registerTest(['Chronicle', 'Object Operation'], new ObjectOperationTest());

})(this);
