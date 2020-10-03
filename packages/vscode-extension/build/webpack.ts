import Webpack from 'webpack';

import { isDevelopment } from './utils';
import { baseConfig } from './webpack.base';

const compiler = Webpack(baseConfig);

if (isDevelopment) {
    compiler.watch({ ignored: /node_modules/ }, (err?: Error) => {
        if (err) {
            console.error(err.stack || err);
        }
    });
}
else {
    compiler.run((err, stats) => {
        if (err) {
            throw err;
        }

        console.log('\n' + stats.toString({
            chunks: false,
            chunkModules: false,
            chunkOrigins: false,
            colors: true,
            modules: false,
            children: false,
            builtAt: false,
        }));
    });
}
