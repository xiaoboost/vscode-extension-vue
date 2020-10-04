import test from 'ava';

import * as assert from 'src/assert';

test('is number', ({ is }) => {
    is(assert.isNumber(123), true);
    is(assert.isNumber('123'), false);
});

test('is string', ({ is }) => {
    is(assert.isString(123), false);
    is(assert.isString('123'), true);
});

test('is boolean', ({ is }) => {
    is(assert.isBoolean(true), true);
    is(assert.isBoolean(false), true);
    is(assert.isBoolean('123'), false);
});

test('is symbol', ({ is }) => {
    is(assert.isSymbol(Symbol(123)), true);
    is(assert.isBoolean('123'), false);
});

test('is undef', ({ is }) => {
    is(assert.isUndef(undefined), true);
    is(assert.isUndef(void 0), true);
    is(assert.isUndef(null), true);
    is(assert.isUndef(123), false);
});

test('is def', ({ is }) => {
    is(assert.isDef(123), true);
    is(assert.isDef('123'), true);
    is(assert.isDef(true), true);
    is(assert.isDef(undefined), false);
});

test('is function', ({ is }) => {
    is(assert.isFunc(() => {}), true);
    is(assert.isFunc(async () => {}), true);
    is(assert.isFunc(function () {}), true);
    is(assert.isFunc('123'), false);
});

test('is strict object', ({ is }) => {
    is(assert.isStrictObject({}), true);
    is(assert.isStrictObject(Object.create(null)), true);
    is(assert.isStrictObject([]), false);
    
    class ClassA {}
    is(assert.isStrictObject(new ClassA()), true);
});

test('is object', ({ is }) => {
    is(assert.isObject({}), true);
    is(assert.isObject(Object.create(null)), true);
    is(assert.isObject([]), true);
    
    class ClassA {}
    is(assert.isStrictObject(new ClassA()), true);
    is(assert.isObject(() => {}), true);
    is(assert.isObject(null), false);
    is(assert.isObject(undefined), false);
});

test('is array', ({ is }) => {
    is(assert.isArray([]), true);
    is(assert.isArray(Object.create(null)), false);
});

test('is base type', ({ is }) => {
    is(assert.isBaseType(123), true);
    is(assert.isBaseType('123'), true);
    is(assert.isBaseType(true), true);
    is(assert.isBaseType(Symbol()), true);
    is(assert.isBaseType(undefined), true);
    is(assert.isBaseType(null), true);

    is(assert.isBaseType({}), false);
    is(assert.isBaseType([]), false);
    is(assert.isBaseType(() => {}), false);
    is(assert.isBaseType(Object.create(null)), false);
});

test('is primitive', ({ is }) => {
    is(assert.isPrimitive(123), true);
    is(assert.isPrimitive('123'), true);
    is(assert.isPrimitive(Symbol()), true);
    is(assert.isPrimitive(true), true);

    is(assert.isPrimitive(null), false);
    is(assert.isPrimitive(undefined), false);
    is(assert.isPrimitive({}), false);
    is(assert.isPrimitive([]), false);
    is(assert.isPrimitive(() => {}), false);
    is(assert.isPrimitive(Object.create(null)), false);
});
