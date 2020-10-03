import { lsp } from './utils/store';
import { uriToFsPath } from './utils/path';

import * as workspaces from './workspace';
import * as validator from './validator';

lsp.onInitialize((params) => {
    // 工作区初始化
    (params.workspaceFolders ?? []).forEach(({ uri }) => {
        workspaces.add(uriToFsPath(uri));
    });

    return {
        capabilities: {
            ...workspaces.capabilities,
            ...validator.capabilities,
        },
    };
});

lsp.onInitialized(() => {
    workspaces.install();
    validator.install();
});
