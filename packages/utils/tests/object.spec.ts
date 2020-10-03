import test from 'ava';

import * as object from 'src/object';

test('is empty object', ({ is }) => {
    is(object.isEmpty({}), true);
    is(object.isEmpty([]), true);
    is(object.isEmpty({ a: 1 }), false);
});
