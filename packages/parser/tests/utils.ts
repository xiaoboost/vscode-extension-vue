import * as fs from 'fs';
import * as path from 'path';

import { DeepEqualAssertion } from 'ava';
import { parse as origin, walk, ParserOptions, Root } from 'src';

type ParserParameter = Parameters<typeof origin>;

const resolve = (...dirs: string[]) => path.resolve(__dirname, '..', ...dirs);

export function parse(...params: ParserParameter) {
    const result = origin(...params);

    walk(result.root, (node) => {
        delete node.parent;
    });

    return result;
}

type TestParserOptions = Omit<ParserOptions, 'workspace' | 'filePath'>;

export function readCase(name: string, opt: TestParserOptions = {}) {
    const basicPath = 'tests/screenshot';
    const workspace = resolve('tests');
    const filePath = resolve(basicPath, name + '.vue');
    const content = fs.readFileSync(filePath, 'utf-8');
    const expect = JSON.parse(fs.readFileSync(resolve(basicPath, name + '.json'), 'utf-8')) as Root;
    const origin = parse(content, {
        ...opt,
        workspace,
        filePath,
    });

    return [origin, expect, workspace, filePath] as const;
}

export function testCase(is: DeepEqualAssertion, name: string, opt: TestParserOptions = {}) {
    const [origin, expect] = readCase(name, opt);
    is(origin.root, expect);
}
