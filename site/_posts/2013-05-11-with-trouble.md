---
layout: post
title: with trouble
tags:
- JavaScript
- with
- Scope
- Hoisting
---

While working on [jsdom](https://github.com/tmpvar/jsdom), I spent several hours debugging an issue related to the `with` statement.

I had a function similar to the following:

```javascript
function test(scope) {
  with (scope) {
    var local = 'local value';
    // do stuff with local
  }
}
```

Somehow, the function did not do what it was supposed to, not at all. First, I had to realize that `local` was not bound to actually be a local variable since the declaration is subject to [hoisting](https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Statements/var#var_hoisting), which means that the declaration is moved to the top of the inner-most lexical scope. Thus, `test` is equal to:

```javascript
function test(scope) {
  var local;
  with (scope) {
    local = 'local value';
    // do stuff with local
  }
}
```

This means that `local` is just a normal reference which will be looked up in the `scope` object first, and only afterwards in the `test` function’s lexical scope and the global scope. That is obvious if you have in mind how hoisting works in JavaScript, but it still took me a while.
I’d like to emphasize the point: Having written `var variable = 'value'`, you can’t be sure that the reference declared (`variable`) is getting the value from the definition (`'value'`)! I think the following paragraph from [the ECMAScript standard](http://www.ecma-international.org/ecma-262/5.1/#sec-12.2) describes this issue:

    If a VariableDeclaration is nested within a with statement and the Identifier in the VariableDeclaration is the
    same as a property name of the binding object of the with statement‘s object environment record, then step 4
    will assign value to the property instead of to the VariableEnvironment binding of the Identifier.

However, for my function `test` this is only an issue if there is a property `local` on the `scope` object. Even then, the function would just use this property instead of a local variable. The property would get overwritten with the string `'local value'`, which could lead to problems with other code using the `scope` object, but it should not be an issue for the remainder of the function `test` itself. Yet, it failed. Further investigation showed that the value of `local` immediately after setting it was not `'local value'` – what I thought I just had set it to:

```javascript
// …
var local = 'local value';
console.log(local === 'local value'); // logs false
// …
```

In my case, the scope object did not only have a property `local`, but it was also read-only. That was achieved by [defining a getter, but no setter](https://developer.mozilla.org/en-US/docs/JavaScript/Guide/Working_with_Objects#Defining_getters_and_setters).

```javascript
function test(scope) {
  with (scope) {
    var local = 'local value';
    // do stuff with local
  }

}
test({
    get local: function () {
      return 'value';
    }
});
```

I realized I would have to solve the initial issue: The variable declaration got moved to the top of the function, i. e. before the `with` statement, and the variable was looked up in the scope object first. To fix that, I needed to make sure that the variable was declared in a scope which would get used before the scope object from the `with` statement. As of ECMAScript 5, the only way to do this (aside from another `with` statement) is a function:

```javascript
function test(scope) {
  with (scope) {
    (function () {
      var local = 'local value';
      // do stuff with local
    }());
  }
}
```

Now, `local` is definitely a local variable without the `with` interfering. Take a look at the [original commit](https://github.com/tmpvar/jsdom/commit/8b86af79fab863f381a8c191e896914a1baf4726) if you want to see the fix in action.
