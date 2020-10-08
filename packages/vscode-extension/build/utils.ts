import * as path from 'path';
import * as yaml from 'yaml';
import * as fs from 'fs';

import { builtinModules as originBuiltinModules } from 'module';

export const isDevelopment = process.argv.includes('--development');
export const isAnalyzer = process.argv.includes('--analyze');
export const modeName = isDevelopment ? 'development' : 'production';

/** 定位到项目根目录 */
export const resolve = (...dir: string[]) => path.join(__dirname, '../', ...dir);

/** 输出路径 */
export const outputDir = resolve('dist/generated');

/** nodejs 内置模块 */
export const builtinModules = [
    ...originBuiltinModules,
    'vscode',
];

/** node_modules 模块 */
export const externalModules = (() => {
    const file = fs.readFileSync(resolve('../../', 'pnpm-lock.yaml'));
    const lock = yaml.parse(file.toString());
    const packages = Object.keys(lock.packages).map((pack) => {
        const matcher = /\/[^\/]+$/g.exec(pack);

        if (!matcher) {
            return null;
        }

        return pack.substring(1, matcher.index);
    });

    return packages.filter((item): item is string => Boolean(item));
})();

/** 按照 key 复制对象 */
export function copyObject<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const result: Pick<T, K> = {} as any;
  
    keys.forEach(key => {
        if (obj[key]) {
            result[key] = obj[key];
        }
    });
  
    return result;
}
