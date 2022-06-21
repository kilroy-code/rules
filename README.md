# Rules

Rules are a way to define Javascript code that computes a value, but which behaves like properties. However, the code automatically keeps track of what rules (i.e., what properties) depend on others, so that when something changes, the system automatically recomputes all and only those rules that need to be recomputed.

The cells in a spreadsheet work this way. You can write a value to a cell, and that value is remmbered by the spreadsheet and displayed. You can also write a formula that is used to compute the value of a cell, and that formula may use the value of other cells, whether those cells have supplied values or are forumalae themselves. When you change one of those supplied values, all of the forumalae that depend on it are recomputed, and all of the formulae that depend on _those_, and so on.

Rules are exactly the same thing, but can be used in any Javascript program. A Rule is like a cell in a spreadsheet, and the code in the Rule is like the formula.

This style of programming is particularly useful for complex systems, or where different parts of the system are authored by different people or organizations. 

## Example

There are many ways to define Rules. One way is with ordinary classes:

```
class Box {
  length() {  // The simplest rule just returns a value.
    return 2;
  }
  width() {
    return 3;
  }
  area() {
    return this.length * this.width; // A formula that depends on other Rules.
  }
}
Rule.rulify(Box.prototype);  // Converts the methods to Rules.

var box = new Box();
console.log(box.length); // 2
console.log(box.width);  // 3
console.log(box.area);   // 6
```
Note that _length_ and _width_ are **accessed** as ordinary properties, rather than as method calls. 

The values can also be **assigned** as ordinary properties:

```
box.length = 5;
console.log(box.area);  // 15! 
```
We did not have to tell _area_ that it needed to be recomputed now that _length_ was changed. The next sections describe some of them.

### Properties

In basic Javascript, you can read a named property of an object (or a numbered property of an Array), and you can write to these properties.

```
someObject.answer = 17;
console.log(someObject.answer); // 17

someObject['answer'] = 42;
console.log(someObject['answer']); // 42

Reflect.set(someObject, 'answer', 99);
console.log(Reflect.get(someObject, 'answer')); // 99

someObject.answer = undefined;
console.log(someObject.answer); // undefined
```

Rules are the same, except for the last line above. A Rule would recompute the _answer_ based on the formula code in the Rule.

That is, the code in a Rule (e.g., `return this.width * this.height`) defines how the system will compute the value of the property - unless your program assigns a different value. If you do assign a value, that value will be cached and used instead of the Rule's code. However, you can "reset" a Rule so that it goes back to using your program's code. This is done by assigning the Javascript value `undefined`. 

This simplifies the interaction in a complex exploratory systems. The Rule defines the default behavior, and the application might show these computed values in an inspector. However, the application's inspector might allow the user to "override" the Rule and provide a value of their own, such as for _length_ in the example above. The inspector would then show the updated value for _area_. However, unlike a typical spreadsheet, you can bring back the Rule's formula code.

By the way, there is nothing wrong with having a Rule that refers to an ordinary Javascript property -- i.e., one that is not rulified. However, a Rule that does so will _not_ be reset when that property is changed. Rules can only track other Rules -- _**they cannot track changes in ordinary properties**_.

### Caching (aka Memoization)

The values of all rules are automatically cached.  For example, suppose we had defined:

```
...
  area() {
    console.log('Computing area!');
    return this.length * this.width;
  }
...

> box.area
Computing area!
6
> box.area // We already cached the value. No need to recompute.
6 

> box.length = 5;
5
> box.area // Area needs to be recomputed.
Computing Area
15 
> box.area // And now the new value has been cached. No recompute.
15
```

Memoization is often used in applications for efficiency. While that doesn't seem very important in this toy example, it makes a big difference in complex applications in which it is not obvious when one computation will involve another, which involves another written by someone else, where that computation turns out to be expensive. Here, all Rules are memoized. 

Memoization is the default behavior. You can still have ordinary methods that are not cached. See `rulify` and `attach`.

### Demand-Driven Evaluation (aka Lazy Evaluation)

In the above examples, _area_ is not computed until it is actually used, i.e., referenced by some executing code. Even after we computed _area_ once, by default it was not immediately recomputed when we assigned a new value for _length_. However, once we then asked for _area_ it was computed again and the value cached.

Imagine that you have a spreadsheet with some big table way out to the side offscreen, or on another sheet. Lazy evaluation means that these forumalas are not actually computed until they come into view -- unless something that _is_ in view depends on those other cells, in which case they _are_ automatically computed insead of giving an error. In any case, as a spreadsheet author you don't have to write any code to compute the other cells when they come into view, or to make sure that some part of it is computed when off screen because you need the answer in this other cell that is in view.

Lazy evaluation is the default behavior. You can also have "eager" Rules that automatically get re-demanded after they have been reset. See `rulify` and `attach`.

### Dependency-Directed Backtracking

As the system computes the Rule for our _area_, above, it keeps track of the other Rules that it needs -- in this case, _length_ and _width_. It automatically uses the cached values of those Rules, and it automatically computes them if they have not yet been demanded. This is automatically repeated for all of the Rules that _they_ require, and so forth.

Now, when something is assigned, such _length_, above, the system goes back and resets all those Rules that have been demanded that immediately depend on _length_ for their own formula. This is automatically repeated for all of the Rules that depend on _those_ Rules, and so forth. 

Note that _only_ the dependent rules are reset. For example, _width_ is not reset, because its code doesn't depend at all on _length_. This is very different than a system that simply notes whether "something has changed", and then recomputes _everything_.

(If you're familiar with expert systems, you can think of the demand-driven evaluation of referenced Rules as "forward chaining", and the reset of all the dependent Rules as "backward chaining". Rules use both!)

### Tracking Through Dynamic Extent

A Rule can refer to non-Rule code that, in turn, refers to a Rule. That's fine, and the second Rule _will_ be tracked. There is no need for the first Rule to lexically contain the second Rule. (However, see "Pitfalls", below.)

If it helps to understand, the tracking is achieved by having Rule reference interact with an application-global stack of tracking machinery. This works because of two fundamental of how Javascript works:

- Each Javascript application module is effectively single-threaded for the application code. Rules are _not_ tracked between, e.g., one Web page and another, or between a Web page and a Web worker.
- Javascript modules (such as the Rules module) are only loaded once in application code, regardless of how many modules may load other modules that each load the Rules module.

### Components and `this`

One sometimes wants to define object instances of, e.g., a generic "game object", as a set of separately defined components. If the components are modeled as instances of a Javascript "class", then the special Javascript binding `this` will refer to the component, rather than to the whole "game object".

There are several mechanisms in Javascript that allow for such distinctions, including `function` and `bind` vs `=>`, and _target_ vs _receiver_ in `Reflect.get`/`.set`.

To accomodate such distinctions, the code for computing a Rule value is always passed an argument that is the _receiver_.  Usually this is the same as `this`, but can be different (e.g., in `Reflect.get`). You can ignore this argument (e.g., you don't even have to declare it, but it's there if you want. (For example, I often name that argument `self` and use it where I would otherwise use `this`.) This is particularly convenient with "Dynamic Attachement" and `=>` functions.

_(FIXME: give an example that shows where they can be different.)_


### Dynamic Attachment

An ordinary property can be created simply by assigning a value, or by using `Object.defineProperty()`.  They don't have to be declared up front by a class definition. It is very common to make use of this Javascript, especially when creating things live while interacting with them.

We can also dynamically attach Rules to existing instantiated objects:

```
Rule.attach(parent, 'reversedNames', (self) => self.children.reverse)
```
This defines a new Rule on parent (or redefines an old one of the same name), accessed as `parent.reversedNames`. The default function provides the default computed value.

_(FIXME: add redefinition to test suite.)_

### POJOs

There's nothing particularly magical about class instances in Javascript. Our box in the example above could be an ordinary "Plain Old Javascript Object" (e.g., `{}`, or `{x: 17, y: 42, name: 'fred'}`), plus some inheritance.

You can `attach` to a POJO, and you can `rulify` any instance, whether a POJO or something else.  For example, our _box_ could be written as:

```
var box = {};
Rule.attach(box, 'length', () => 2);
Rule.attach(box, 'width', () => 3);
Rule.attach(box, 'area', (self) => self.length * self.width);
console.log(box.area);   // 6
...
```

or as:

```
var box = {
  length: () => 2,
  width: () => 3,
  area: (self) => self.length * self.width
};
Rule.rulify(box);
console.log(box.area);   // 6
...
```
These two examples are identical, and they differ from the first example only in that the first example defined the rules on `Box.prototype` so that the rules would be defined for any instance of `Box`, rather than this particular hand-crafted POJO.

One consequence of this ability is that an application can add Rules to POJOs, without having access to the original class source (if any) that defined them.

### Arrays

Arrays can also be Rulified, so that each element acts like an object's property Rules.

Consider the following example, as kind of a review of the above:

```
class Child {
  constructor(name) {
    this.name = name;  // Overrides the default Rule for name.
  }
  name() {
    return 'name me';
  }
}

class Parent {
  childA() {
    return new Child('A');
  }
  childB() {
    return new Child('B');
  }
  children() {
    return [this.childA, this.childB];
  }
  names() {
    return this.children.map((child) => child.name).join(', ');
  }
}
[Parent, Child].forEach(kind => Rule.rulify(kind.prototype));

var parent = new Parent();
console.log(parent.names);  // A, B 
parent.childA.name = 'C';
console.log(parent.names);  // C, B
parent.childB = new Child('D');
console.log(parent.names);  // C, D
```

The Rules _names_ depends on _children_. In turn, the Rule _children_ depends on _childA_ and _childB_. Finally, _names_ also depends on the _name_ Rule of each _Child_.  So naturally, when we assign new values to `parent.childA.name` or `parent.childB`, _names_ is recomputed.

All these references to Rules in other objects are perfectly fine and expected.

However, the Array that is the value of _children_ also has properties, but they are not Rules, and so _Rules cannot track changes in them_. For example, consider `Array.prototype.length`:

```
parent.children.push(new Child('E'));
console.log(parent.names);  // C, D still!!!
```

The Rules _names_ and _children_ cannot depend on the array _length_, and so _names_ does not get reset when _length_ is changed!

Fortunately, we can _rulify_ arrays just like we can rullify POJOs:

```
  children() {
    return Rule.rulify([this.childA, this.childB]);
  }

```
This converts length and each element of the array to a Rule, in which changes are tracked by other Rules. Now `parent.names` is properly updated to `C, D, E`.

_I am concering additional magic. In particular, there are several methods on Array.prototype that use a function to create a new copied array. I would like for each of these methods on rulified arrays to automatically produce a new rulified array in which the formula for each element is based on the function given by the application. Thus if an individual element of the original rulified array is changed, then the corresponding element of the copy - and only that element - will be reset. Demanding that element will compute a new value by applying the original formula to the new element of the original rulified array. The motivation for this is that I would like to be able to replace a child element and have various mirrors or views of those children update only one element. This matters when the tree is deep and something near the top is replaced (e.g., with new code)._

### Promises and `async` Rules

A Rule can be declared `async` or it can explicitly return a `Promise`. This is quite common when interacting with the file system or another computer on the network. In either case, a reference to the Rule will answer a Promise until it is resolved, and then will _automatically replace the Promise with the resolved value_. (How cool is that!)

Furthermore, this fans out to any Rule that depends on a Rule with a `Promise` value. The referencing rule does not need to know whether the Rule it depends on was asynchronous, and it does not need to explicity `await` the result!  E.g.,:

```
async function saveDataAndReturnIdentifier() {
  ...
}

class Widget {
  ...
  identifier() {
    return saveDataAndReturnIdentifier();
  }
  childIdentifiers() {
    return this.children.map(child => child.identifier));
  }
  ...
}
Rule.rulify(Widget.prototype);
```
Note that none of the Rule code does anything at all with `async` or `await`. It does not need to. An application that uses this, e.g., to display an inspector of _Widgets_, could show Promise values as `...`, and then show the resolved value. But neither the author of the UI, nor the author of the _Widget_ Rules, needs to know anything about the internals of which Widget rules might temporarily be a `Promise` vs which do not.

This is very convenient, especially when working with code produced by other with which you are not familiar or which may be changing -- including code that is changing as you use it! But there is an important reason for it beyond convenience. In some systems, particularly distributed systems, it is very important that the system (or some well-defined portion of the system) produce deterministically identical results on different computers. This is difficult when some result involve user interactions and communications over the network (that may take different amounts of time for different users). When combined with memoization, above, the magic resolution of `Promises` makes it possible to know that once a Rule has an answer on each system, it will be the same answer on each system regardless of how long things took, or what order the dependents were computed in. (This is assuming that the Rules do not depend on side effects, such as incrementing a set of order-dependent counters.)

## Pitfalls and Common Mistakes

- Non-Rule code can refer to Rules (using ordinary property syntax), but it won't get the magic Promise resolution. For example, if non-Rule code references a Rule that happens to be a Promise at the time, the non-Rule will have to arrange its own `await` or `then`.

- Rule code can refer to non-Rule code, including non-Rule properties, but it won't  track changes (e.g., assignments) to non-Rule properties.

- A single Rule can have code that refers to _multiple_ other Rules that are `async` or have `Promise` values. That works. However, portions of the Rule may execute multiple times. For example, suppose there is a Rule like:

```
computeSomething() {
  const fooResult = this.foo;
  console.log('Got resolved foo:', fooResult);
  const barResult = this.bar;
  console.log('Got resolved bar:', barResult);
  const bazResult = this.baz;
  console.log('Got resolved baz:', bazResult);
  return fooResult + barResult + bazResult;
}
```
This works, regardless of whether _foo_, _bar_, or _baz_ are promises at any point in time. However, it may produce those side effects multiple times before ultimately getting a resolved value to cache.

```
Got resolved foo: 17
Got resolved foo: 17
Got resolved bar: 42
Got resolved foo: 17
Got resolved bar: 42
Got resolved baz: 99
```
Note, though, that because of memoization, this code will not not execute whatever is in _foo_ more than once, nor will it execute whatever is in _bar_ more than once. It is just that the portions of _computeSomething_ that _reference_ _foo_ and _bar_ may be executed more than once.

- During the initial dynamic execution of a Rule, all the other Rules it requires are tracked. However, this does not apply to a callback that lexically appears within a Rule, nor to a `then` (because this is equivalent to a callback). For example:

```
class Callbacks {
  a() { return 1; }
  b() { return 2; }
  data() {
    let data = [];
    let a = data[0] = self.a;
    fetchFromDatabase(a, function (error, dbValue) {
      if (error) throw error;
      let b = data[1] = this.b;
      data[2] = dbValue + a + b;
    });
  return container;
}
Rule.rulify(Callbacks.prototype);
```
If there is an assignment (including a reset) of _a_, then _data_ will correctly be recomputed because a was referenced dynamically before / lexically outside of the callback. However, the Rule _b_ will not be tracked as being required for _data_, and an assignment or reset of _b_ will not recompute the _data_.

The correct way to do this is to split the database operation into two Rules, one that returns a Promise indicating that the database operation has been started, and one that does something with the results:

```
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
```
This wil re-rerun the database fetch if _a_ changes, and it will recompute the final answer if _a_ or _b_ changes.

- Beware of side-effects. In general, functional/declarative and procedural code can be mixed with Rules, but if you do that, it is up to you to ensure that the side effects are correct.

- A particular case of the general warning about side-effects, is that if you do some network or other activity asynchronously, beware of assignments the result before it has resolved. For example, if you have a Rule that returns a `Promise` and then make an assignment to it before the `Promise` resolves, the final value of the Rule is not specified. 

## Related Work

Depedency-directed backtracking has been used for decades in artifical intelligence and expert systems.

The authors own experience with it began while working for several years at an expert systems company that did CAD systems for engineers. (This company spawned an IPO, several spinnoffs, and acquisitions by Oracle, Autodesk, and Dassault.) See https://en.wikipedia.org/wiki/ICAD_(software)

Later, he led a team that created a version of Croquet that used it. See https://https://alum.mit.edu/www/stearns/croquet/C5-06-BrieUserExperience.pdf and https://alum.mit.edu/www/stearnscroquet/C5-06-BrieArchitecture.pdf

## API

### ES6 Modules CommonJS Modules

_(FIXME: exampes of setup for each, and define what is exported)_

### attach

_(FIXME: do it)_

### rulify

_(FIXME: do it)_




