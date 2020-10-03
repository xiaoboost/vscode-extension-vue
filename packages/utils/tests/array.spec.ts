import test from 'ava';

import * as array from 'src/array';

test('get item by index', ({ is }) => {
    const arr = [0, 1, 2, 3, 4];

    is(array.get(arr, 0), 0);
    is(array.get(arr, 2), 2);
    is(array.get(arr, -1), 4);
});
