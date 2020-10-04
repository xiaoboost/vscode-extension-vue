import test from 'ava';

import { testCase } from './utils';

test('normal', ({ deepEqual }) => {
    testCase(deepEqual, 'template-normal');
});
