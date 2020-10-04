import test from 'ava';

import * as object from 'src/object';

test('is empty object', ({ is }) => {
    is(object.isEmpty({}), true);
    is(object.isEmpty([]), true);
    is(object.isEmpty({ a: 1 }), false);
});

test('object equal', ({ is }) => {
    const obj1 = {
        a: 1,
        b: {
            c: [0, 1, 2],
        },
        c: [{
            b: 123,
        }],
    };
    const obj2 = object.clone(obj1);

    is(object.isEqual(obj1, obj2), true);

    obj2.b.c = [0];
    is(object.isEqual(obj1, obj2), false);
    is(object.isEqual(123, 123), true);
    is(object.isEqual('123', 123), false);
});

test('object circular structure check', ({ is, throws }) => {
    const obj1: Record<string, any> = {
        a: 1,
        b: {
            c: [0, 1, 2],
        },
        c: [{
            b: 123,
        }],
    };

    obj1.b = obj1;

    is(object.checkCircularStructure(obj1), true);

    throws(
        () => object.isEqual(obj1, obj1, true),
        null, 'Can not equal object that have circular structure.',
    );
    
    throws(
        () => object.clone(obj1, true),
        null, 'Can not clone circular structure.',
    );
});

test('copy object properties', ({ is, deepEqual }) => {
    const obj1 = {
        a: 1,
        b: {
            c: [0, 1, 2],
        },
        c: [{
            b: 123,
        }],
    };

    const obj2 = object.copyProperties(obj1, ['a', 'b']);

    deepEqual(obj2, {
        a: 1,
        b: {
            c: [0, 1, 2],
        },
    });
    
    is(obj2.b, obj1.b);
});
