/*global describe, it, require*/

// Runs in NodeJS or browser, as long as we're in ES6. Otherwise, could just use Date.
import { performance } from '../../utilities/performance.mjs';
import { delay } from '../../utilities/delay.mjs';

import { Rule } from '../index.mjs';

describe('A Rule', function () {
  describe('example', function () {
    it('works with instances', function () {
      var box = {};
      Rule.attach(box, 'width');
      Rule.attach(box, 'length');
      box.length = 5;
      expect(box.length).toBe(5);
      box.width = 7;
      Rule.attach(box, 'area', function (self) { return self.width * self.length; });
      expect(box.area).toBe(35);
      expect(box.area).toBe(35);
      Rule.attach(box, 'height');
      box.height = 2
      Rule.attach(box, 'volume', function (self) { return self.area * self.height; });
      expect(box.volume).toBe(70);
      box.length = 6;
      expect(box.area).toBe(42);
      expect(box.volume).toBe(84);
      // Test requires mechanism.
      box.area = 1000;
      box.width = 8;
      expect(box.area).toBe(1000); // still, not reset
      expect(box.volume).toBe(2000);
    });
    it('works with classes', function () {
      class Rectangle {}
      Rule.attach(Rectangle.prototype, 'width');
      Rule.attach(Rectangle.prototype, 'length');
      Rule.attach(Rectangle.prototype, 'area', function (self) { return self.width * self.length; });
      class Box extends Rectangle { }
      Rule.attach(Box.prototype, 'height');
      Rule.attach(Box.prototype, 'volume', function (self) { return self.area * self.height; });
      var box = new Box();
      box.length = 5;
      expect(box.length).toBe(5);
      box.width = 7;
      expect(box.area).toBe(35);
      expect(box.area).toBe(35);
      box.height = 2;
      expect(box.volume).toBe(70);
      box.length = 6;
      expect(box.area).toBe(42);
      expect(box.volume).toBe(84);
      box.area = 1000;
      box.width = 8;
      expect(box.area).toBe(1000); // still, not reset
      expect(box.volume).toBe(2000);
    });
    it('converts classes defined conventionally', function () {
      class Rectangle {
        get width() { return 0; }
        get length() { return 0; }
        get area() { return this.width * this.length; }
      }
      class Box extends Rectangle {
        get volume() { return this.area * this.height; }
      }
      Rule.rulify(Rectangle.prototype);
      Rule.rulify(Box.prototype);
      var box = new Box();
      box.length = 5;
      expect(box.length).toBe(5);
      box.width = 7;
      expect(box.area).toBe(35);
      expect(box.area).toBe(35);
      box.height = 2;
      expect(box.volume).toBe(70);
      box.length = 6;
      expect(box.area).toBe(42);
      expect(box.volume).toBe(84);
      box.area = 1000;
      box.width = 8;
      expect(box.area).toBe(1000); // still, not reset
      expect(box.volume).toBe(2000);
    });
    it('delays calculation and storage of state until used, allowing use on class prototype', function () {
      class MyClass {}
      Rule.attach(MyClass.prototype, 'myRule', () => 17);
      var instance1 = new MyClass();
      expect(instance1.myRule).toBe(17);
      instance1.myRule = 42;
      var instance2 = new MyClass();
      expect(instance2.myRule).toBe(17);
      expect(instance1.myRule).toBe(42);
    });
    it('subclass computation can reference superclass.', function () {
      class Super {
        get root() { return 3; }
        get foo() { return this.root; }
        get bar() { return this.foo + 1; }
        get baz() { return 10; }
      }
      class Sub extends Super {
        get root() { return 2; }
        get foo() {
          return super.__foo() * 10;
        }
        // No baz defined.
      }
      class SubSub extends Sub {
        get baz() { return super.__baz() * 2; }
      }
      Rule.rulify(Super.prototype);
      Rule.rulify(Sub.prototype);
      Rule.rulify(SubSub.prototype);
      let sup = new Super();
      let sub = new Sub();
      let subsub = new SubSub();

      expect(sup.root).toBe(3);
      expect(sub.root).toBe(2);
      expect(subsub.root).toBe(2);

      expect(sup.baz).toBe(10);
      expect(sub.baz).toBe(10);
      expect(subsub.baz).toBe(20);

      expect(sup.foo).toBe(3);
      expect(sub.foo).toBe(20);
      expect(subsub.foo).toBe(20);

      expect(sup.bar).toBe(4);
      expect(sub.bar).toBe(21);
      expect(subsub.bar).toBe(21);
    });
  });
  describe('method', function () {
    function calculator(self) { self.callCount++; return 1 + 2;}
    function calculatorOnProperty(self) { return self.ordinaryProperty + 2; }
    function calculatorOnRule(self) { return self.ordinaryProperty + self.calculator; }
    function conditionalCalculator(self) { self.callCount++; return (self.calculator < 10) ? self.calculator : self.calculatorOnRule }
    function testAnInstance(attachee, anInstance, label) {
      describe(label, () => {
        Rule.attach(attachee, 'calculator', calculator);
        Rule.attach(attachee, 'calculatorOnProperty', calculatorOnProperty);
        Rule.attach(attachee, 'calculatorOnRule', calculatorOnRule);
        Rule.attach(attachee, 'conditionalCalculator', conditionalCalculator);
        Rule.attach(attachee, 'aCircular', (self) => self.bCircular);
        Rule.attach(attachee, 'bCircular', (self) => self.cCircular);
        Rule.attach(attachee, 'cCircular', (self) => self.aCircular);
        Rule.attach(attachee, 'returnsNothing', () => { anInstance.callCount++; });
        beforeEach(() => {
          anInstance.ordinaryProperty = 2;
          anInstance.calculator = undefined;
          anInstance.calculatorOnRule = undefined
        });
        
        it('does calculation', function () {
          expect(anInstance.calculator).toBe(3);
        });
        it('can reference ordinary properties on the instance to which it is attached', function () {
          expect(anInstance.calculatorOnProperty).toBe(4);
        });
        it('can reference other rules', function () {
          expect(anInstance.calculatorOnRule).toBe(5);
        });
        it('is cached so that it is only computed once per instance', function () {
          anInstance.callCount = 0;
          
          expect(anInstance.calculator).toBe(3);
          expect(anInstance.callCount).toBe(1);
          
          expect(anInstance.calculator).toBe(3);
          expect(anInstance.callCount).toBe(1);

          anInstance.calculator = undefined;
          expect(anInstance.calculator).toBe(3);
          expect(anInstance.callCount).toBe(2);
        });
        it('does not recognize changes to ordinary properties', function () {
          expect(anInstance.calculatorOnProperty).toBe(4);
          anInstance.ordinaryProperty = 3;
          expect(anInstance.calculatorOnProperty).toBe(4); // not 5
        });
        it('does recognize changes to other rules that it references', function () {
          expect(anInstance.calculator).toBe(3);
          expect(anInstance.calculatorOnRule).toBe(5);
          anInstance.calculator = 30;
          expect(anInstance.calculatorOnRule).toBe(32);
        });
        it('stops recognizing changes to other rules that references if referencing rule is bypassed by setting a value directly', function () {
          expect(anInstance.calculator).toBe(3);
          expect(anInstance.calculatorOnRule).toBe(5);
          anInstance.calculatorOnRule = 6;
          expect(anInstance.calculatorOnRule).toBe(6);
          anInstance.calculator = 30; // compare above
          expect(anInstance.calculatorOnRule).toBe(6);
          anInstance.calculatorOnRule = undefined; // reset the rule
          expect(anInstance.calculatorOnRule).toBe(32); // as above
        });
        it('recognizes circularity', function () {
          expect(() => anInstance.aCircular).toThrowError();
          expect(() => anInstance.bCircular).toThrowError();
          expect(() => anInstance.cCircular).toThrowError();
        });
      });
    }
    var anInstance = {};
    testAnInstance(anInstance, anInstance, 'on an object');

    class Something {}
    testAnInstance(Something.prototype, new Something(), 'on a class instance');
  });
  describe('tracking dependencies', function () {
    function aPlus1(self) { return self.a + 1; }
    function bPlus1(self) { return self.b + 1; }
    function requiredPlus1(self) { return self.required + 1; }
    function requiredPlus2(self) { return self.required + 2; }
    function dependant1Plus10(self) { return self.dependant1 + 10; }
    function dependant1Plus20(self) { return self.dependant1 + 20; }
    function testAnInstance(that) {
      it('will recompute the last of a chain of three when the middle is reset, and then not again when the first is later reset', function () {
        that.a = 1;
        expect(that.c).toBe(3);
        that.b = 10;
        expect(that.a).toBe(1);
        expect(that.c).toBe(11);
        that.a = 20;
        expect(that.c).toBe(11);
      });
      it('will fan out to all dependendents when changed', function () {
        expect(that.dependant2).toBe(7);
        expect(that.dependant1a).toBe(16);
        expect(that.dependant1b).toBe(26);
        that.required = 3;
        expect(that.dependant1a).toBe(14);
        expect(that.dependant1b).toBe(24);
        expect(that.dependant2).toBe(5);
      });
    }
    it('can be defined to eagerly re-evaluate', function (done) {
      class Eager {
        get referenced() {
	  return 1;
	}
        get eager() {
          this.constructor.count++;
          return this.referenced;
        }
      }
      Eager.count = 0; // Safari doesn't allow static class vars.
      Rule.rulify(Eager.prototype, {eagerNames: ['eager']});
      let eager = new Eager;
      expect(Eager.count).toBe(0); // eager has not been referenced yet.
      expect(eager.eager).toBe(1); // demand eager
      expect(Eager.count).toBe(1);
      eager.referenced = 2;        // referenced value is changed, which causes eager to be re-demanded
      setTimeout(() => { // It doesn't re-evaluate right away, but after a tick.
        expect(Eager.count).toBe(2); // without referencing eager again, yet eager evaluates again
        expect(eager.eager).toBe(2);
	eager.eager = undefined; // reset eager, which does NOT cause it to be re-demanded
	setTimeout(() => {
	  expect(Eager.count).toBe(2); // still
	  expect(eager.eager).toBe(2); // now explicitly re-demand it
	  expect(Eager.count).toBe(3); // which caused it to be re-evaluated
          done();
	});
      });
    });
    describe('on instance', function () {
      var that = {};
      Rule.attach(that, 'a');
      Rule.attach(that, 'b', aPlus1);
      Rule.attach(that, 'c', bPlus1);
      Rule.attach(that, 'required');
      that.required = 5;
      Rule.attach(that, 'dependant1', requiredPlus1);
      Rule.attach(that, 'dependant2', requiredPlus2);
      Rule.attach(that, 'dependant1a', dependant1Plus10);
      Rule.attach(that, 'dependant1b', dependant1Plus20);
      testAnInstance(that);
    });
    describe('on class instance', function () {
      class Something2 {}
      Rule.attach(Something2.prototype, 'a');
      Rule.attach(Something2.prototype, 'b', aPlus1);
      Rule.attach(Something2.prototype, 'c', bPlus1);
      Rule.attach(Something2.prototype, 'required', undefined);
      Rule.attach(Something2.prototype, 'dependant1', requiredPlus1);
      Rule.attach(Something2.prototype, 'dependant2', requiredPlus2);
      Rule.attach(Something2.prototype, 'dependant1a', dependant1Plus10);
      Rule.attach(Something2.prototype, 'dependant1b', dependant1Plus20);
      var that = new Something2();
      that.required = 5;
      testAnInstance(that);
    });
    describe('overrides rules from later on inheritance chain', function () {
      class OverrideExample {
        get theRule() { return 'compiled in'; }
        get dependant() { return 'got ' + this.theRule; }
      }
      class Relabled extends OverrideExample {
        get theRule() { return 'compiled override'; }
      }
      Rule.rulify(OverrideExample.prototype);
      Rule.rulify(Relabled.prototype);
      var example, other;
      beforeEach(() => {
        example = new OverrideExample();
        other = new Relabled();
      });
      it('follows compiled-in rule', function () {
        expect(example.theRule).toBe('compiled in');
        expect(example.dependant).toBe('got compiled in');
        example.theRule = 'changed';
        expect(example.dependant).toBe('got changed');
        expect(other.dependant).toBe('got compiled override');
      });
      it('follow attached override', function () {
        Rule.attach(example, 'theRule', () => other.dependant);
        expect(example.theRule).toBe('got compiled override');
        expect(example.dependant).toBe('got got compiled override');

        other.theRule = 'changed';
        expect(example.dependant).toBe('got got changed');

        example.theRule = 'instance value changed';
        expect(example.dependant).toBe('got instance value changed');

        other.theRule = 'upstream changed';
        expect(example.dependant).toBe('got instance value changed'); // change to upstream doesn't matter

        example.theRule = undefined; // reset
        expect(example.dependant).toBe('got got upstream changed'); // now it does
      });
    });
    describe('with asynchronicity', function () {
      it('of parallel promises', async function () {
        class All {
          get aVal() { return 'a'; }
          get bVal() { return 'b'; }
          get cVal() { return 'c'; }
          get a() { return Promise.resolve(this.aVal); }
          get b() { return Promise.resolve(this.bVal); }
          get c() { return this.cVal; }
          get refA() { return this.a; }
          get refB() { return this.b; }
          get refC() { return this.c; }
          //all() { return [this.refA, this.refB, this.refC]; }
          // The above works fine, and it is completely unnecessary to use Promise.all
          // as in the following line. But IWBNI it worked anyway. 
          get all() { return Promise.all([this.refA, this.refB, this.refC]); }
          get ref() { return this.all; }
        }
        Rule.rulify(All.prototype);
        let all = new All(),
            referenced = await all.ref;
        expect(referenced).toEqual(['a', 'b', 'c']);
        all.aVal = "a'";
        all.bVal = "b'";
        all.cVal = "c'";
        referenced = await all.ref;
        expect(referenced).toEqual(["a'", "b'", "c'"]);
      });
      it('does not track dependencies in callbacks', (done) => {
        function fetchFromDatabase(key, cb) {
          setTimeout(() => cb(null, key + 2), 10);
        }
	class Callbacks {
          a() { return 1; }
          b() { return 2; }
	  // In much of the following, we use callbacks in typical old-school NodeJS style, defined with function (...) { },
	  // rather than fat arrow. That means that we can't use 'this' to refer to the instance.
	  // That's fine, we can use the convenience argument 'self'. HOWEVER, getters cannot take arguments,
	  // so we cannot decoarate these methods with 'get'. That's also fine, as Rule.rulify will automatically
	  // rulify all the methods (except the constructor) IFF there are not getters in the class definition.
          noPromise(self) {
            var a = self.a;
            var container = [];
            fetchFromDatabase(a, function (error, dbValue) {
              if (error) throw error;
              container[0] = dbValue + a + self.b;
            });
            return container;
          }
          wrongResult(self) {
            return self.noPromise[0] || 'none';
          }
          promiseButStillWrong(self) {
            var a = self.a;
            return new Promise(function (resolve, reject) {
              fetchFromDatabase(a, function (error, dbValue) {
                if (error) reject(error);
                resolve(dbValue + a + self.b);
              });
            });
          }
          onlyTracksSome(self) { return self.promiseButStillWrong; }
          dbValue(self) {
            return new Promise(function (resolve, reject) {
              fetchFromDatabase(self.a, function (error, dbValue) {
                if (error) reject(error);
                resolve(dbValue);
              });
            });
          }
          computationOnDbValue(self) {
            return self.dbValue + self.a + self.b;
          }
        }
        Rule.rulify(Callbacks.prototype);
        var that = new Callbacks();
        expect(that.wrongResult).toBe('none');
        Promise.all([that.onlyTracksSome, that.computationOnDbValue]).then(() => {
          expect(that.onlyTracksSome).toBe(6);
          expect(that.computationOnDbValue).toBe(6);
          that.a = 0;
          Promise.all([that.onlyTracksSome, that.computationOnDbValue]).then(() => {
            expect(that.onlyTracksSome).toBe(4);
            expect(that.computationOnDbValue).toBe(4);
            that.b = 0;
            Promise.all([that.onlyTracksSome, that.computationOnDbValue]).then(() => {
              expect(that.onlyTracksSome).toBe(4); // Wrong answer!
              expect(that.computationOnDbValue).toBe(2);
              done();
            });
          });
        });
      });
      it('does not track dependencies after a suspension, but you can always arrange to not have dependiencies there.', async function () {
        class Async3Kinds {
          valueOnWhichEverythingDepends() {
            return 17;
          }
          keyToSomething() {
            return 0;
          }
          straightforwardDependency() {
            return this.keyToSomething + this.valueOnWhichEverythingDepends;
          }
          correctInitialAnswerButDoesNotTrackDependency() {
            return Promise.resolve(this.keyToSomething)
              .then(resolved => resolved + this.valueOnWhichEverythingDepends);
          }
	  // A rule can be marked async and references will resolve when the value resolves.
	  // Since an async method cannot ordinarily be a getter, we cannot decorate this method with 'get'.
	  // Rule.rulify() will rulify all the 'get' methods, if any, and otherwise rulify all methods except the constructor.
	  // So we have two choices: either explicitly list the rules we want to rulify, or don't use 'get' in this class definition.
          async alsoCorrectInitialAnswerButDoesNotTrackDependency() {
            const someMeasurement = await Promise.resolve(this.keyToSomething);
            return someMeasurement + this.valueOnWhichEverythingDepends;
          }
          // Here's how to do it right:
          standalonePromise() { // Rules can have promise initial values -- just don't put any dependencies in the "second half".
            return Promise.resolve(this.keyToSomething);
          }
          simpleReferenceToStandalonePromise() {
            return this.standalonePromise + this.valueOnWhichEverythingDepends;
          }
        }
        Rule.rulify(Async3Kinds.prototype);
        let instance = new Async3Kinds(),
            initialAnswer = 17;

        // These are all correct.
        expect(instance.valueOnWhichEverythingDepends).toBe(initialAnswer);
        expect(await instance.valueOnWhichEverythingDepends).toBe(initialAnswer);        
        expect(await instance.straightforwardDependency).toBe(initialAnswer);
        expect(await instance.correctInitialAnswerButDoesNotTrackDependency).toBe(initialAnswer);
        expect(await instance.alsoCorrectInitialAnswerButDoesNotTrackDependency).toBe(initialAnswer);
        expect(await instance.simpleReferenceToStandalonePromise).toBe(initialAnswer);

        // Now we change the value on which everything depends, and let's see what recalculates.
        instance.valueOnWhichEverythingDepends = 42;
        expect(await instance.straightforwardDependency).toBe(42); // correct
        expect(await instance.correctInitialAnswerButDoesNotTrackDependency).toBe(initialAnswer); // Did not track dependency
        expect(await instance.alsoCorrectInitialAnswerButDoesNotTrackDependency).toBe(initialAnswer); // Nor here either;
        expect(await instance.simpleReferenceToStandalonePromise).toBe(42);        

        // The dependency before the suspension of execution IS correctly tracked.
        instance.keyToSomething = 1;
        expect(await instance.straightforwardDependency).toBe(43); // correct
        expect(await instance.correctInitialAnswerButDoesNotTrackDependency).toBe(43);
        expect(await instance.alsoCorrectInitialAnswerButDoesNotTrackDependency).toBe(43);
        expect(await instance.simpleReferenceToStandalonePromise).toBe(43);
      });
    });
  });
  describe('timing', function () {
    beforeEach(async function () {
      await delay(2e3); // Allow garbage collection, because, e.g., Firefox.
    });
    class TimingExample {
      someValue() {
        return Math.sqrt(Math.sqrt(Math.sqrt(100)));
      }
    }
    class UnrulifiedExample extends TimingExample {}
    class RulifiedExample extends TimingExample {}
    Rule.rulify(RulifiedExample.prototype, {ruleNames: ['someValue']});
    function compare(prep, logLabel, typicalFactor, maximumFactor) {
      let cycles = 1000 * 1000,
          methods = Array.from({length: cycles}, () => new UnrulifiedExample()),
          rules = Array.from({length: cycles}, () => new RulifiedExample());
      prep(methods, rules);
      let start = performance.now(),
          methodSum = methods.reduce((sum, instance) => sum + instance.someValue(), 0),
          mid = performance.now(),
          ruleSum = rules.reduce((sum, instance) => sum + instance.someValue, 0),
          end = performance.now(),
          method = mid - start,
          rule = end - mid,
          factor = rule / method,
          warn = factor > typicalFactor,
          error = factor > maximumFactor,
          logger = error ? console.error : (warn ? console.warn : console.info);
      logger(logLabel, {factor, method, rule});
      expect(factor).toBeLessThan(maximumFactor);
      expect(methodSum).toBe(ruleSum);
      if (warn && !error) pending(`${factor.toPrecision(2)}x`);
    }
    it('referencing a computed method (with tracking) is never > 60x method and test will skip/warn if > 5x (see console)', function () {
      function evaluate(methods, rules) {
        methods.forEach(element => element.someValue());
        rules.forEach(element => element.someValue);
      }
      // Factors on Intel Mac June '22:
      //   Chrome:  2
      //   Edge:    3
      //   Safari: 18
      //   Firefox:20
      // Initial version was 12 => 25. Second was 4-5 on Chrome.
      compare(evaluate, 'subsequentRuleMs', 5, 60);
    });
    it('first computation after reset is never > 120x method and test will skip/warn if > 25x (see console).', function () {
      // Factors on Intel Mac June '22:
      //   Chrome:  23 - Why is Chrome and Edge SLOWER after a reset? Breaks some optimization? Does that mean test is invalid?
      //   Edge:    32
      //   Safari:  23
      //   Firefox: 18
      function evaluateAndReset(methods, rules) {
        methods.forEach(element => element.someValue());
        rules.forEach(element => element.someValue);   // Instantiate the rule...
        rules.forEach(element => element.someValue = undefined); // ... but then reset it so that it needs to compute.
      }
      compare(evaluateAndReset, 'initialExecutionAfterResetMs', 25, 120);
    });
    it('of lazy creation of rule and tracked computation is never > 110x method and test will skip/warn if > 55x (see console).', async function () {
      // Factors on Intel Mac June '22:
      //   Chrome:  15
      //   Edge:    20
      //   Safari:  38
      //   Firefox: 85
      function justTouch(methods, rules) { // Does not demand rule, so these instances do not have the rule instantiated yet.
        methods.forEach(element => element);
        rules.forEach(element => element);
      }
      compare(justTouch, 'initialLazyRuleInvocationMs', 55, 110);
    });
  });
  describe('using this and self', function () {
    it('has the same for both by default, with choice being a matter of style', function () {
      var that = {};
      Rule.attach(that, 'functionThis', function () {
        return this;
      });
      Rule.attach(that, 'functionSelf', function (self) {
        return self;
      });
      expect(that.functionThis).toEqual(that);
      expect(that.functionSelf).toEqual(that);
    });
    it('still has this not defined within arrow functions, as in all javascript', function () {
      var that = {};
      Rule.attach(that, 'arrowThis', () => {
        return this;
      });
      Rule.attach(that, 'arrowSelf', (self) => {
        return self;
      });
      expect(that.arrowThis).not.toEqual(that);
      expect(that.arrowSelf).toEqual(that);
    });
  });
  describe('only tracks Rules:', function () {
    it("does not track a ref'd var", () => {
      var a = 1, b = 2
      var pojo = {};
      Rule.attach(pojo, 'sum', () => a + b);
      expect(pojo.sum).toEqual(3);
      a = 2; // Not a Rule. Change not tracked.
      expect(pojo.sum).not.toEqual(4);
    });
    it("does not track a ref'd property", () => {
      var pojo = {a: 1, b: 2};
      Rule.attach(pojo, 'sum', self => self.a + self.b);
      expect(pojo.sum).toEqual(3);
      pojo.a = 2; // Not a Rule. Change not tracked.
      expect(pojo.sum).not.toEqual(4);
    });
    it("does not track a ref'd array cell", () => {
      var list = [1, 2],
          other = {}; // so as not to mess up list.length
      Rule.attach(other, 'sum', () => list.reduce((a, e) => a + e));
      expect(other.sum).toEqual(3);
      list[0] = 2; // Not a Rule. Change not tracked.
      expect(other.sum).not.toEqual(4);
    });
    it("tracks a ref'd rule", () => {
      var pojo = {a: 1, b: 2},
          other = {};
      Rule.rulify(pojo);
      Rule.attach(pojo, 'sum', self => self.a + self.b);
      expect(pojo.sum).toEqual(3);
      pojo.a = 2;
      expect(pojo.sum).toEqual(4);
    });
    it("tracks a rulified ref'd array cell", () => {
      var nakedList = [1, 2],
          list = Rule.rulify(nakedList),
          other = {};
      Rule.attach(other, 'sum', () => list.reduce((a, e) => a + e));
      expect(other.sum).toBe(3);

      list[0] = 2; // change of list resets sum
      expect(other.sum).toBe(4);

      list.push(3); // change of list resets sum
      expect(other.sum).toBe(7);

      list.pop();
      expect(other.sum).toBe(4);

      list.splice(1, 1);
      expect(other.sum).toBe(2);

      nakedList.push(1); // change of the original list does not reset sum!
      expect(other.sum).toBe(2); // not 3, because 2 is still cached
      // After this, it is not specified whether a change of list picks up changes to original list.
    });
    it("supports a recursive idiom", () => {
      var component = Rule.rulify({
        list: Rule.rulify([1, 2]),  // If you want the list (or an object) to be be rulified, you need to do it yourself.
        sum: self => self.list.reduce((a, e) => a + e),
        plus1: self => self.list.map(e => e + 1)
      });
      expect(component.sum).toEqual(3);
      expect(component.plus1[0]).toEqual(2);
      component.list[0] = 2;
      expect(component.sum).toEqual(4);
      expect(component.plus1[0]).toEqual(3);
      expect(component.plus1.length).toEqual(2);            
      component.list.push(3);
      expect(component.sum).toEqual(7);
      expect(component.plus1.length).toEqual(3);
    });
    it("tracks only what has changed in an array", () => {
      function ref(index) { counts[index]++; return component.list[index]; }
      var counts = [0, 0, 0],
          component = Rule.rulify({
            list: Rule.rulify(['a', 'b', 'c']),
            ref0: () => ref(0),
            ref1: () => ref(1),
            ref2: () => ref(2)
          });
      expect(component.ref0).toBe('a');
      expect(component.ref1).toBe('b');
      expect(component.ref2).toBe('c');
      expect(counts.every(e => e === 1)).toBeTruthy();
      component.list.splice(1, 0, 'i');
      expect(component.ref0).toBe('a');
      expect(counts[0]).toBe(1);
      expect(component.list[1]).toBe('i');
      expect(component.list[3]).toBe('c');            
      expect(component.ref1).toBe('i'); 
      expect(counts[1]).toBe(2);
      expect(component.ref2).toBe('b'); 
      expect(counts[2]).toBe(2);            
    });
  });
  describe('composite', function () {
    it('a rule can be dynamically added to an instance (e.g., for a named child or view)', function () {
      class Composite {
        get a() { return 'a'; }
        get refB() { return this.b; }
      }
      Rule.rulify(Composite.prototype);
      let composite = new Composite();
      Rule.attach(composite, 'b', function () { return this.a; }); // Naturally, we can't use a fat arrow and reference 'this'.
      expect(composite.refB).toBe('a');
    });
    // The following illustrates the differences between different plausible ways of creating
    // a rule system with parent/child relationships.
    describe('with child construction that references parent values', function () {
      // This will re-instantiate the tree structure perhaps more than is wanted.
      let computations = [];
      class Child {
        constructor(name, value1, value2) {
          computations.push(`construct ${name} ${value1} ${value2}`);
          this.name = name;
          this.input1 = value1;
          this.input2 = value2;
        }
        get computationOnValue1() {
          computations.push(`simple compute ${this.name}`);
          return this.input1 * 2;
        }
        get expensiveComputationOnValue2() {
          computations.push(`expensive compute ${this.name}`);
          return Math.sqrt(this.input2);
        }
        get total() { return this.computationOnValue1 + this.expensiveComputationOnValue2; }
      }
      class Parent {
        get parameterA() { return 1; }
        get parameterB() { return 2; }
        get parameterC() { return 9; }
        get a() { return new Child('a', this.parameterA, this.parameterC); }
        get b() { return new Child('b', this.parameterB, this.parameterC); }
        get sum() { return this.a.total + this.b.total; }
      }
      Rule.rulify(Child.prototype);
      Rule.rulify(Parent.prototype);
      let parent = new Parent();
      it('will re-instantiate children and all their otherwise unchanged computations', function () {
        expect(parent.sum).toBe(12);
        expect(computations.join('\n')).toBe(
          `construct a 1 9
simple compute a
expensive compute a
construct b 2 9
simple compute b
expensive compute b`);
        computations = [];
        parent.parameterA = 3;
        expect(parent.sum).toBe(16);
        expect(computations.join('\n')).toBe(
          `construct a 3 9
simple compute a
expensive compute a`);
      });
    });
    describe('with child construction that references parent and constant input names', function () {
      // This will not re-instantiate the tree structure.
      let computations = [];
      class Child {
        constructor(name, parent, name1, name2) {
          computations.push(`construct ${name} ${name1} ${name2}`);
          this.name = name;
          this.parent = parent;
          this.name1 = name1;
          this.name2 = name2;
        }
        get computationOnValue1() {
          computations.push(`simple compute ${this.name}`);
          return this.parent[this.name1] * 2;
        }
        get expensiveComputationOnValue2() {
          computations.push(`expensive compute ${this.name}`);
          return Math.sqrt(this.parent[this.name2]);
        }
        get total() { return this.computationOnValue1 + this.expensiveComputationOnValue2; }
      }
      class Parent {
        get parameterA() { return 1; }
        get parameterB() { return 2; }
        get parameterC() { return 9; }
        get a() { return new Child('a', this, 'parameterA', 'parameterC'); }
        get b() { return new Child('b', this, 'parameterB', 'parameterC'); }
        get sum() { return this.a.total + this.b.total; }
      }
      Rule.rulify(Child.prototype);
      Rule.rulify(Parent.prototype);
      let parent = new Parent();
      it('will not re-instantiate children nor their otherwise unchanged computations', function () {
        expect(parent.sum).toBe(12);
        expect(computations.join('\n')).toBe(
          `construct a parameterA parameterC
simple compute a
expensive compute a
construct b parameterB parameterC
simple compute b
expensive compute b`);
        computations = [];
        parent.parameterA = 3;
        expect(parent.sum).toBe(16);
        expect(computations.join('\n')).toBe(`simple compute a`); // No need to redo expensive computation
      });
    });
  });
  describe('of Rulified array', function () {
    it('updates rules when element changes.', async function () {
      let thing = {
        nakedList: function () { return [0, 1, 2]; }, // Appearing in rule does not (currently) rulfify the value.
        rulifiedList: function () { return Rule.rulify([0, 1, 2]); }, // An array must be explicitly rulified.
        refNakedElement: function (self) { return self.nakedList[1]; },
        refRulifiedElement: function (self) { return self.rulifiedList[1]; }
      };
      Rule.rulify(thing);
      expect(thing.refNakedElement).toBe(1);
      expect(thing.refRulifiedElement).toBe(1);
      thing.nakedList[1] = 11;
      thing.rulifiedList[1] = 11;
      expect(thing.refNakedElement).toBe(1); // still
      expect(thing.refRulifiedElement).toBe(11);

      thing.rulifiedList[1] = Promise.resolve(33); // Promises in elements are contagious.
      expect(await thing.refRulifiedElement).toBe(33);
    });
    it('updates rules when length changes.', function () {
      let thing = {
        nakedList: function () { return [0, 1, 2]; }, // Appearing in rule does not (currently) rulfify the value.
        rulifiedList: function () { return Rule.rulify([0, 1, 2]); }, // An array must be explicitly rulified.
        refNakedList: function (self) { return self.nakedList.reduce((sum, element) => sum + element, 0); },
        refRulifiedList: function (self) { return self.rulifiedList.reduce((sum, element) => sum + element, 0); }
      };
      Rule.rulify(thing);
      expect(thing.refNakedList).toBe(3);
      expect(thing.refRulifiedList).toBe(3);

      thing.nakedList[1] = 11;    // now [0, 11, 2]
      thing.rulifiedList[1] = 11; // ditto
      expect(thing.refNakedList).toBe(3);
      expect(thing.refRulifiedList).toBe(13);

      thing.nakedList.push(3);    // now [0, 11, 2, 3]
      thing.rulifiedList.push(3); // ditto
      expect(thing.nakedList.length).toBe(4);
      expect(thing.rulifiedList.length).toBe(4);      
      expect(thing.refNakedList).toBe(3); // Doesn't track changes to naked list.
      expect(thing.refRulifiedList).toBe(16); // Notices change and recomputes.

      thing.nakedList.length = 3;    // now [0, 11, 2]
      thing.rulifiedList.length = 3; // ditto
      expect(thing.refNakedList).toBe(3); // Doesn't track changes to naked list.
      expect(thing.refRulifiedList).toBe(13); // Notices change and recomputes.
    });
  });
  describe('with Promises', function () {
    var that = {};
    it('resolves to the actual value when the promise resolves.', (done) => {
      Rule.attach(that, 'explicitPromise', () => Promise.resolve(3));
      that.explicitPromise.then(() => {
        expect(that.explicitPromise).toBe(3);
        done();
      });
    });
    it('resolves to the actual value when the delayed promise resolves.', (done) => {
      Rule.attach(that, 'explicitDelayedPromise', () => delay(0, 3));
      that.explicitDelayedPromise.then(() => {
        expect(that.explicitDelayedPromise).toBe(3);
        done();
      });
    });
    it('is still initially a promise that then becomes the value, if the rule is an immediately resolved promise.', (done) => {
      Rule.attach(that, 'immediatePromise', () => Promise.resolve(3));
      that.immediatePromise.then(() => {
        expect(that.immediatePromise).toBe(3);
        done();
      });
    });
    it('is contagious to other rules that reference it.', (done) => {
      Rule.attach(that, 'promisedA', () => Promise.resolve(3));
      Rule.attach(that, 'referenceA', (self) => self.promisedA + 1);
      that.referenceA.then((resolved) => {
        expect(resolved).toBe(4);
        expect(that.referenceA).toBe(4);
        expect(that.referenceA).toBe(4);
        expect(that.referenceA.then).toBeUndefined();

        that.promisedA = 72;
        expect(that.referenceA).toBe(73);
        expect(that.referenceA).toBe(73);
        expect(that.referenceA.then).toBeUndefined();

        that.promisedA = undefined;
        that.referenceA.then((resolved) => {
          expect(resolved).toBe(4);
          expect(that.referenceA).toBe(4);
          expect(that.referenceA).toBe(4);                    
          done();
        });
      });
    });
    it('propogates resolutions through chains.', (done) => {
      Rule.attach(that, 'chainA', () => Promise.resolve(3));
      Rule.attach(that, 'chainB', (self) => self.chainA + 1);
      Rule.attach(that, 'chainC', (self) => self.chainB + 1);            
      that.chainC.then((resolved) => {
        expect(resolved).toBe(5);
        expect(that.chainC).toBe(5);
        done();
      });
    });                  
    it('propogates rejections through contagious chains (rather than unchained/unhandled).', (done) => {
      var that = {};
      Rule.attach(that, 'chainA', () => Promise.reject(3));
      Rule.attach(that, 'chainB', (self) => self.chainA + 1);
      Rule.attach(that, 'chainC', (self) => self.chainB + 1);
      that.chainC.catch((reason) => {
        expect(reason).toBe(3);
        done();
      });
    });
    it('properly caches rules that were resolved promises.', done => {
      var count = 0,
          data = Rule.rulify({
            delayed: () => Promise.resolve(17),
            referencing: self => { count++; return self.delayed; }
          });
      data.referencing.then(() => {
        expect(count).toBe(2);
        expect(data.referencing).toBe(17);
        expect(count).toBe(2);
        done();
      });
    });
    it('can refer to promise rule chains.', done => {
      var data = Rule.rulify({
        a: () => Promise.resolve(1),
        b: self => Promise.resolve(self.a),
        c: self => Promise.resolve(self.b),
        d: self => self.a + self.b + self.c
      });
      data.d.then(d => {
        expect(d).toBe(3);
        done();
      });
    });
    describe('can handle multiple promise references', function () {
      it('in a rule.', function (done) {
        var that = {};
        Rule.attach(that, 'a', () => Promise.resolve(1));
        Rule.attach(that, 'b', self =>
          new Promise(resolve => setTimeout(() => resolve(self.a + 1), 100)));
        Rule.attach(that, 'c', self =>
          new Promise(resolve => setTimeout(() => resolve(self.a + 2), 100)));
        Rule.attach(that, 'd', () => Promise.resolve(0));            
        Rule.attach(that, 'e');
        that.e = Promise.resolve(0); // even explicitly set, not from method
        Rule.attach(that, 'f', self => self.a + self.b + self.c + self.d + self.e);
        that.f.then((f) => {
          expect(that.a).toBe(1);
          expect(that.b).toBe(2);
          expect(that.c).toBe(3);
          expect(that.d).toBe(0);
          expect(that.e).toBe(0);                
          expect(that.f).toBe(6);
          expect(f).toBe(6);                
          done();
        });
      });
      it('in a referenced rule.', function (done) {
        // Same as above, but with f referenced by another.
        var that = {};
        Rule.attach(that, 'a', () => Promise.resolve(1));
        Rule.attach(that, 'b', self =>
          new Promise(resolve => setTimeout(() => resolve(self.a + 1), 100)));
        Rule.attach(that, 'c', self =>
          new Promise(resolve => setTimeout(() => resolve(self.a + 2), 100)));
        Rule.attach(that, 'd', () => Promise.resolve(0));            
        Rule.attach(that, 'e');
        that.e = Promise.resolve(0); // even explicitly set, not from method
        Rule.attach(that, 'f', self => self.a + self.b + self.c + self.d + self.e);
        Rule.attach(that, 'g', self => self.f);
        that.g.then((g) => {
          expect(that.a).toBe(1);
          expect(that.b).toBe(2);
          expect(that.c).toBe(3);
          expect(that.d).toBe(0);
          expect(that.e).toBe(0);                
          expect(that.f).toBe(6);
          expect(that.g).toBe(6);
          expect(g).toBe(6);        
          done();
        });
      });
      it('in a deep chain of promises, we do not re-evalate after dependencies are known.', async function () {
	let bComputed = 0,
	    cComputed = 0,
	    that = {
	      get a() { return Promise.resolve(1); },
	      get b() { let a = this.a; bComputed++; return this.a; },
	      get c() { let b = this.b; cComputed++; return b; }
	    };
	Rule.rulify(that);
	expect(await that.c).toBe(1);
	expect(bComputed).toBe(1);
	expect(cComputed).toBe(1); // Once upon a time, the implementation evaluated c twice.
      });
    });
    it('when chained to other rulified objects with promises will resolve in a rule.', done => {
      var data = Rule.rulify({
        a: () => Promise.resolve(Rule.rulify({
          b: () => Promise.resolve(Rule.rulify({
            c: () => Promise.resolve(17)
          }))
        })),
        chainRule: self => self.a.b.c
      });
      data.chainRule.then(result => {
        expect(result).toBe(17);
        done();
      });
    });
    it('when chained to other rulified objects with promises will not resolve outside a rule.', done => {
      var data = Rule.rulify({
        a: () => Promise.resolve(Rule.rulify({
          b: () => Promise.resolve(Rule.rulify({
            c: () => Promise.resolve(17)  // won't get here
          }))
        }))
      });
      expect(() => data.a.b.c.then(() => "won't get here")).toThrowError();
      done();
    });
    describe('chains of assigned promises', function () {
      describe('starting with promises that resolve in random orders', function () {
	/*
          An interactive application might respond to a user gesture by changing the appearance of 50 things one at a time,
          or all at once. We want to encourage the all at once thing in only one cases:
          If there is a new object (e.g., a new item in the DOM that causs reflow), then it is best to set up that object "offcreen",
          and then add it to the DOM. In addition to the performance benefit, the user doesn't see a flash of, say, a black square
          that then turns white.
          Otherwise, it is generally best to change whatever can be changed, independently of waiting for everything else.
          In particular, it is not a great idea to compute 50 different values, and then assign them all, because the big
          respondToUserGestureByComputing50Things() becomes fragile (if anything breaks the whole thing breaks), and hard to combine
          with other code that someone else writes.

          One of the principle uses of promises in rules is that some activity might cause something to happen on another system
          that takes some time. We can use the fact that rule promises are contagious to support both the everything-at-once case
          and the do-what-you-can-when-you-can case.
          - For the first, if a big computation hits any promises, the whole thing will be a promise that will not compute
          until everything is ready. This can be used in a constructor that will not resolve to an new object until it is
          ready, which can then be inserted into the DOM tree.
          - For the second, just write properties that each depend on one or more other properties that resolve whenever, and the
          properties and any eager dependents resolve individually.
	*/
        class RandomPromises {
          get p1() { return delay(Math.random() * 10, 1); }
          get p2() { return delay(Math.random() * 10, 2); }
          get p3() { return delay(Math.random() * 10, 3); }
        }
        Rule.rulify(RandomPromises.prototype);
        it('a value that produces values dependent on these, will not resolve until all are ready', async function () {
          class AllAtOnce extends RandomPromises {
            get bang() {
              let {p1, p2, p3} = this;
              return {p1, p2, p3};
            }
            get afterBang() {
              let {p1, p2, p3} = this.bang;
              return p1 + p2 + p3;
            }
          }
          Rule.rulify(AllAtOnce.prototype);
          expect(await new AllAtOnce().afterBang).toBe(6);
        });
        it('individual properties that depend on these will be ready when possible', async function () {
          class Individual extends RandomPromises {
            get d1() { return this.p1; }
            get d2() { return this.p2; }
            get d3() { return this.p3; }
          }
          Rule.rulify(Individual.prototype);
          let i = new Individual();
          expect(await i.d1).toBe(1);
          expect(await i.d2).toBe(2);
          expect(await i.d3).toBe(3);
        });
      });
      /* 
         ISSUE: do we need any of this? Shouldn't interception be handled by proxies?

         Now consider a rule with assignment interception to promise the value after it has been shared on a network.
         Before the promise resolves, another assignment is made, with another interception. What do observers see?
         - A promise value should indicate a value in flight.
         - The resolved or rejected value should reflect the state of the other system with which we are communicating
         under a delay. The value (or error) may not be we what we sent.
         - A non-promise value should indicate that nothing is in flight at the tick of resolution, and the value 
         is available for use. For example, a then on that promise shouldn't find that the value is still a promise. (I think?)
         - Thus by the time it resolves, observers should see the final value. I.e., there is no need for observers
         to see the intermediate values, because they are not defined. It would depend on the order that the promises
         are resolved in, and on what other stuff is happening on the other system, which we cannot see until the promise is resolved.
         (Does it matter if it is computed, assigned, or an assignment interception???  If general, change the following!)
	 describe('an intercepted assignment that gets another intercepted assignment before resolution', function () {
         // In general, this is like opening a pipe that will not close until the pipe is empty.
         // Until then, all values are sent to the other system in order (if possible). The pipe leaves the last value or
         // first failure in place.
         class SomeClient {
         property() { } // we're going to assign a value
         }
         function send(v, key, self) {
	 console.log('value:', v, 'existing:', self[key]);
         return new Promise(resolve => {
         setTimeout(() => resolve(v), 500);
         });
         }
         Rule.rulify(SomeClient.prototype, {assignment: send});
         it('resolves only when both are done', async function () {
         let i = new SomeClient();
         i.property = 1;
         let promise = i.property;
         i.property = 2;
         expect(await promise).toBe(2);
         });
         xit('can be rejected before the second assignment, acting as two assignments (with the first rejected)', function () {
         });
         xit('can be rejected by the second after the second is assigned, acting as a single rejection', function () {
         });
         xit('can be rejected by the first after the second is assigned, acting as a single rejection', function () {
         });
	 });
      */
      describe('does not attempt to treat promises as values within rules', function () {
	function define(label, reference) {
          it(label, async () => {
            function recordedDelayedComputation(label, thunk) {
              history.push('start ' + label);
              return new Promise(resolve => {
		setTimeout(() => {
                  history.push('finish ' + label);
                  resolve(thunk());
		}, 100);
              });
            }
            function recordedDelayedValue(label, value) {
              return recordedDelayedComputation(label, () => value);
            }
            var history = [],
		data = Rule.rulify({
                  a: self => recordedDelayedValue('a', Rule.rulify([1])),
                  b: self => recordedDelayedValue('b', {c: 2}),
                  d: self => recordedDelayedComputation('d', () => Rule.rulify({e: self => recordedDelayedValue('e', {f: 3})})),
                  z: self => {
                    history.push('start z');
                    let referenceThroughLength = self.a.length - self.a.length;
                    const result = self.a[referenceThroughLength] + self.b.c + self.d.e.f;
                    history.push('finish z');
                    return result;
                  },
                  reference: self => self.z,
                  refA: self => self.a.map(e => e)
		});
            function check(final, aPart = []) {
              expect(final).toBe(data.z);
              expect(final).toBe(6);
              expect(history).toEqual(aPart.concat([
		'start z',
		'start b',
		'finish b',

		'start z',
		'start d',
		'finish d',

		'start z',
		'start e',
		'finish e',

		'start z',
		'finish z'
              ]));
            }
            await data[reference].then(final => check(final, [
              'start z',
              'start a',
              'finish a'
            ]));
            history = [];
            expect(data.refA).toEqual([1]);
            data.a.push(2);
            data.b = data.d = undefined;
            await data[reference].then(check);
            expect(data.refA).toEqual([1, 2]);
          });
	}
	define('directly', 'z');
	define('indirectly', 'reference');
      });
      describe('can', function () {
	it('not have an initial Promise value (without compute) that resolves.', async function () {
          let object = Rule.attach({}, 'rule', Promise.resolve(17)),
              result = await object.rule;
          expect(result).toBe(17); // That's fine.
          expect(object.rule instanceof Promise).toBeTruthy(); // No compute method, so it doesn't get replaced.
	});
	it('compute an initial Promise value that resolves.', async function () {
          class Klass {
            get rule() { return Promise.resolve(17); }
          }
          Rule.rulify(Klass.prototype);
          let object = new Klass(),
              result = await object.rule;
          expect(result).toBe(17);
          expect(object.rule).toBe(result);
	});
	it('reference a promise that resolves.', async function () {
          class Klass {
            get promise() { return Promise.resolve(17); }
            get rule() { return this.promise; }
          }
          Rule.rulify(Klass.prototype);
          let object = new Klass(),
              result = await object.rule;
          expect(result).toBe(17);
          expect(object.rule).toBe(result);
	});
	it('reference a promise that resolves to produce a promise that resolves.', async function () {
          class Klass {
            get promise() { return Promise.resolve(17); }
            get rule() { return Promise.resolve(this.promise); }
          }
          Rule.rulify(Klass.prototype);
          let object = new Klass(),
              result = await object.rule;
          expect(result).toBe(17);
          expect(object.rule).toBe(result);
	});
	it('reference an array of promises to be resolved.', async function () {
          class Klass {
            get anotherPromise() { return Promise.resolve(2); }
            get promise() { return [1, this.anotherPromise, Promise.resolve(17)]; }
            get rule() { return Promise.all(this.promise); }
            get ref() { return this.rule; }
          }
          Rule.rulify(Klass.prototype);
          let object = new Klass(),
              result = await object.rule;
          expect(result).toEqual([1, 2, 17]);
          expect(object.rule).toBe(result);
          expect(object.ref).toBe(result);
          object.anotherPromise = Promise.resolve(3);
          let next = await object.ref;
          expect(next).toEqual([1, 3, 17]);
	});
      });
      describe('assignment can be intercepted', function () {
	let assigned;
	afterEach(function () {
          assigned = undefined;
	});
	describe('for immediate side-effect', function () {
          function assignment(v) { return assigned = v; }
          it('before caching.', function () {
            let instance = Rule.attach({}, 'foo', () => 17, {assignment});
            instance.foo = 16;
            expect(instance.foo).toBe(16);
            expect(assigned).toBe(16);
          });
          it('after caching.', function () {
            let instance = Rule.attach({}, 'foo', () => 17, {assignment});
            expect(instance.foo).toBe(17);
            expect(assigned).toBeUndefined();
            instance.foo = 18;
            expect(instance.foo).toBe(18);
            expect(assigned).toBe(18);
          });
	});
	describe('by promise, as though for synchronizing with others', function () {
          function assignment(v) {
            // Careful: The implementation is careful to not call this during
            // resets that it does internally. However, an application is
            // allowed to explicitly assign undefined to a rule, effectively restoring
            // the computed rule. In that case, the application will have to decide
            // if something like the following line is warranted:
            // if (v === undefined) return;
            return new Promise(resolve => setTimeout(_ => {
              resolve(assigned = v);
            }, 500));
          }
          it('before caching.', async function () {
            let instance = Rule.attach({}, 'foo', () => 17, {assignment});
            instance.foo = 16;
            expect(instance.foo instanceof Promise).toBeTruthy();
            expect(await instance.foo).toBe(16);
            expect(assigned).toBe(16);
          });
          it('after caching.', async function () {
            let instance = Rule.attach({}, 'foo', () => 17, {assignment});
            expect(instance.foo).toBe(17);
            expect(assigned).toBeUndefined();
            instance.foo = 18;
            expect(await instance.foo).toBe(18);
            expect(assigned).toBe(18);
          });
          it('with dependencies resolving.', async function () {
            class Observable {
              get foo() { return "assigned a value, below"; }
              get bar() { return this.foo; }
            }
            Rule.rulify(Observable.prototype, {assignment});
            let instance = new Observable();
            instance.foo = 16;
            expect(instance.bar instanceof Promise).toBeTruthy();
            expect(await instance.bar).toBe(16);
            expect(assigned).toBe(16);
          });
	});
      });
    });
    describe('internals', function () {
      it('prints rules as [class [instance] key]', function () {
	let array = [1, 2],
            proxied = Rule.rulify(array),
            object = {someRule: self => proxied[0]};
	Rule.rulify(object);
	object.toString = () => "[fred]";
	expect(object.someRule).toBe(1);
	expect(Rule.getRule(object, 'someRule').toString()).toBe("[Computed [fred] someRule]");
	proxied.forEach(_ => _); // The specific behavior of printing is not defined for elements that have not been demanded.
	expect(Rule.getRule(object, 'someRule').requires[0].toString()).toBe("[Proxied [1,2] 0]");
      });
      describe('Reflect.get/set protocol', function () {
	class Reflector {
          get foo() { return 42; }
	}
	Rule.rulify(Reflector.prototype);
	it('can be get.', function () {
          let reflector = new Reflector();
          expect(Reflect.get(reflector, 'foo')).toBe(42);
          reflector.foo = 17;
          expect(Reflect.get(reflector, 'foo')).toBe(17);
	});
	it('can be set.', function () {
          let reflector = new Reflector();
          expect(Reflect.set(reflector, 'foo', 17));
          expect(reflector.foo).toBe(17);
	});
      });
      it('can be the target of a Proxy.', function () {
	// See comments for ensureRule of a Property.
	// This matters for ki1r0y Blocks in which models are proxies in which assignment is trapped to go through Croquet.
	class Foo {
	  get rule() {
	    return 42;
	  }
	}
	Rule.rulify(Foo.prototype);
	let assigned = 0,
	    foo = new Foo(),
	    proxy = new Proxy(foo, {
	      set(target, key, value) {
		assigned++;
		target[key] = value;
		return true;
	      }
	    });
	expect(proxy.rule).toBe(42);
	expect(assigned).toBe(0);
	proxy.rule = 17;
	expect(proxy.rule).toBe(17);
	expect(assigned).toBe(1);
      });
    });
    describe('with fancy code-related examples', function () {
      let effects;
      beforeEach(() => { effects = []; });
      function effect(label) { effects.push(label); }
      it('does not depend on ordinary class definitions', function () {
	class ParentModel {
	  a() { effect('a'); return new AModel(); }
	  b() { effect('b'); return new BModel(); }
	  aFoo() { effect('aFoo'); return this.a.foo; }
	  bFoo() { effect('bFoo'); return this.b.foo; }
	  childNames() { effect('names'); return Rule.rulify(['a', 'b']); }
	  //children() { effect('children'); return Rule.rulify(this.childNames.map(name => this[name]));}
	  children() {
	    let children = Rule.rulify([]);
	    effect('children');
	    this.childNames.forEach((name, index) => children[index] = this[name]);
	    return children;
	  }
	  bars() { effect('bars'); return Rule.rulify(this.children.map(child => child.bar)); }
	}
	class AModel {
	  get foo() { effect('AModel.foo'); return 'a'; }
	  get bar() { effect('AModel.bar'); return 'aa'; }
	}
	class AModel1 {
	  get foo() { effect('AModel.foo'); return 'a1'; }
	  get bar() { effect('AModel.bar'); return 'aa1'; }
	}
	class BModel {
	  get foo() { effect('BModel.foo'); return 'b'; }
	  get bar() { effect('BModel.bar'); return 'bb'; }
	}
	[ParentModel, AModel, AModel1, BModel].forEach(c => Rule.rulify(c.prototype));
	let parent = new ParentModel();
	expect(parent.aFoo).toBe('a');
	expect(parent.bFoo).toBe('b');
	//parent.children.push(parent.a); // Assigned outside of a rule. children is NOT dependent on a...
	//parent.children.push(parent.b); // ... nor on b.
	expect(parent.bars).toEqual(['aa', 'bb']);
	expect(effects).toEqual(['aFoo', 'a', 'AModel.foo', 'bFoo', 'b', 'BModel.foo', 'bars', 'children', 'names', 'AModel.bar', 'BModel.bar']);
	effects = [];
	parent.a = new AModel1();
	expect(parent.aFoo).toBe('a1');
	expect(parent.bFoo).toBe('b');
	expect(parent.bars).toEqual(['aa1', 'bb']);
	expect(effects).toEqual(['aFoo', 'AModel.foo',
				 'bars', 'children', // fixme remove
				 'AModel.bar']); // b, bFoo, ....?.... are still cached.
      });
    });
  });
});
