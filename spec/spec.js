/*global describe, it, require*/
"use strict";
var Rule = require('@kilroy-code/rules');
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
        width() { return 0; }
        length() { return 0; }
        area() { return this.width * this.length; }
      }
      class Box extends Rectangle {
        volume() { return this.area * this.height; }
      }
      Rule.rulify(Rectangle.prototype);
      Rule.rulify(Box.prototype, ['volume', 'height']);
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
        root() { return 3; }
        foo() { return this.root; }
        bar() { return this.foo + 1; }
        baz() { return 10; }
      }
      class Sub extends Super {
        root() { return 2; }
        foo(self) { // Second argument to rule is the super.foo(self) method, bound to this.
          return super.__foo(self) * 10;
        }
        // No baz defined.
      }
      class SubSub extends Sub {
        baz(self) { return super.__baz(self) * 2; }
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
        xit('configurable, enumerable', function () {
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
    xit('can be defined to eagerly re-evaluate', function () {
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
        theRule() { return 'compiled in'; }
        dependant(self) { return 'got ' + self.theRule; }
      }
      class Relabled extends OverrideExample {
        theRule() { return 'compiled override'; }
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
    it('does not track dependencies in callbacks', (done) => {
      function fetchFromDatabase(key, cb) {
        setTimeout(() => cb(null, key + 2), 10);
      }
      class Callbacks {
        a() { return 1; }
        b() { return 2; }
        noPromise(self) {
          var a = self.a;
          var container = [];
          fetchFromDatabase(a, function (error, dbValue) {
            if (error) throw error;
            container[0] = dbValue + a + self.b;
          });
          return container;
        }
        wrongResult(self) { return self.noPromise[0]; }
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
      expect(() => that.wrongResult).toThrowError();
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
  });
  describe('execution time', function () {
    xit('should be within a small factor of normal method on first execution.', function () {
    });
    xit('should be less than a normal method on subsequent execution.', function () {
    });
  });
  describe('with Promises', function () {
    var that = {};
    Rule.attach(that, 'explicitPromise', () => new Promise((resolve) => setTimeout(() => {
      resolve(3);
    }, 0)));
    it('resolves to the actual value when the promise resolves', (done) => {
      that.explicitPromise.then(() => {
        expect(that.explicitPromise).toBe(3);
        done();
      });
    });
    it('is still initially a promise that then becomes the value, if the rule is an immediately resolve promise', (done) => {
      Rule.attach(that, 'immediatePromise', () => Promise.resolve(3));
      that.immediatePromise.then(() => {
        expect(that.immediatePromise).toBe(3);
        done();
      });
    });
    it('is contagious to other rules that reference it', (done) => {
      Rule.attach(that, 'promisedA', () => Promise.resolve(3));
      Rule.attach(that, 'referenceA', (self) => self.promisedA + 1);
      that.referenceA.then((resolved) => {
        expect(resolved).toBe(4);
        expect(that.referenceA).toBe(4);
        expect(that.referenceA).toBe(4);                
        that.promisedA = 72;
        expect(that.referenceA).toBe(73);
        expect(that.referenceA.then).toBeUndefined();
        expect(that.referenceA).toBe(73);                
        that.promisedA = undefined;
        that.referenceA.then((resolved) => {
          expect(resolved).toBe(4);
          expect(that.referenceA).toBe(4);
          expect(that.referenceA).toBe(4);                    
          done();
        });
      });
    });
    it('propogates resolutions through chains', (done) => {
      Rule.attach(that, 'chainA', () => Promise.resolve(3));
      Rule.attach(that, 'chainB', (self) => self.chainA + 1);
      Rule.attach(that, 'chainC', (self) => self.chainB + 1);            
      that.chainC.then((resolved) => {
        expect(resolved).toBe(5);
        expect(that.chainC).toBe(5);
        done();
      });
    });                  
    it('propogates rejections through contagious chains', (done) => {
      var that = {};
      Rule.attach(that, 'chainA', () => Promise.reject(3));
      Rule.attach(that, 'chainB', (self) => self.chainA + 1);
      Rule.attach(that, 'chainC', (self) => self.chainB + 1);            
      that.chainC.catch((reason) => {
        expect(reason).toBe(3);
        done();
      });
    });
    it('can handle multiple promise references in a rule', function (done) {
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
    it('properly caches rules that were resolved promises', done => {
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
    it('can refer to promise rule chains', done => {
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
    it('when chained to other rulified objects with promises will resolve in a rule', done => {
      var data = Rule.rulify({
        a: () => Promise.resolve(Rule.rulify({
          b: () => Promise.resolve(Rule.rulify({
            c: Promise.resolve(17)
          }))
        })),
        chainRule: self => self.a.b.c
      });
      data.chainRule.then(result => {
        expect(result).toBe(17);
        done();
      });
    });
    it('when chained to other rulified objects with promises will not resolve outside a rule', done => {
      var data = Rule.rulify({
        a: () => Promise.resolve(Rule.rulify({
          b: () => Promise.resolve(Rule.rulify({
            c: Promise.resolve(17)
          }))
        }))
      });
      expect(() => data.a.b.c.then(() => "won't get here")).toThrowError();
      done();
    });
    it('does not attempt to treat promises as values within rules', done => {
      var history = [],
          data = Rule.rulify({
            a: self => {
              history.push('start a');
              return new Promise(resolve => {
                setTimeout(() => {
                  history.push('finish a');
                  resolve(1);
                }, 100);
              });
            },
            b: self => {
              history.push('start b');
              return new Promise(resolve => {
                setTimeout(() => {
                  history.push('finish b');
                  resolve({c: 2});
                }, 100);
              });
            },
            d: self => {
              history.push('start d');
              return new Promise(resolve => {
                setTimeout(() => {
                  history.push('finish d');
                  resolve(Rule.rulify({
                    e: self => {
                      history.push('start e');
                      return new Promise(resolve => {
                        setTimeout(() => {
                          history.push('finish 3');
                          resolve({f: 3});
                        }, 100)
                      });
                    }
                  }));
                });
              });
            },
            z: self => {
              history.push('start z');
              const result = self.a + self.b.c + self.d.e.f;
              history.push('finish z');
              return result;
            }
          });
      data.z.then(final => {
        expect(history).toEqual([
          'start z',
          'start a',
          'finish a',
          
          'start z',
          'start b',
          'finish b'
          ,
          'start z',
          'start d',
          'finish d',
          
          'start z',
          'start e',
          'finish 3',
          
          'start z',
          'finish z'
        ]);
        expect(final).toBe(data.z);
        expect(final).toBe(6);
        done();
      });
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
    xit('can be used in an entity/component system', function () {
      var componentA = {property: 16};
      var componentB = {property: 41};
      function addProperties(self) { return this.property + self.property; }
      Rule.attach(componentA, 'value', addProperties);
      Rule.attach(componentB, 'value', addProperties);            
      var entity = {
        property: 1,
        addComponent: function (name, component) {
          // Rules will use this.entity (if defined) as the 'self' parameter.
          component.entity = this;
          this[name] = component;
        }
      };
      entity.addComponent('a', componentA);
      entity.addComponent('b', componentB);
      
      expect(entity.a.value).toEqual(17);
      expect(entity.b.value).toEqual(42);
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

      nakedList.push(1); // change of the original list does not reset sum
      expect(other.sum).toBe(7); // not 8, because 7 is still cached

      list.push(2); // change of list resets sum, which picks up change to original list
      expect(other.sum).toBe(10);

      list.pop();
      expect(other.sum).toBe(8);

      list.splice(1, 1);
      expect(other.sum).toBe(6);
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
    xit('a rule can be dynamically added to an instance (e.g., for a named child or view)', function () {
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
        computationOnValue1() {
          computations.push(`simple compute ${this.name}`);
          return this.input1 * 2;
        }
        expensiveComputationOnValue2() {
          computations.push(`expensive compute ${this.name}`);
          return Math.sqrt(this.input2);
        }
        total() { return this.computationOnValue1 + this.expensiveComputationOnValue2; }
      }
      class Parent {
        parameterA() { return 1; }
        parameterB() { return 2; }
        parameterC() { return 9; }
        a() { return new Child('a', this.parameterA, this.parameterC); }
        b() { return new Child('b', this.parameterB, this.parameterC); }
        sum() { return this.a.total + this.b.total; }
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
        computationOnValue1() {
          computations.push(`simple compute ${this.name}`);
          return this.parent[this.name1] * 2;
        }
        expensiveComputationOnValue2() {
          computations.push(`expensive compute ${this.name}`);
          return Math.sqrt(this.parent[this.name2]);
        }
        total() { return this.computationOnValue1 + this.expensiveComputationOnValue2; }
      }
      class Parent {
        parameterA() { return 1; }
        parameterB() { return 2; }
        parameterC() { return 9; }
        a() { return new Child('a', this, 'parameterA', 'parameterC'); }
        b() { return new Child('b', this, 'parameterB', 'parameterC'); }
        sum() { return this.a.total + this.b.total; }
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
});
