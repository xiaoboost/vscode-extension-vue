import { Root } from '@xvue/parser';
import { normalize, InputPath } from './path';

const map: Record<string, Root | undefined> = {};

export function get(file: InputPath) {
    return map[normalize(file)];
}

export function remove(file: InputPath) {
    delete map[normalize(file)];
}

export function add(file: InputPath, ast: Root) {
    map[normalize(file)] = ast;
}
