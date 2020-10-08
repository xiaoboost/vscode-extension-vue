import Webpack from 'webpack';
import Chalk from 'chalk';
import TerserPlugin from 'terser-webpack-plugin';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import FriendlyErrorsPlugin from 'friendly-errors-webpack-plugin';
import GenerateJsonPlugin from 'generate-json-webpack-plugin';
import ProgressBarPlugin from 'progress-bar-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import PackageConfig from '../package.json';

import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import { RequireSplitChunkPlugin } from 'require-split-chunk-webpack-plugin';

import {
    modeName,
    resolve,
    outputDir,
    builtinModules,
    externalModules,
    isDevelopment,
    isAnalyzer,
    copyObject,
} from './utils';

/** 公共配置 */
export const baseConfig: Webpack.Configuration = {
    target: 'node',
    mode: modeName,
    node: {
        __dirname: false,
        __filename: false,
    },
    entry: {
        client: resolve('src/client/index.ts'),
        server: resolve('src/server/index.ts'),
    },
    output: {
        path: outputDir,
        filename: 'scripts/[name].js',
        publicPath: '../',
        libraryTarget: 'commonjs',
    },
    resolve: {
        extensions: ['.ts', '.js', '.json'],
        mainFiles: ['index.ts', 'index.js'],
        plugins: [
            new TsconfigPathsPlugin({
                configFile: resolve('tsconfig.build.json'),
            }),
        ],
        alias: {
            '@xvue/utils': '@xvue/utils/dist/es',
        },
    },
    performance: {
        hints: false,
        maxEntrypointSize: 2048000,
        maxAssetSize: 2048000,
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                loader: 'ts-loader',
                options: {
                    configFile: resolve('tsconfig.build.json'),
                },
            },
        ],
    },
    plugins: [
        new Webpack.HashedModuleIdsPlugin({
            hashFunction: 'sha256',
            hashDigest: 'hex',
            hashDigestLength: 6,
        }),
        new Webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(modeName),
        }),
        new GenerateJsonPlugin('package.json', copyObject(PackageConfig, [
            'name',
            'version',
            'description',
            'main',
            'author',
            'contributes',
            'engines',
            'keywords',
            'publisher',
            'activationEvents',
        ])),
        new CopyWebpackPlugin({
            patterns: [
                resolve('assets'),
            ],
        }),
        new ProgressBarPlugin({
            total: 40,
            format: `${Chalk.green('> building:')} [:bar] ${Chalk.green(':percent')} (:elapsed seconds)`,
        }),
    ],
};

if (isDevelopment) {
    baseConfig.watch = true;
    baseConfig.devtool = 'source-map';
    baseConfig.externals = builtinModules.concat(externalModules);
    baseConfig.plugins = baseConfig.plugins!.concat([
        new FriendlyErrorsPlugin({
            compilationSuccessInfo: {
                messages: ['Project compile done.'],
                notes: [],
            },
        }),
    ]);
}
else {
    baseConfig.optimization = {
        minimize: true,
        concatenateModules: true,
        splitChunks: {
            maxInitialRequests: Infinity,
            minSize: 0,
            minChunks: 1,
            name: true,
            cacheGroups: {
                commons: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'common',
                    chunks: 'all',
                },
            },
        },
        minimizer: [
            new TerserPlugin({
                test: /\.js$/i,
                cache: false,
                terserOptions: {
                    ecma: 8,
                    ie8: false,
                    safari10: false,
                    output: {
                        comments: /^!/,
                    },
                },
            }),
        ],
    };

    baseConfig.externals = builtinModules;
    baseConfig.plugins = baseConfig.plugins!.concat([
        new RequireSplitChunkPlugin(),
    ]);

    if (isAnalyzer) {
        baseConfig.plugins = baseConfig.plugins!.concat([
            new BundleAnalyzerPlugin({
                analyzerPort: 9876,
            }),
        ]);
    }
}
