import * as array from '@xvue/utils/array';

import { lsp } from './utils/store';

import { ServerCapabilities } from 'vscode-languageserver';
import { isInsidePath, normalize, InputPath } from './utils/path';

const uris: string[] = [];

export function get() {
    return uris.slice();
}

export function add(input: InputPath) {
    const val = normalize(input);

    if (!uris.includes(val)) {
        uris.push(val);
    }
}

export function remove(input: InputPath) {
    array.removeVal(uris, normalize(input))
}

export function getWorkspaceByFile(file: string) {
    return uris.find((uri) => isInsidePath(file, uri));
}

export const capabilities: ServerCapabilities = {
    workspace: {
        workspaceFolders: {
            supported: true,
        },
    },
};

export function install() {
    lsp.workspace.onDidChangeWorkspaceFolders((event) => {
        event.added.forEach(add);
        event.removed.forEach(remove);
    });
}
