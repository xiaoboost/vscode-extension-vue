import test from 'ava';

import * as assert from 'src/assert';

test('is number', ({ is }) => {
    is(assert.isNumber(123), true);
    is(assert.isNumber('123'), false);
});
