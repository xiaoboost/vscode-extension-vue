import { URI } from 'vscode-uri';
import { WorkspaceFolder } from 'vscode-languageserver';

import * as path from 'path';
import * as assert from '@xvue/utils/assert';

export type InputPath = string | URI | WorkspaceFolder;

export function isInsidePath(target: string, outPath: string) {
    let dir = target;
    let last = '';

    while (dir !== outPath && dir !== last) {
        last = dir;
        dir = path.dirname(dir);
    }

    return dir === outPath;
}

export function normalize(input: string | URI | WorkspaceFolder) {
    let val = '';

    if (assert.isString(input)) {
        val = input;
    }
    else if (URI.isUri(input)) {
        val = input.fsPath;
    }
    else if ('uri' in input) {
        val = URI.parse(input.uri).fsPath;
    }

    return val;
}

export function uriToFsPath(input: string) {
    return URI.parse(input).fsPath;
}
