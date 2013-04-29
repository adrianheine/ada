---
layout: post
title: Partial function application in JavaScript
tags:
- Partial application
- Functional programming
- JavaScript
- PHP
---

Some time ago, I introduced Andi to what he [called](http://www.cosmocode.de/en/blog/gohr/2009-10/15-javascript-fixing-the-closure-scope-in-loops) »Advanced magic«:
A JavaScript function which binds another function to its parameters without actually executing it:

```
function bind(fnc) {
    // Store passed arguments in this scope.
    // Since arguments is no Array nor has an own slice method,
    // we have to apply the slice method from the Array.prototype
    var args = Array.prototype.slice.call(arguments, 1);

    // Return a function evaluating the passed function
    // with the given args
    return function() {
        return fnc.apply(this, args);
    };
}
```

This is a nice tool: You can grab values at a specific time and put them in a box without having to worry about scope or later changes to the used variables (This is different with object parameters – passed object variables [indeed hold references](http://stackoverflow.com/questions/518000) and thus objects may change after binding). This helps for example with fixing loop variables and event callbacks.

Later, I needed something similar, but wanted to bind only some of parameters the function expects. This is called [partial application](http://en.wikipedia.org/wiki/Partial_application):

```
function bind(fnc/*, ... */) {
    var Aps = Array.prototype.slice;
    // Store passed arguments in this scope.
    // Since arguments is no Array nor has an own slice method,
    // we have to apply the slice method from the Array.prototype
    var static_args = Aps.call(arguments, 1);

    // Return a function evaluating the passed function with the
    // given args and optional arguments passed on invocation.
    return function (/* ... */) {
        // Same here, but we use Array.prototype.slice solely for
        // converting arguments to an Array.
        return fnc.apply(this,
                         static_args.concat(Aps.call(arguments, 0)));
    };
}

[1,2,3,4].map(bind(Math.pow, 2));
// Evaluates to [2, 4, 8, 16]
```

Partial application sometimes allows really pretty, terse, and ultimately better code. However, people used to functional programming expect functions to support partial application out of the box. So, I implemented it:

```
/**
 * Helper function for partial application
 *
 * This function expects a function, an argument count, and an
 * argument array. If the number of arguments given is less than the
 * number the function expects, partial returns a new function
 * expecting only the missing parameters, with the given parameters
 * already bound.
 */
function partial(callee, argc, argv) {
    if (argv.length < argc) {
        return bind.apply(this, [callee].concat(argv));
    } else {
        return false;
    }
}

function pow(a, b) {
    var part = partial(arguments.callee, 2,
                       Array.prototype.slice.apply(arguments));
    if (part !== false) return part;

    return Math.pow(a, b);
}

console.log([1,2,3,4].map(pow(2)));
```

The `partial` function has a general, abstract interface. In JavaScript, the function may provide a simpler interface:

```
/**
 * Helper function for partial application
 *
 * This function expects an arguments object as given in a function
 * call. If the number of arguments given is less than the number
 * the function expects, partial returns a new function expecting
 * only the missing parameters, with the given parameters already
 * bound.
 * The number of arguments the function expects may be overriden with
 * the second parameter. Otherwise, arguments.callee.length is used.
 * This is necessary for wrapper functions.
 */
function partial(arguments_, argc) {
    var argv = Array.prototype.slice.apply(arguments_);
    argc = argc || arguments_.callee.length;
    if (argv.length < argc) {
        return bind.apply(this, [arguments_.callee].concat(argv));
    } else {
        return false;
    }
}
```

Now, things get much simpler:

```
function pow(a, b) {
    var part = partial(arguments);
    if (part !== false) return part;

    return Math.pow(a, b);
}

console.log([1,2,3,4].map(pow(2)));
```

As a last simplification, we can abstract away the partializing (That’s where the `argc` overwriting finally comes in handy):

```
/**
 * Create a wrapper function supporting partial application
 *
 * This function expects a function and returns a wrapper function
 * supporting partial application.
 */
function partialize(func) {
    return function (/* ... */) {
        var part = partial(arguments, func.length);
        if (part !== false) return part;

        return func.apply(this, arguments);
    };
}

pow = partialize(Math.pow);

console.log([1,2,3,4].map(pow(2)));
```

Creating a new function which supports partial application is now really simple:

```
var times = partialize(function (a, b) { return a * b; });
```

Or, for bigger functions:

```
var plus = function (a, b, c) {
    return a + b + c;
};
plus = partialize(plus);

console.log(plus(1)(2)(3));
console.log(plus(1,2)(3));
```

As for the coding, this was a nice thing, but really using it may create confusion and mayhem. Specific problems will occur with:

  * Optional parameters; It would be possible to partialize the mandatory parameters, but it would be hard to distinguish whether the parameters left out are optional or just not applied.
  * Built-in functions; They may as well be partialized, but that’s really hard work.
  * People not used to partial application, i. e. basically everyone
  * Error handling; Accidentally giving the wrong number of arguments creates a much messier state with partial application than without.

To sum it up, you should really think through whether you want to use partial application. And you should be people who are used to it.

And now for something completely different: Partial application in PHP 5.3. For the fun.

```
function bind($func/*, ... */) {
    $static_args = array_slice(func_get_args(), 1);
    return function (/* ... */) use ($func, $static_args) {
        return call_user_func_array($func,
                                    array_merge($static_args,
                                                func_get_args()));
    };
}

function partial($func, $argc, $argv) {
    if (count($argv) < $argc) {
        array_unshift($argv, $func);
        return call_user_func_array('bind', $argv);
    } else {
        return false;
    }
}

function partialize($func, $argc) {
    $wrapper = function(/* ... */) use (&$wrapper, $func, $argc) {
        $args = func_get_args();
        $part = partial($wrapper, $argc, $args);
        if ($part !== false) return $part;

        return call_user_func_array($func, $args);
    };
    return $wrapper;
}

// Manual partialization
function partialpow(/*$a, $b*/) {
    $args = func_get_args();
    $part = partial('partialpow', 2, $args);
    if ($part !== false) return $part;

    list($a, $b) = $args;
    return pow($a, $b);
}

// Partialization with partialize
$partialpow2 = partialize('pow', 2);

// Partialization of user-defined function
// with partialize
$plus = function ($a, $b, $c) {
    return $a + $b + $c;
};
$plus = partialize($plus, 3);

$plus1 = $plus(1);
$plus3 = $plus1(2);
echo $plus3(3) . "\n";
```

You might notice that it’s way less elegant (You have to specify the function parameter count, for example). Moreover, PHP still has this strange separation between function and variable identifiers, although both can actually refer to a function.

**Hint:** Consider using the standardized [bind method](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function/bind) where present or even [shimming](http://perfectionkills.com/extending-built-in-native-objects-evil-or-not/) it for bigger runtime compatibility. Talking about ECMAScript 5, you might want to  know that the `partial` implementation given above uses the deprecated `arguments.callee` property and thus is not compatible with [strict mode](http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/).

**Update:** I released a library called [partial.js](https://github.com/adrianlang/partial-js).
