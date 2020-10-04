import test from 'ava';

import * as array from 'src/array';

test('get item by index', ({ is, throws }) => {
    const arr = [0, 1, 2, 3, 4];

    is(array.get(arr, 0), 0);
    is(array.get(arr, 2), 2);
    is(array.get(arr, -1), 4);

    throws(() => array.get(arr, -10), null, '(array) index out of bounds.');
    throws(() => array.get(arr, 10), null, '(array) index out of bounds.');
});

test('remove item from array', ({ is, deepEqual }) => {
    const arr = [0, 1, 2, 3, 4, 5];
    const result = array.removeVal(arr, 1);

    is(result, arr);
    deepEqual(arr, [0, 2, 3, 4, 5]);

    array.removeVal(arr, (val) => val > 3, false);
    deepEqual(arr, [0, 2, 3, 5]);

    
    array.removeVal(arr, (val) => val > 2);
    deepEqual(arr, [0, 2]);
});

test('replace item from array', ({ is, deepEqual }) => {
    const arr = [0, 1, 2, 3, 4, 5];
    const result = array.replace(arr, 1e6, 1);

    is(result, arr);

    deepEqual(arr, [0, 1e6, 2, 3, 4, 5]);
    deepEqual(array.replace(arr, -1e6, (val) => val > 1), [0, -1e6, 2, 3, 4, 5]);
    deepEqual(array.replace(arr, 1e6, (val) => val > 3, true), [0, -1e6, 2, 3, 1e6, 1e6]);
});

test('cut array', ({ deepEqual }) => {
    const arr = [0, 1, 2, 3, 4, 5];

    deepEqual(array.cut(arr, 3), [
        [0, 1, 2],
        [3, 4, 5],
    ]);

    deepEqual(array.cut(arr, 4), [
        [0, 1, 2, 3],
        [4, 5],
    ]);
});

test('concat array', ({ deepEqual }) => {
    const arr = [
        [0, 1],
        undefined,
        2,
        3,
        null,
        [4],
    ];

    deepEqual(array.concat(arr, (val) => val), [0, 1, 2, 3, 4]);
});

test('transform array', ({ deepEqual }) => {
    deepEqual(array.transArr(), []);
    deepEqual(array.transArr(1), [1]);
    deepEqual(array.transArr([1, 2]), [1, 2]);
});

test('remove repeat item in array', ({ deepEqual }) => {
    deepEqual(array.unique([0, 0, 1, 2, 2, 2, 3]), [0, 1, 2, 3]);
    deepEqual(
        array.unique([1, 2, 3, 4, 5, 6], (val) => val > 3 ? 10 : val),
        [1, 2, 3, 4],
    );
});

test('array to map', ({ deepEqual }) => {
    const arr = [
        {
            key: 10,
            val: 11,
        },
        {
            key: 20,
            val: 21,
        },
        {
            key: 30,
            val: 31,
        },
    ];

    deepEqual(array.toMap(arr, ({ key }) => key), {
        10: {
            key: 10,
            val: 11,
        },
        20: {
            key: 20,
            val: 21,
        },
        30: {
            key: 30,
            val: 31,
        },
    });

    deepEqual(array.toMap(arr, ({ key }) => key, ({ val }) => val), {
        10: 11,
        20: 21,
        30: 31,
    });
});

test('array to bool map', ({ deepEqual }) => {
    deepEqual(array.toBoolMap([1, 2, 3]), {
        1: true,
        2: true,
        3: true,
    });
    
    deepEqual(array.toBoolMap([1, 2, 3], (val) => 2 * val), {
        2: true,
        4: true,
        6: true,
    });
});

test('exclude item between two array', ({ deepEqual }) => {
    deepEqual(array.exclude([1, 2, 3], [2, 3, 4]), [4]);

    const resultMap = array.exclude(
        [{ a: 1 }, { a: 2 }],
        [{ a: 2 }, { a: 3 }],
        ({ a }) => a,
    );

    deepEqual(resultMap, [{ a: 3 }]);
});
