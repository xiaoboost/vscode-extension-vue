import { fsm, lsp } from './utils/store';
import { uriToFsPath } from './utils/path';
import { getWorkspaceByFile } from './workspace';

import {
    parse,
    ParserError as VueError,
    Range as VueRange,
} from '@xvue/parser';

import {
    ServerCapabilities,
    Diagnostic,
    DiagnosticSeverity,
    Range as VSCRange,
} from 'vscode-languageserver';

import * as files from './utils/file-map';

function toRange(input: VueRange): VSCRange {
    return {
        start: {
            line: (input.start.line ?? 0) - 1,
            character: (input.start.col ?? 0) - 1,
        },
        end: {
            line: (input.end.line ?? 0) - 1,
            character: (input.end.col ?? 0) - 1,
        },
    };
}

export const capabilities: ServerCapabilities = {};

export function install() {
    fsm.onDidChangeContent(({ document }) => {
        const filePath = uriToFsPath(document.uri);
        const workspace = getWorkspaceByFile(filePath);
        const { root, errors, warnings } = parse(document.getText(), {
            location: true,
            errorDetail: false,
            filePath,
            workspace,
        });

        files.add(filePath, root);

        const diagnostics: Diagnostic[] = [];
        const setDiagnostic = (error: VueError, level: DiagnosticSeverity) => ({
            code: 'vue',
            range: toRange(error.range),
            severity: level,
            message: error.message,
        });

        errors.forEach((item) => diagnostics.push(setDiagnostic(item, DiagnosticSeverity.Error)));
        warnings.forEach((item) => diagnostics.push(setDiagnostic(item, DiagnosticSeverity.Warning)));

        lsp.sendDiagnostics({
            uri: document.uri,
            diagnostics,
        });
    });

    fsm.onDidClose(({ document }) => {
        files.remove(uriToFsPath(document.uri));
    });
}
