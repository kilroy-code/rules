# Rules

Rules let the properties of Javascript instance work like the cells of a spreadsheet. The Rule/properties keep track of each other, and update all and only those other Rules that need to be updated when something changes.

In a spreadsheet, you can write a value to a cell, and that value is remembered by the spreadsheet and displayed. Or you can write a formula that is used to compute the value of a cell, and that formula may use the value of other cells. When you change one of those referenced values, all of the formulae that depend on it are recomputed, and all of the formulae that depend on _those_, and so on.

Rules are exactly the same thing, but can be used in any Javascript program. A Rule is like a cell in a spreadsheet, and the code in the Rule is like the formula.

This style of programming is particularly useful for complex systems, or where different parts of the system are authored by different people or organizations.

While it is easy for rule-based systems to be written in a functional-programming style, rules are also easily integrated with external-systems that depend on side-effects or asynchronous messages.

This README includes:

- A gentle [Introduction](#introduction)
- The [API](#api)
- [Pitfalls](#pitfalls-and-common-mistakes) and Common Mistakes
- A broad description of the [Implementation](#implementation)
- Background on [Related Work](#related-work)

## Introduction
### Example

There are many ways to define Rules. One way is with "getters" in ordinary classes:

```
class Box {
  get length() {  // The simplest rule just returns a value.
    return 2;
  }
  get width() {
    return 3;
  }
  get area() {
    return this.length * this.width; // A formula that depends on other Rules.
  }
}
Rule.rulify(Box.prototype);  // Converts the "get" methods to Rules.

var box = new Box();
console.log(box.length); // 2
console.log(box.width);  // 3
console.log(box.area);   // 6
```
Note that _length_ and _width_ are **accessed** as ordinary properties, rather than as method calls. So far, this is just like an ordinary Javascript "getter".

We did not define any "setter" methods, but `rulify` automatically creates them. The Rule values can therefore be **assigned** as ordinary properties:

```
box.length = 5;         // The "set" method was automatically generated.
console.log(box.area);  // 15! 
```
We did not have to tell _area_ that it needed to be recomputed now that _length_ was changed. The system keeps track of the dependencies.

Rules are:

- [properties](#properties)
- [cached](@caching-aka-memoization) / memoized
- [demand-driven](#demand-driven-evaluation-aka-lazy-evaluation) / lazy
- dependency-directed [backtracked](#dependency-directed-backtracking)
- [tracked dynamically](#tracking-through-dynamic-xtent)
- compatible with [components and `=>` functions](#components-and-this)
- [dynamcially attachable](#dynamic-attachment)
- applicable to [POJOs](#pojos)
- applicable to [Arrays](#arrays)
- transparently supportive of [`async` and `Promise`](#promises-and-async-rules)
- integrate with [eager](#eager-rules) side-effects on existing external system that are not rule-based

Each of these are described in the following sections.

### Properties

In basic Javascript, you can read a named property of an object (or a numbered property of an Array), and you can write to these properties.

```
someObject.answer = 17;
console.log(  someObject.answer  ); // 17

someObject['answer'] = 42;
console.log(  someObject['answer']  ); // 42

Reflect.set(someObject, 'answer', 99);
console.log(  Reflect.get(someObject, 'answer')  ); // 99

someObject.answer = undefined;
console.log(  someObject.answer  ); // undefined for ordinary properties
```

Rules are the same, except for the last line above. A Rule would recompute the _answer_ based on the formula code in the Rule.

That is, the code in a Rule (e.g., `return this.width * this.height`) defines how the system will compute the value of the property - unless your program assigns a different value. If you do assign a value, that value will be cached and used instead of the Rule's code. However, you can "reset" a Rule so that it goes back to using your program's code. This is done by assigning the Javascript value `undefined`. 

This simplifies the interaction in complex exploratory systems. The Rule defines the default behavior, and the application might show these computed values in an inspector. However, the application's inspector might allow the user to "override" the Rule and provide a value of their own, such as for _length_ in the example above. The inspector would then show the updated value for _area_. However, unlike a typical spreadsheet, you can bring back the Rule's formula code.

By the way, there is nothing wrong with having a Rule that refers to an ordinary Javascript property -- i.e., one that is not rulified. However, a Rule that does so will _not_ be reset when that property is changed. Rules can only track other Rules -- _**they cannot track changes in ordinary properties**_.

### Caching (aka Memoization)

The values of all rules are automatically cached.  For example, suppose we had defined:

```
...
  get area() {
    console.log('Computing area!');
    return this.length * this.width;
  }
...

> box.area
Computing area!
6
> box.area // We already cached the value. No need to recompute.
6 
```

Memoization is often used in applications for efficiency. While that doesn't seem very important in this toy example, it makes a big difference in complex applications in which it is not obvious when one computation will involve another, perhaps written by someone else, and where that computation turns out to be expensive. Here, all Rules are memoized. (You can still use ordinary methods that are not Rules, and thus not memoized.)

### Demand-Driven Evaluation (aka Lazy Evaluation)

In the above examples, _area_ is not computed until it is actually used, i.e., referenced by some executing code. Now consider a change that resets _area_:

```
...
> box.area // area has been computed and the result cached
6
...

> box.length = 5;  // Resets area, but does not yet recompute it.
5
> box.area // Area needs to be recomputed in order to get the new value.
Computing Area
15 
> box.area // And now the new value has been cached. No recompute.
15
```
Even after we computed _area_ once, by default it is not immediately recomputed when we assign a new value for _length_. However, once we then asked for _area_ it was computed again and the value cached.

Imagine that you have a spreadsheet with some big table way out to the side offscreen, or on another sheet. Lazy evaluation means that these formulae are not actually computed until they come into view -- unless something that _is_ in view depends on those other cells, in which case they _are_ automatically computed instead of giving an error. In any case, as a spreadsheet author you don't have to write any code to compute the other cells when they come into view, nor do you need to make sure that some part of it is computed when off screen because you need the answer in this other cell that is in view.

Demand-driven evaluation is more than just an optimization. It is necessary for "turtles all the way down" systems, in which objects have behaviors that are themslves objects that have behaviors. It is fine for such objects to show their behavior objects when inspected by the user. But the system cannot cause them all to come into being when defined, because the initialization would never terminate.

Lazy evaluation is the default behavior. You can also have "eager" Rules that automatically get re-demanded after a referenced dependency is reset. See [Eager Rules](#eager-rules).

### Dependency-Directed Backtracking

What we have seen so far could be produced by fairly ordinary use of the `get` and `set` decorations of class defintions. (There's a partial example in [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get#smart_self-overwriting_lazy_getters).) The real reason for Rules, however, is to be able to automatically update when needed, like a spreadsheet.

As the system computes the Rule for our _area_, above, it keeps track of the other Rules that it needs -- in this case, _length_ and _width_. It automatically uses the cached values of those Rules, and it automatically computes them if they have not yet been demanded. This is automatically repeated for all of the Rules that _they_ require, and so forth.

Now, when something is assigned, such as _length_, above, the system goes back and resets all those Rules that have been demanded that immediately depend on _length_ for their own formula. This is automatically repeated for all of the Rules that depend on _those_ Rules, and so forth. 

Note that _only_ the dependent rules are reset. For example, _width_ is not reset when _length_ is assigned, because _width_'s value doesn't depend at all on _length_. This is very different than a system that simply notes whether "anything at all has changed", and then recomputes _everything_.

(If you're familiar with expert systems, you can think of the demand-driven evaluation of referenced Rules as "forward chaining", and the reset of all the dependent Rules as "backward chaining". Rules use both!)

### Tracking Through Dynamic Extent

A Rule can refer to non-Rule code that, in turn, refers to a Rule. That's fine, and the second Rule _will_ be tracked. There is no need for the first Rule to lexically contain the second Rule. (However, see [Pitfalls](#pitfalls-and-common-mistakes), below.)

If it helps to understand, the tracking is achieved by having Rule reference interact with an application-global stack of tracking machinery. This works because of two fundamentals of how Javascript works:

- Each Javascript application is effectively single-threaded for the application code. Rules are _not_ tracked between one Web page and another, or between a Web page and a Web worker.
- Javascript modules (such as the Rules module) are only loaded once in each application, regardless of how many modules may load other modules that each load the Rules module. So there are no duplicates of the internal tracking machinery.

### Components and `this`

> _**This section is subject to change**_.

One sometimes wants to define object instances of, e.g., a generic "game object", as a set of separately defined components. If the components are modeled as instances of a Javascript "class", then the special Javascript binding `this` will refer to the component, rather than to the whole "game object".

There are several mechanisms in Javascript that allow for such distinctions, including `function` and `bind` vs `=>`, and _target_ vs _receiver_ in `Reflect.get`/`.set`.

To accomodate such distinctions, the code for computing a Rule value is always passed an argument that is the _receiver_.  Usually this is the same as `this`, but can be different (e.g., in `Reflect.get`). You can ignore this argument (e.g., you don't even have to declare it in your forumala code, but it's there if you want. (For example, I often name that argument `self` and use it where I would otherwise use `this`.) This is particularly convenient with "Dynamic Attachment" and `=>` functions.

Note, however, that getter methods (preceded by `get` in the class definition) cannot take arguments. So if you want to pass an argument for `this` (that, self, etc.), do not use `get`. See [Rulify](#rulify)

> _(FIXME: give an example that shows where they can be different.)_


### Dynamic Attachment

An ordinary property can be created simply by assigning a value, or by using `Object.defineProperty()`.  They don't have to be declared up front by a class definition. It is very common to make use of this in Javascript, especially when creating things live while interacting with them.

We can also dynamically attach Rules to existing instantiated objects:

```
Rule.attach(parent, 'reversedNames', (self) => self.children.reverse)
```
This defines a new Rule on parent (or redefines an old one of the same name), accessed as `parent.reversedNames`. The function provides the default computed value.

> _(FIXME: add redefinition to test suite.)_

### POJOs

There's nothing particularly magical about class instances in Javascript. Our box in the example above could be an ordinary "Plain Old Javascript Object" (e.g., `{}`, or `{x: 17, y: 42, name: 'fred'}`), plus some inheritance.

You can `attach` or 'rulify' a POJO.  For example, our _box_ could be written as:

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

> _**This section is subject to change**_.

Arrays can also be Rulified, so that each element acts like an object's property Rules.

Consider the following example, as kind of a review of the above:

```
class Child {
  constructor(name) {
    this.name = name;  // Overrides the default Rule for name.
  }
  get name() {
    return 'Name me!';
  }
}

class Parent {
  get childA() {
    return new Child('A');
  }
  get childB() {
    return new Child('B');
  }
  get children() {
    return [this.childA, this.childB];
  }
  get names() {
    return this.children.map((child) => child.name).join(', ');
  }
}
[Parent, Child].forEach(kind => Rule.rulify(kind.prototype));

var parent = new Parent();
console.log(parent.names);  // A, B 

parent.childA.name = 'AA';
console.log(parent.names);  // AA, B

parent.childB = new Child('BB');
console.log(parent.names);  // AA, BB
```

The Rule _names_ depends on _children_. In turn, the Rule _children_ depends on _childA_ and _childB_. Finally, _names_ also depends on the _name_ Rule of each child instance.  So naturally, when we assign new values to `parent.childA.name` or `parent.childB`, _names_ is recomputed.

All these references to Rules in other objects are perfectly fine and expected.

However, the Array that is the value of _children_ also has properties, but they are not Rules, and so _Rules cannot track changes in them_. For example, consider `Array.prototype.length`:

```
parent.children.push(new Child('C'));
console.log(parent.names);  // AA, BB still! It does not include C!
```

The Rules _names_ and _children_ cannot depend on the array _length_, and so _names_ does not get reset when _length_ is changed!

Fortunately, we can _rulify_ arrays just like we can rullify POJOs:

```
  get children() {
    return Rule.rulify([this.childA, this.childB]);
  }

```
This converts length and each element of the array to a Rule, in which changes are tracked by other Rules. Now `parent.names` is properly updated to `AA, BB, C`.

> _I am considering additional magic. In particular, there are several methods on Array.prototype that use a function to create a new copied array. I would like for each of these methods on rulified arrays to automatically produce a new rulified array in which the formula for each element is based on the function given by the application. Thus if an individual element of the original rulified array is changed, then the corresponding element of the copy - and only that element - will be reset. Demanding that element will compute a new value by applying the original formula to the new element of the original rulified array. The motivation for this is that I would like to be able to replace a child element and have various mirrors or views of those children update only one element. This matters when the tree is deep and something near the top is replaced (e.g., with new code). On the other hand, I'm not convinced that rulified arrays are important for my use cases at all._

### Promises and `async` Rules

A Rule can be declared `async` or it can explicitly return a `Promise`. This is quite common when interacting with the file system or another computer on the network. In either case, a reference to the Rule will answer a Promise until it is resolved, and then will _automatically replace the Promise with the resolved value_. (How cool is that!)

Furthermore, this fans out to any Rule that depends on a Rule with a `Promise` value. The referencing rule does not need to know whether the Rule it depends on was asynchronous, and it does not need to explicity `await` the result!

```
async function saveDataAndReturnIdentifier() {
  ...
}

class Widget {
  ...
  get identifier() {
    return saveDataAndReturnIdentifier();
  }
  get childIdentifiers() {
    return this.children.map(child => child.identifier));
  }
  ...
}
Rule.rulify(Widget.prototype);
```
Note that none of the Rule code does anything at all with `async` or `await`. It does not need to. An application that uses this, e.g., to display an inspector of _Widgets_, could show Promise values as `...`, and then show the resolved value. But neither the author of the UI, nor the author of the _Widget_ Rules, needs to know anything about the internals of which Widget rules might temporarily be a `Promise` vs which do not.

This is very convenient, especially when working with code produced by others with which you are not familiar or which may be changing -- including code that is changing as you use it! But there is an important reason for it beyond convenience. In some systems, particularly distributed systems, it is very important that the system (or some well-defined portion of the system) produce deterministically identical results on different computers. This is difficult when some results involve user interactions and communications over the network (which may take different amounts of time for different users). When combined with memoization, above, the magic resolution of `Promises` makes it practical to write a system in which a Rules resolved value is the same on each system regardless of how long things took, or what order the dependents were computed in. (This is assuming that the Rules do not depend on side effects, such as incrementing a set of order-dependent counters, or providing different asynchronous networked answers for different users.)

### Eager Rules

The forumula of an ordinary rule is computed (and cached) only when code references the value. If the formula depends on another rule that is reset, an ordinary, demand-driven rule will not recompute until its value is once again referenced.

However, a rule can be designated as being eager. See [Rulify](#rulify) and [attach](#attach).

 Like all rules, an eager rule does not cause itself to exist as soon as it is defined or explicitly reset by setting it directly to undefined - it still needs to be explicitly demanded that first time by the application. However, if that computed forumula depends on other rules, and any of those rules are reset, an eager rule will automatically be re-computed.

Eager rules are useful for modeling side-effect on external systems. For example, one might have a rulfied object that maintains a connection to some existing external object that cannot be rulified, such as a browser DOM Element, or persistent storage. One might create an eager rule called `update` (for example) with a forumula that interacts with the external objects as a side-effect. In the following example, whenever our widget `answer` changes, for whatever reason, `this.element.textContent` will be updated:

```
class Widget {
  constructor() {
    // Set up external, non-rulfied object:
    this.element = document.create('div');
    this.parent.element.append(this.element);
    // Once the external object is set up, demand our eager rule, just for effect:
    this.update;
  }
  get answer() { // Produce whatever results we need.
    return someComputationReferencingLotsOfStuff(....);
  }
  get update() { // Side-effect the external object, with info computed from our own rules.
    this.element.textContent = this.answer;
    return true; // A formula can return any value as along as it isn't 'undefined'.
  }
  destroy() { // Remove the widget from our application.
    this.element.remove();    // Clean up the external object.
    this.element = undefined; // Allow the external object to be garbage-collected.
    this.update = undefined;  // Directly resetting our eager rule does NOT re-demand it.
   }
}
Rule.rulify(Widget.prototype, {eagerNames: ['update']})
```


## API

### ES6 Modules

```
import { Rule } from '@kilroy-code/rules/index.mjs';
```

### attach

`Rule.attach(objectOrProto, propertyName, methodOrInit, {configurable, enumerable})`

Defines `objectOrProto[propertyName]` as a Rule in which `methodOrInit` is the forumala (if `methodOrInit` is a function), or the initial cached value (otherwise).

`configurable` and `enumerable` are as for `Object.defineProperty()`.

`Rule.Eager.attach` is the same, but creates an eager rule.

### rulify

`Rule.rulify(object, {ruleNames, eagerNames, configurable, enumerable}) => object`

Creates a rule on `object` for each property named in `ruleNames`.  `configurable` and `enumerable` are as for `Object.defineProperty()`. See [attach](#attach), above. If a name appears in (`ruleNames` and) `eagerNames`, the rule will be eager.

`ruleNames` defaults to a list of each own-property in `object` that is defined with `get` and no `set`. (Currently, if the list is empty, it is populated by every single own-property in `object` except `constructor`. However, this behavior might be dropped in future versions.)

`Rule.rulify(array) => a rulified Array`

Return an Array (actually, a Proxy to an Array) in which each element, and the length property, are Rules. The initial values of each are the elements of `array`.  See [Arrays](#arrays), above.

It is not specified whether changes to the returned value will effect the original `array`. (Currently, they do.)

> _I'm not  sure that `enumerable` is meaningful or correct_.

### free

`Rule.free(instance)`

Resets and deletes all Rules from `instance`. It does not effect the prototype chain, and therefore there is no harm if other Rules re-demand a Rule on instances of rulified class.prototypes. In such cases, the Rule will just be recreated as if it were the first reference to the rulified property.

This is not normally necessary, as references to other Rules are removed by reset. But it may be useful if you have a lot of rulified objects that have been around long enough to be "tenured", and would like to explicitly release associated Rule memory. Of course, you are responsible for any other memory.

## Pitfalls and Common Mistakes

There are a three or four things to watch out for in each of [tracking](#tracking), [side-effects](#side-effects), or [quirks](#quirks) of the implementation.

### Tracking

- Non-Rule code can refer to Rules (using ordinary property syntax), but:

 - The non-Rule code won't magically update when there is an update to the Rules it references.
 - It won't get the magic Promise resolution. For example, if non-Rule code references a Rule that happens to be a Promise at the time, the non-Rule will have to arrange its own `await` or `then`.

- Rule code can refer to non-Rule code, including non-Rule properties, but it won't  track changes (e.g., assignments) to non-Rule properties.

- You can write circularly referential Rules, but of course, you must assign/override enough of them so that they are not actually circular.

```
 ...
   get length() { return 2 * this.width; }
   get width() { return 0.5 * this.length; }
 ...
 object.length = 4;
 console.log( object.width ); // 2 
```
or

```
...
object.width = 2;
console.log( object.length ); // 4
```
but

```
object.length = object.width = undefined; // E.g., reset to rules or never assigned
console.log( object.width ); // Gives nice error about about circularity.
```

- During the initial dynamic execution of a Rule, all the other Rules it requires are tracked. However, this does not apply to a _callback_ that lexically appears within a Rule, nor to a `then` (because this is equivalent to a callback). For example:

```
class Callbacks {
  get a() { return 1; }
  get b() { return 2; }
  get data() {
    let data = [];
    let a = data[0] = self.a;
    fetchFromDatabase(a, function (error, dbValue) {
      if (error) throw error;
      let b = data[1] = this.b;
      data[2] = dbValue + a + b;
    });
  return data;
}
Rule.rulify(Callbacks.prototype);
```
If there is an assignment (including a reset) of _a_, then _data_ will correctly be recomputed because _a_ was referenced dynamically within the Rule formula execution, where data is returned. However, the callback happens later, while Rules are not being tracked. The Rule _b_ will therefore not be tracked as being required for _data_, and an assignment or reset of _b_ will not recompute the _data_.

The correct way to do this is to split the database operation into two Rules:

1. The first makes the database request and promises the result of that request alone. It _must not_ reference any Rules within the callback.
- The second uses that result and any other desired Rules:

```
 get dbValue() {
   return new Promise(function (resolve, reject) {
     fetchFromDatabase(self.a, function (error, dbValue) {
       if (error) reject(error);
       resolve(dbValue);
     });
   });
 }
 get computationOnDbValue() {
   return this.dbValue + this.a + this.b;
 }
```
This wil re-rerun the database fetch if _a_ changes, and it will recompute the _computationOnDbValue_ if _a_ or _b_ changes (automatically waiting on _dbValue_ to resolve if/as necessary).

### Side-effects

- Beware of side-effects. In general, functional/declarative and procedural code can be mixed with Rules, but if you do that, it is up to you to ensure that the side effects are correct.


- A single Rule can have code that refers to _multiple_ other Rules that are `async` or have `Promise` values. That works. However, portions of the Rule may execute multiple times. For example, suppose there is a Rule like:

```
get computeSomething() {
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

- If you do some network or other activity asynchronously, beware of assignments to the result before it has resolved. For example, if you have a Rule that returns a `Promise` and then make an assignment to it before the `Promise` resolves, the final value of the Rule is not specified. 

### Quirks

- It is an error for a Rule formula to return `undefined`. Assigning `undefined` resets the Rule so that the forumla will be re-computed.

- Currently, a function cannot be used as the initial value of a Rule created with `Rule.attach`. If a function is passed as the third argument, it is treated as a formula for computing the value.

- A formula for `someRule` can refer to the formula of its superclass, but you cannot use `super.someRule`.  Instead, you have to call it as a method with two underscores: `super.__someRule()`.

- Rules refering to other Rules keep references to them in both directions. These references are freed when the rule is reset. (But of course, the application might then demand it again.) The Rule machinery itself is not removed when reset. If you really need to thoroughly remove all memory used by all rules in an instance, use [Rule.free](#free).

- Currently, re-rulifying or re-attaching is not likely to work, nor is rulifying a class prototype after the first instance is created.

- A demanded rule causes an additional "own property" to be added to object that begins with an underscore. E.g., if `anObject` has a rule named, `something`, after evaluating `anObject.something`, `Object.keys(anObject)` incudes `_something`, and `anObject.hasOwnProperty('_something') is true.

## Implementation

Each Rule is an object that keeps track of:

- the instance it is attached to
- the property name that it represents
- the currently computed value
- a list of the other Rules that were directly required to compute this value
- a list of the other Rules that directly used this value in their computation

The Rule instance itself is not created until the first time the Rule property is read. When we `attach` a Rule to an object (or to a prototype), we use `Object.defineProperty` to define get and set operations. These instantiate the Rule if neded (storing it on a private property of the instance), and then invoke the corresponding `get` or `set` method on the Rule instance (which follow the protocol of `Refelect.get` and `.set`).

Arrays are similar, but produce one `Proxy` to the array rather than using `Object.defineProperty` length+1 times (for each element and for the `length` property itself).

To build the lists of required and used Rules, we maintain a stack of Rules being computed:

- When we `get` a Rule that does not yet have a value cached, that Rule is pushed onto the stack before computation, and popped off after.
- In between - i.e., while computing the formula - any Rules we directly reference (whether cached or not) will have us added to their "usedBy" list, and they will be added to our "requires" list.
- When a Rule is assigned, all of it's "usedBy" are reset (assigned undefined, which then recurses), and it is removed from the "usedBy" of each other Rule that it "requires". 

("usedBy" is the workhorse. The reason we remove ourself from the "usedBy" of the rules we "require", is that after reset we are not really used by them at that point. We might well be assigned an overwriting value, and we wouldn't want a reset of those _potentially_ required rules to reset the assigned value. The only reason for "requires" is to have backpointers to those Rules so that we don't have to go searching for them.)

During the computation of a formula, we also catch any references to a `Promise`, and store a new `Promise` as the catching Rule's pending value. Meanwhile, any time we store a `Promise`, we add a `.then` to it that will take action when the Promise is fullfilled:

- If the `Promise` is resolved, the value is stored and each "usedBy" is re-tried.
- If the `Promise` is rejected, each pending "usedBy" is rejected.

Note that `.then` callbacks are never synchronous with fullfilment - they are always executed on a later tick. 

An eager rule is simply one that demands itself on the next tick after being reset by a dependency. Here the implementation distinguishes between an explicit reset -- setting the value to undefined -- and one triggered by a resetting a dependency.

### Performance

This kind of system is usually used in cases where it simply would not be possible to write the system without it, never mind run it. In such cases, we're generally happy if it runs within an order of magnitude of hand-crafted "normal" code.

The overall performance is highly dependent on the particular application. For example, suppose that an application depends on maintaining a core set of Rules of modest scale -- say a few hundred or a thousand Rules. There might be 10,000 or more Rules that these depend on. If rendering the application ultimately only has to look at just the core set, and most are cached with only a few updating, then the 10k Rules behind it are not examined at all during a typical rendering frame. In this case, it doesn't matter how long it takes to look at the 10k required rules, because we all have already cached the 1k rules needed for rendering.

As it happens, reading a cached value in the current implementation is well within an order of magnitude of an ordinary method call. On Chrome or Edge, it appears to currently be a factor of 2 or 3 slower. 

Computing a Rule appears to be about 20-30 times slower in most browsers.

A detailed profiling would, no doubt, take this down further.

## Related Work

Depedency-directed backtracking has been used for decades in artifical intelligence and expert systems.

The present author's own experience with it began while working for several years at a Knowledge-Based Engineering tools company that produced CAD systems for engineers. (This company spawned an IPO, several spinnoffs, and acquisitions by Oracle, Autodesk, and Dassault.) See [https://en.wikipedia.org/wiki/ICAD_(software)](https://en.wikipedia.org/wiki/ICAD_(software))

Later, he led a team that created a version of Croquet that used this technique, called Brie. See [https://alum.mit.edu/www/stearns/croquet/C5-06-BrieUserExperience.pdf](https://alum.mit.edu/www/stearns/croquet/C5-06-BrieUserExperience.pdf)) and [https://alum.mit.edu/www/stearns/croquet/C5-06-BrieArchitecture.pdf](https://alum.mit.edu/www/stearns/croquet/C5-06-BrieArchitecture.pdf). This Javascript package is an outgrowth of that work. Brie had additional semantics around copying, that has not yet been incorporated into Rules.

Opportunities for further work in Rules includes:

- Formula capture for [arrays](#arrays), so that, e.g., a change to a single element of a rulified array causes the captured formula to be recomputed only for the correspondoning element of an array that was mapped from the original.
- [Performance](#performance) optimization.
- Get rid of some of the [quirks](#quirks) of implementation.
- Copy semantics like Brie (see immediately above).
- Simplifying and clarifying the test suite, and documenting it here.
- Packaging and distribution (npm, unpkg, etc.)

_However, Rules are not being developed in the abstract, but for use within a particular multi-user platform called Ki1r0y. I'm holding off on further changes to Rules until I gain more experience with the needs applied to Ki1r0y._






